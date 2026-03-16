/**
 * 消息处理器：为 Dove 注册各 MsgType 的订阅
 * Webview 调用 dove.sendMessage(MsgType.XXX, data) 时，对应 handler 执行并返回结果
 */
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { Dove } from '../utils/dove';
import { MsgType } from '../constants/msgType';
import { StorageKey, YTT_FILENAME } from '../constants/config';
import { getStorage, setStorage, removeStorage } from '../utils/storage';
import { initRequest, setServerUrl, getServerUrl, clearCookie } from '../services/request';
import * as yapiApi from '../services/yapiApi';
import { generateCode, getApiName } from './typeGenerator';
import { addToIndex, clearIndex } from './apiIndex';

export function registerMessageHandlers(dove: Dove): void {
  dove.subscribe(MsgType.WEBVIEW_READY, async () => {
    const serverUrl = getStorage<string>(StorageKey.SERVER_URL) || '';
    if (serverUrl) {
      initRequest(serverUrl);
    }
    return {};
  });

  dove.subscribe(MsgType.INIT_CONFIG, async () => {
    const serverUrl = getStorage<string>(StorageKey.SERVER_URL) || '';
    const loginByLdap = getStorage<boolean>(StorageKey.LOGIN_BY_LDAP) || false;
    const credentials = getStorage<{ email: string }>(StorageKey.LOGIN_CREDENTIALS);
    return {
      serverUrl,
      loginByLdap,
      email: credentials?.email || '',
    };
  });

  dove.subscribe(MsgType.SERVER_URL, async (data: { url: string }) => {
    setServerUrl(data.url);
    initRequest(data.url);
    return { success: true };
  });

  dove.subscribe(MsgType.LOGIN_NOW, async (data: { email: string; password: string }) => {
    try {
      const res = await yapiApi.login(data.email, data.password);
      if (res.errcode === 0) {
        await setStorage(StorageKey.USER_INFO, res.data);
        await setStorage(StorageKey.LOGIN_CREDENTIALS, { email: data.email });
        return { success: true, data: res.data };
      }
      return { success: false, message: res.errmsg };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.LOGIN_BY_LDAP, async (data: { email: string; password: string }) => {
    try {
      const res = await yapiApi.loginByLdap(data.email, data.password);
      if (res.errcode === 0) {
        await setStorage(StorageKey.USER_INFO, res.data);
        await setStorage(StorageKey.LOGIN_BY_LDAP, true);
        await setStorage(StorageKey.LOGIN_CREDENTIALS, { email: data.email });
        return { success: true, data: res.data };
      }
      return { success: false, message: res.errmsg };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.LOGIN_STATUS, async () => {
    try {
      const res = await yapiApi.getLoginStatus();
      return { loggedIn: res.errcode === 0, data: res.data };
    } catch {
      return { loggedIn: false };
    }
  });

  dove.subscribe(MsgType.LOGOUT, async () => {
    clearCookie();
    await removeStorage(StorageKey.COOKIE);
    await removeStorage(StorageKey.USER_INFO);
    return { success: true };
  });

  dove.subscribe(MsgType.YAPI_CONFIG_DATA, async () => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return { hasConfig: false, configs: [] };

    const configPath = path.join(workspaceRoot, YTT_FILENAME);
    if (!fs.existsSync(configPath)) return { hasConfig: false, configs: [] };

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const configs = JSON.parse(content);
      return { hasConfig: true, configs };
    } catch {
      return { hasConfig: false, configs: [] };
    }
  });

  dove.subscribe(MsgType.CREATE_YTT_CONFIG, async () => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return { success: false };
    }

    const configPath = path.join(workspaceRoot, YTT_FILENAME);
    const template = JSON.stringify(
      [{ projectId: 0, token: '' }],
      null,
      2
    );

    fs.writeFileSync(configPath, template, 'utf-8');
    const doc = await vscode.workspace.openTextDocument(configPath);
    await vscode.window.showTextDocument(doc);
    return { success: true, path: configPath };
  });

  dove.subscribe(MsgType.REFRESH_CONFIG, async () => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return { hasConfig: false, configs: [] };

    const configPath = path.join(workspaceRoot, YTT_FILENAME);
    if (!fs.existsSync(configPath)) return { hasConfig: false, configs: [] };

    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const configs = JSON.parse(content);
      return { hasConfig: true, configs };
    } catch {
      return { hasConfig: false, configs: [] };
    }
  });

  dove.subscribe(MsgType.FETCH_PROJECT, async (data: { projectId: number; token: string }) => {
    try {
      const res = await yapiApi.getProjectInfo(data.projectId, data.token);
      console.log('project', res)
      return res.errcode === 0 ? { success: true, data: res.data } : { success: false, message: res.errmsg };
    } catch (err: any) {
      console.log('projectEee', err)
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.FETCH_INTERFACE_MENU, async (data: { projectId: number; token: string }) => {
    try {
      const res = await yapiApi.getInterfaceMenu(data.projectId, data.token);
      if (res.errcode === 0 && res.data) {
        for (const cat of res.data) {
          for (const item of cat.list || []) {
            addToIndex(item, data.projectId);
          }
        }
      }
      return res.errcode === 0 ? { success: true, data: res.data } : { success: false, message: res.errmsg };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.FETCH_DETAIL, async (data: { id: number }) => {
    try {
      const res = await yapiApi.getInterfaceDetail(data.id);
      return res.errcode === 0 ? { success: true, data: res.data } : { success: false, message: res.errmsg };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.GENERATE_CODE, async (data: { id: number }) => {
    try {
      const res = await yapiApi.getInterfaceDetail(data.id);
      if (res.errcode !== 0) return { success: false, message: res.errmsg };

      const config = vscode.workspace.getConfiguration('yapi2code');
      const importStatement = config.get<string>('importStatement') || "import request from '@/utils/request';";
      const code = generateCode(res.data, importStatement);
      return { success: true, data: code };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  });

  dove.subscribe(MsgType.COPY_CODE, async (data: { code: string }) => {
    await vscode.env.clipboard.writeText(data.code);
    vscode.window.showInformationMessage('代码已复制到剪贴板');
    return { success: true };
  });

  dove.subscribe(MsgType.INSERT_CODE, async (data: { code: string }) => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      vscode.window.showErrorMessage('没有活动的编辑器');
      return { success: false };
    }
    await editor.edit((editBuilder) => {
      editBuilder.insert(editor.selection.active, data.code);
    });
    return { success: true };
  });

  dove.subscribe(MsgType.SHOW_CODE, async (data: { code: string; fileName?: string }) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return { success: false };

    const config = vscode.workspace.getConfiguration('yapi2code');
    const outputPath = config.get<string>('outputPath') || 'src/api';
    const dir = path.join(workspaceRoot, outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileName = data.fileName || 'api.ts';
    const filePath = path.join(dir, fileName);
    fs.writeFileSync(filePath, data.code, 'utf-8');
    const doc = await vscode.workspace.openTextDocument(filePath);
    await vscode.window.showTextDocument(doc);
    return { success: true, path: filePath };
  });

  dove.subscribe(MsgType.OPEN_EXTERNAL_LINK, async (data: { url: string }) => {
    await vscode.env.openExternal(vscode.Uri.parse(data.url));
    return { success: true };
  });

  dove.subscribe(MsgType.GET_WORKSPACE_ROOT, async () => {
    return { root: getWorkspaceRoot() || '' };
  });

  dove.subscribe(MsgType.SET_STORAGE, async (data: { key: string; value: any }) => {
    await setStorage(data.key, data.value);
    return { success: true };
  });

  dove.subscribe(MsgType.GET_STORAGE, async (data: { key: string }) => {
    return { value: getStorage(data.key) };
  });

  dove.subscribe(MsgType.EDIT_YTT_CONFIG, async () => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('请先打开工作区');
      return { success: false };
    }
    const configPath = path.join(workspaceRoot, YTT_FILENAME);
    try {
      const doc = await vscode.workspace.openTextDocument(configPath);
      await vscode.window.showTextDocument(doc);
      return { success: true };
    } catch {
      vscode.window.showErrorMessage(`未找到 ${YTT_FILENAME} 文件`);
      return { success: false };
    }
  });

  dove.subscribe(MsgType.BATCH_GENERATE_CODE, async (data: { ids: number[] }) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return { success: false, message: '请先打开工作区' };

    const config = vscode.workspace.getConfiguration('yapi2code');
    const outputPath = config.get<string>('outputPath') || 'src/api';
    const importStatement = config.get<string>('importStatement') || "import request from '@/utils/request';";
    const dir = path.join(workspaceRoot, outputPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    let successCount = 0;
    for (const id of data.ids) {
      try {
        const res = await yapiApi.getInterfaceDetail(id);
        if (res.errcode === 0) {
          const code = generateCode(res.data, importStatement);
          const filePath = path.join(dir, `${code.fnName}.ts`);
          fs.writeFileSync(filePath, code.fullCode, 'utf-8');
          successCount++;
        }
      } catch {
        // skip failed items
      }
    }

    vscode.window.showInformationMessage(`已生成 ${successCount} 个接口文件`);
    // 在 VS Code 的“资源管理器”（侧边栏的文件树）中，自动定位并高亮显示指定的文件夹。
    const dirUri = vscode.Uri.file(dir);
    vscode.commands.executeCommand('revealInExplorer', dirUri);

    return { success: true, count: successCount };
  });

  dove.subscribe(MsgType.CHECK_GENERATED_FILES, async (data: { items: { id: number; path: string }[] }) => {
    const workspaceRoot = getWorkspaceRoot();
    if (!workspaceRoot) return { generated: {} };

    const config = vscode.workspace.getConfiguration('yapi2code');
    const outputPath = config.get<string>('outputPath') || 'src/api';
    const dir = path.join(workspaceRoot, outputPath);

    const generated: Record<number, string> = {};
    for (const item of data.items) {
      const fnName = getApiName(item.path);
      const filePath = path.join(dir, `${fnName}.ts`);
      if (fs.existsSync(filePath)) {
        generated[item.id] = filePath;
      }
    }
    return { generated };
  });

  dove.subscribe(MsgType.OPEN_GENERATED_FILE, async (data: { filePath: string }) => {
    try {
      const doc = await vscode.workspace.openTextDocument(data.filePath);
      await vscode.window.showTextDocument(doc);
      return { success: true };
    } catch {
      vscode.window.showErrorMessage('无法打开文件');
      return { success: false };
    }
  });
}

function getWorkspaceRoot(): string | undefined {
  const folders = vscode.workspace.workspaceFolders;
  return folders?.[0]?.uri.fsPath;
}
