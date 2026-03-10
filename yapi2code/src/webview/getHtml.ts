import * as vscode from 'vscode';

/**
 * 生成 Webview 的 HTML 内容
 * Webview 运行在沙箱环境，无法直接访问本地文件，必须通过 asWebviewUri 转换后加载
 */
export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  // 资源路径：指向 vite 构建输出的 dist/webview 目录
  const distUri = vscode.Uri.joinPath(extensionUri, 'dist', 'webview');
  // asWebviewUri：将扩展内的文件 URI 转为 Webview 可加载的 https URI
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'main.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distUri, 'main.css'));

  // CSP 要求：script 必须带 nonce，防止内联脚本注入
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <!-- 内容安全策略：限制可加载的资源，script 需匹配 nonce 才能执行 -->
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https:;">
  <link href="${styleUri}" rel="stylesheet">
  <title>YAPI to Code</title>
</head>
<body>
  <!-- React 挂载点 -->
  <div id="root"></div>
  <!-- 加载打包后的 main.js，nonce 需与 CSP 一致 -->
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
