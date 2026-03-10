/**
 * Dove：Webview 与 Extension 的通信层
 * Webview 运行在 iframe 沙箱中，只能通过 postMessage 与 Extension 通信
 * 采用请求-响应模式：Webview 发送 INITIATIVE 消息，Extension 处理后返回 PASSIVE 消息
 */
import { useEffect, useRef, useCallback } from 'react';

export enum MsgType {
  LOGIN_NOW = 'LOGIN_NOW',
  LOGIN_BY_LDAP = 'LOGIN_BY_LDAP',
  LOGIN_STATUS = 'LOGIN_STATUS',
  LOGOUT = 'LOGOUT',
  SERVER_URL = 'SERVER_URL',
  FETCH_PROJECT = 'FETCH_PROJECT',
  FETCH_INTERFACE_MENU = 'FETCH_INTERFACE_MENU',
  FETCH_DETAIL = 'FETCH_DETAIL',
  CREATE_YTT_CONFIG = 'CREATE_YTT_CONFIG',
  REFRESH_CONFIG = 'REFRESH_CONFIG',
  YAPI_CONFIG_DATA = 'YAPI_CONFIG_DATA',
  GENERATE_CODE = 'GENERATE_CODE',
  COPY_CODE = 'COPY_CODE',
  INSERT_CODE = 'INSERT_CODE',
  SHOW_CODE = 'SHOW_CODE',
  BATCH_GENERATE_CODE = 'BATCH_GENERATE_CODE',
  EDIT_YTT_CONFIG = 'EDIT_YTT_CONFIG',
  OPEN_EXTERNAL_LINK = 'OPEN_EXTERNAL_LINK',
  OPEN_FILE = 'OPEN_FILE',
  GET_WORKSPACE_ROOT = 'GET_WORKSPACE_ROOT',
  CHECK_GENERATED_FILES = 'CHECK_GENERATED_FILES',
  OPEN_GENERATED_FILE = 'OPEN_GENERATED_FILE',
  GENERATED_FILES_CHANGED = 'GENERATED_FILES_CHANGED',
  SET_STORAGE = 'SET_STORAGE',
  GET_STORAGE = 'GET_STORAGE',
  WEBVIEW_READY = 'WEBVIEW_READY',
  INIT_CONFIG = 'INIT_CONFIG',
}

enum DoveMode {
  INITIATIVE = 0, // Webview 主动发起，期待 Extension 返回结果
  PASSIVE = 1,    // Extension 的响应，或 Extension 主动推送给 Webview
}

interface DoveMessage<T = any> {
  key: string;
  type: MsgType;
  mode: DoveMode;
  data: T;
}

type SubscribeCallback = (data: any) => any | Promise<any>;

function uuid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// VSCode 注入的 API，只能在 Webview 内调用一次，用于 postMessage 与 Extension 通信
// 开发时可能未注入，用 mock 避免报错
const vscode = (window as any).acquireVsCodeApi?.() ?? {
  postMessage: (msg: any) => console.log('[dev] postMessage:', msg),
};

class DoveClient {
  private pendingPool = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private subscribePool = new Map<MsgType, SubscribeCallback[]>();

  constructor() {
    window.addEventListener('message', (event: MessageEvent<DoveMessage>) => {
      this.receiveMessage(event.data);
    });
  }

  // 发送消息并等待 Extension 返回，通过 key 关联请求与响应
  sendMessage<T = any>(type: MsgType, data?: any): Promise<T> {
    return new Promise((resolve, reject) => {
      const key = uuid();
      this.pendingPool.set(key, { resolve, reject });
      vscode.postMessage({ key, type, mode: DoveMode.INITIATIVE, data });

      // 超时 30 秒未响应则 reject
      setTimeout(() => {
        if (this.pendingPool.has(key)) {
          this.pendingPool.delete(key);
          reject(new Error(`Message ${type} timed out`));
        }
      }, 30000);
    });
  }

  private async receiveMessage(msg: DoveMessage): Promise<void> {
    if (!msg || !msg.type) return;

    // PASSIVE：Extension 的响应，从 pendingPool 找到对应 resolve 并返回
    if (msg.mode === DoveMode.PASSIVE) {
      const pending = this.pendingPool.get(msg.key);
      if (pending) {
        this.pendingPool.delete(msg.key);
        pending.resolve(msg.data);
      }
      return;
    }

    // INITIATIVE 且无 pending：Extension 主动推送，执行订阅的回调并回传结果
    const callbacks = this.subscribePool.get(msg.type) || [];
    let result: any;
    for (const cb of callbacks) {
      result = await cb(msg.data);
    }
    vscode.postMessage({
      key: msg.key,
      type: msg.type,
      mode: DoveMode.PASSIVE,
      data: result,
    });
  }

  // 订阅某类消息，当 Extension 推送该类型时执行 callback，返回取消订阅函数
  subscribe(type: MsgType, callback: SubscribeCallback): () => void {
    const list = this.subscribePool.get(type) || [];
    list.push(callback);
    this.subscribePool.set(type, list);
    return () => {
      const current = this.subscribePool.get(type) || [];
      this.subscribePool.set(type, current.filter((cb) => cb !== callback));
    };
  }
}

export const dove = new DoveClient();

// React Hook：订阅消息，组件卸载时自动取消
export function useDoveSubscribe(type: MsgType, callback: SubscribeCallback): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    return dove.subscribe(type, (data) => cbRef.current(data));
  }, [type]);
}
