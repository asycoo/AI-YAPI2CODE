import { DoveMessage, DoveMode, MsgType } from '../constants/msgType';

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

type SubscribeCallback = (data: any) => any | Promise<any>;

export class Dove {
  private sender: (msg: DoveMessage) => void;
  private pendingPool = new Map<string, { resolve: (value: any) => void; reject: (err: any) => void }>();
  private subscribePool = new Map<MsgType, SubscribeCallback[]>();

  constructor(sender: (msg: DoveMessage) => void) {
    this.sender = sender;
  }

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

  dispose(): void {
    this.pendingPool.forEach(({ reject }) => reject(new Error('Dove disposed')));
    this.pendingPool.clear();
    this.subscribePool.clear();
  }
}
