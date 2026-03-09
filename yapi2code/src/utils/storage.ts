import * as vscode from 'vscode';

let globalState: vscode.Memento;

export function initStorage(context: vscode.ExtensionContext): void {
  globalState = context.globalState;
}

export function getStorage<T>(key: string): T | undefined {
  return globalState?.get<T>(key);
}

export function setStorage<T>(key: string, value: T): Thenable<void> {
  return globalState.update(key, value);
}

export function removeStorage(key: string): Thenable<void> {
  return globalState.update(key, undefined);
}
