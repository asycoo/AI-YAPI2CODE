/**
 * WebviewViewProvider：在 VSCode 侧边栏提供可嵌入的 Web 视图
 * 用户点击活动栏图标时，VSCode 调用 resolveWebviewView 初始化
 */
import * as vscode from 'vscode';
import { Dove } from '../utils/dove';
import { DoveMessage } from '../constants/msgType';
import { getWebviewHtml } from './getHtml';

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'yapi2code.view';

  private _view?: vscode.WebviewView;
  private _dove?: Dove;
  private _onDidMount = new vscode.EventEmitter<Dove>();
  private _onUnMount = new vscode.EventEmitter<void>();

  public onDidMount = this._onDidMount.event;
  public onUnMount = this._onUnMount.event;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    // 允许脚本执行、command: 链接，并指定可加载的本地资源目录
    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
      ],
    };

    // Dove：Extension 端通信实例，收到 Webview 消息后处理并 postMessage 回传
    this._dove = new Dove((msg: DoveMessage) => {
      webviewView.webview.postMessage(msg);
    });

    // 接收 Webview 发来的消息，交给 Dove 处理
    webviewView.webview.onDidReceiveMessage((msg: DoveMessage) => {
      this._dove?.receiveMessage(msg);
    });

    // 设置 HTML 内容，内部会加载 main.js（React 入口）
    webviewView.webview.html = getWebviewHtml(webviewView.webview, this._extensionUri);

    this._onDidMount.fire(this._dove);

    webviewView.onDidDispose(() => {
      this._dove?.dispose();
      this._dove = undefined;
      this._onUnMount.fire();
    });
  }

  get dove(): Dove | undefined {
    return this._dove;
  }

  get view(): vscode.WebviewView | undefined {
    return this._view;
  }
}
