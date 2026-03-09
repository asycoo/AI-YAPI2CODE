import * as vscode from 'vscode';
import { lookupByFnName, getAllFnNames, ApiIndexEntry } from './apiIndex';
import { getServerUrl } from '../services/request';

export class ApiHoverProvider implements vscode.HoverProvider {
  provideHover(
    document: vscode.TextDocument,
    position: vscode.Position
  ): vscode.Hover | undefined {
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_$][a-zA-Z0-9_$]*/);
    if (!wordRange) return undefined;

    const word = document.getText(wordRange);
    const entry = lookupByFnName(word);
    if (!entry) return undefined;

    const md = buildHoverMarkdown(entry);
    return new vscode.Hover(md, wordRange);
  }
}

function buildHoverMarkdown(entry: ApiIndexEntry): vscode.MarkdownString {
  const serverUrl = getServerUrl();
  const yapiLink = serverUrl
    ? `${serverUrl}/project/${entry.projectId}/interface/api/${entry.id}`
    : '';

  const md = new vscode.MarkdownString();
  md.isTrusted = true;
  md.supportHtml = true;

  md.appendMarkdown(`**${entry.title}**\n\n`);
  md.appendMarkdown(`\`${entry.method.toUpperCase()}\` \`${entry.path}\`\n\n`);

  if (yapiLink) {
    md.appendMarkdown(`[在 YAPI 中查看](${yapiLink})\n\n`);
  }

  md.appendMarkdown('---\n\n');

  const genUri = vscode.Uri.parse(
    `command:yapi2code.hoverGenerate?${encodeURIComponent(JSON.stringify({ id: entry.id, fnName: entry.fnName }))}`
  );
  const insertUri = vscode.Uri.parse(
    `command:yapi2code.hoverInsert?${encodeURIComponent(JSON.stringify({ id: entry.id, fnName: entry.fnName }))}`
  );

  md.appendMarkdown(`[$(file-add) 生成类型到新文件](${genUri}) &nbsp;&nbsp; `);
  md.appendMarkdown(`[$(edit) 插入类型到光标](${insertUri})`);

  return md;
}
