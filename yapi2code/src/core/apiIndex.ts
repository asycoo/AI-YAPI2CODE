import { getApiName } from './typeGenerator';

export interface ApiIndexEntry {
  id: number;
  title: string;
  path: string;
  method: string;
  projectId: number;
  fnName: string;
}

const fnNameIndex = new Map<string, ApiIndexEntry>();

export function clearIndex(): void {
  fnNameIndex.clear();
}

export function addToIndex(
  item: { _id: number; title: string; path: string; method: string },
  projectId: number
): void {
  const fnName = getApiName(item.path);
  fnNameIndex.set(fnName, {
    id: item._id,
    title: item.title,
    path: item.path,
    method: item.method,
    projectId,
    fnName,
  });
}

export function lookupByFnName(name: string): ApiIndexEntry | undefined {
  return fnNameIndex.get(name);
}

export function getAllFnNames(): string[] {
  return Array.from(fnNameIndex.keys());
}
