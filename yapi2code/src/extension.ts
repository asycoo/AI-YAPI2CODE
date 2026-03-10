/**
 * VSCode 扩展入口
 * activate：扩展被激活时调用（如用户打开左侧面板）
 * deactivate：扩展被卸载/禁用时调用
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { WebviewProvider } from './webview/WebviewProvider';
import { registerMessageHandlers } from './core/messageHandler';
import { initStorage } from './utils/storage';
import { initRequest, clearCookie, getServerUrl } from './services/request';
import { getStorage } from './utils/storage';
import { StorageKey, YTT_FILENAME } from './constants/config';
import { MsgType } from './constants/msgType';
import { Dove } from './utils/dove';
import { ApiHoverProvider } from './core/hoverProvider';
import { lookupByFnName } from './core/apiIndex';
import { generateCode } from './core/typeGenerator';
import * as yapiApi from './services/yapiApi';

let currentDove: Dove | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // 初始化持久化存储，用于保存登录态、cookie 等
  initStorage(context);

  // 恢复上次保存的 YAPI 服务器地址，用于发请求
  const savedUrl = getStorage<string>(StorageKey.SERVER_URL);
  if (savedUrl) {
    initRequest(savedUrl);
  }

  // 创建 Webview 提供者，负责在侧边栏渲染 React 页面
  const webviewProvider = new WebviewProvider(context.extensionUri);

  // 当 Webview 挂载完成后，拿到 dove 通信实例，注册所有消息处理器
  webviewProvider.onDidMount((dove) => {
    currentDove = dove;
    registerMessageHandlers(dove);
  });

  // Webview 关闭时清理引用
  webviewProvider.onUnMount(() => {
    currentDove = undefined;
  });

  // 将 Webview 注册到 VSCode 侧边栏，viewType 需与 package.json 中 contributes.views 一致
  // retainContextWhenHidden: 隐藏时保留上下文，避免切换面板时页面重新加载
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebviewProvider.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  // 注册命令：可在命令面板、快捷键、右键菜单中触发
  context.subscriptions.push(
    vscode.commands.registerCommand('yapi2code.refresh', () => {
      currentDove?.sendMessage(MsgType.REFRESH_CONFIG);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('yapi2code.logout', async () => {
      clearCookie();
      vscode.window.showInformationMessage('已退出登录');
      currentDove?.sendMessage(MsgType.LOGOUT);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('yapi2code.editConfig', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders) {
        vscode.window.showErrorMessage('请先打开工作区');
        return;
      }
      const configPath = vscode.Uri.joinPath(folders[0].uri, YTT_FILENAME);
      try {
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showErrorMessage(`未找到 ${YTT_FILENAME} 文件`);
      }
    })
  );

  // 悬浮提示：鼠标悬停在 TS/TSX/JS/JSX 文件中的 API 函数名上时显示接口信息
  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      [
        { scheme: 'file', language: 'typescript' },
        { scheme: 'file', language: 'typescriptreact' },
        { scheme: 'file', language: 'javascript' },
        { scheme: 'file', language: 'javascriptreact' },
      ],
      new ApiHoverProvider()
    )
  );

  // Hover action: generate types to new file
  context.subscriptions.push(
    vscode.commands.registerCommand('yapi2code.hoverGenerate', async (args: { id: number; fnName: string }) => {
      try {
        const res = await yapiApi.getInterfaceDetail(args.id);
        if (res.errcode !== 0) {
          vscode.window.showErrorMessage(res.errmsg || '获取接口详情失败');
          return;
        }
        const config = vscode.workspace.getConfiguration('yapi2code');
        const importStatement = config.get<string>('importStatement') || "import request from '@/utils/request';";
        const code = generateCode(res.data, importStatement);

        const folders = vscode.workspace.workspaceFolders;
        if (!folders) return;
        const outputPath = config.get<string>('outputPath') || 'src/api';
        const dir = path.join(folders[0].uri.fsPath, outputPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const filePath = path.join(dir, `${code.fnName}.ts`);
        fs.writeFileSync(filePath, code.fullCode, 'utf-8');
        const doc = await vscode.workspace.openTextDocument(filePath);
        await vscode.window.showTextDocument(doc);
      } catch (err: any) {
        vscode.window.showErrorMessage(err.message);
      }
    })
  );

  // Hover action: insert type definitions at cursor
  context.subscriptions.push(
    vscode.commands.registerCommand('yapi2code.hoverInsert', async (args: { id: number; fnName: string }) => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showErrorMessage('没有活动的编辑器');
        return;
      }
      try {
        const res = await yapiApi.getInterfaceDetail(args.id);
        if (res.errcode !== 0) {
          vscode.window.showErrorMessage(res.errmsg || '获取接口详情失败');
          return;
        }
        const config = vscode.workspace.getConfiguration('yapi2code');
        const importStatement = config.get<string>('importStatement') || "import request from '@/utils/request';";
        const code = generateCode(res.data, importStatement);

        const typeParts: string[] = [];
        if (code.reqQueryType) typeParts.push(code.reqQueryType);
        if (code.reqBodyType) typeParts.push(code.reqBodyType);
        if (code.resDataType) {
          typeParts.push(code.resDataType);
        } else if (code.resBodyType) {
          typeParts.push(code.resBodyType);
        }

        if (typeParts.length === 0) {
          vscode.window.showInformationMessage('该接口没有可生成的类型定义');
          return;
        }

        const typeCode = typeParts.join('\n\n') + '\n';
        await editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, typeCode);
        });
      } catch (err: any) {
        vscode.window.showErrorMessage(err.message);
      }
    })
  );

  // 监听 ytt.json 文件变化，修改后通知 Webview 刷新配置，并弹出提示
  const notifyYttChanged = () => {
    vscode.window.withProgress(
      { location: vscode.ProgressLocation.Notification, cancellable: false },
      async (progress) => {
        progress.report({ message: '😊 ytt.json 配置文件已更新' });
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    );
    currentDove?.sendMessage(MsgType.REFRESH_CONFIG);
  };
  const watcher = vscode.workspace.createFileSystemWatcher(`**/${YTT_FILENAME}`);
  watcher.onDidChange(notifyYttChanged);
  watcher.onDidCreate(notifyYttChanged);
  context.subscriptions.push(watcher);

  // 监听输出目录（src/api/*.ts）的增删改，用于同步绿勾状态（如删除文件后绿勾消失）
  const outputConfig = vscode.workspace.getConfiguration('yapi2code');
  const outputPath = outputConfig.get<string>('outputPath') || 'src/api';
  const outputWatcher = vscode.workspace.createFileSystemWatcher(`**/${outputPath}/*.ts`);
  const notifyFilesChanged = () => {
    currentDove?.sendMessage(MsgType.GENERATED_FILES_CHANGED);
  };
  outputWatcher.onDidCreate(notifyFilesChanged);
  outputWatcher.onDidDelete(notifyFilesChanged);
  outputWatcher.onDidChange(notifyFilesChanged);
  context.subscriptions.push(outputWatcher);
}

export function deactivate(): void {
  currentDove?.dispose();
}
