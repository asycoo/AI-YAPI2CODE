import { DoveMessage, DoveMode, MsgType } from '../constants/msgType';

/** 生成唯一 ID，用于消息的请求-响应关联 */
function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** 订阅回调类型：接收消息数据，可同步或异步返回处理结果 */
type SubscribeCallback = (data: any) => any | Promise<any>;

/**
 * Dove 消息通道：用于 Extension Host 与 Webview 之间的双向通信
 * - 支持 request-response 模式（sendMessage / receiveMessage 配合）
 * - 支持 publish-subscribe 模式（subscribe 订阅指定消息类型）
 */
export class Dove {
  /** 消息发送函数（如 postMessage 到 webview） */
  private sender: (msg: DoveMessage) => void;
  /** 待响应的请求池：key -> { resolve, reject }，用于关联请求与响应 */
  private pendingPool = new Map<string, { resolve: (value: any) => void; reject: (err: any) => void }>();
  /** 按消息类型分组的订阅回调池 */
  private subscribePool = new Map<MsgType, SubscribeCallback[]>();

  constructor(sender: (msg: DoveMessage) => void) {
    this.sender = sender;
  }

  /**
   * 主动发送消息并等待响应（request-response）
   * @param type 消息类型
   * @param data 消息载荷
   * @returns Promise，在收到对应响应或超时（30s）时 resolve/reject
   */
  sendMessage<T = any>(type: MsgType, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const key = uuid();
      this.pendingPool.set(key, { resolve, reject });
      this.sender({ key, type, mode: DoveMode.INITIATIVE, data });

      setTimeout(() => {
        if (this.pendingPool.has(key)) {
          this.pendingPool.delete(key);
          reject(new Error(`Message ${type} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * 接收并处理对端发来的消息
   * - 若为被动响应（PASSIVE）：在 pendingPool 中查找对应 key 并 resolve 该请求
   * - 若为主动请求（INITIATIVE）：触发该类型的订阅回调，并将回调结果作为响应回传
   */
  async receiveMessage(msg: DoveMessage): Promise<void> {
    if (msg.mode === DoveMode.PASSIVE) {
      const pending = this.pendingPool.get(msg.key);
      if (pending) {
        this.pendingPool.delete(msg.key);
        pending.resolve(msg.data);
      }
      return;
    }

    const callbacks = this.subscribePool.get(msg.type) || [];
    let result: any;
    for (const cb of callbacks) {
      result = await cb(msg.data);
    }
    this.sender({
      key: msg.key,
      type: msg.type,
      mode: DoveMode.PASSIVE,
      data: result,
    });
  }

  /**
   * 订阅指定类型的消息（publish-subscribe）
   * @param type 消息类型
   * @param callback 收到消息时的处理函数，返回值会作为响应回传给发起方
   * @returns 取消订阅的函数
   */
  subscribe(type: MsgType, callback: SubscribeCallback): () => void {
    const list = this.subscribePool.get(type) || [];
    list.push(callback);
    this.subscribePool.set(type, list);
    return () => {
      const current = this.subscribePool.get(type) || [];
      this.subscribePool.set(
        type,
        current.filter((cb) => cb !== callback)
      );
    };
  }

  /** 销毁通道：拒绝所有待处理的请求，清空订阅池 */
  dispose(): void {
    this.pendingPool.forEach(({ reject }) => reject(new Error('Dove disposed')));
    this.pendingPool.clear();
    this.subscribePool.clear();
  }
}
