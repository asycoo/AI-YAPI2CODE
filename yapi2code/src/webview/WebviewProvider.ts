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

    webviewView.webview.options = {
      enableScripts: true,
      enableCommandUris: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview'),
      ],
    };

    this._dove = new Dove((msg: DoveMessage) => {
      webviewView.webview.postMessage(msg);
    });

    webviewView.webview.onDidReceiveMessage((msg: DoveMessage) => {
      this._dove?.receiveMessage(msg);
    });

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
