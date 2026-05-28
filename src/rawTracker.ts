import { App, TFile } from "obsidian";
import { LLMWikiSettings } from "./types";
import { normalizePath } from "./changePlan";

export interface ChangedRawFile {
  path: string;
  content: string;
  hash: string;
}

export type RawFileState = Record<string, string>;

export function hashContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index++) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export async function findChangedRawFiles(
  app: App,
  settings: LLMWikiSettings,
  state: RawFileState
): Promise<ChangedRawFile[]> {
  const rawFolder = normalizePath(settings.rawFolder);
  const rawFiles = app.vault.getMarkdownFiles()
    .filter((file) => file.path.startsWith(`${rawFolder}/`) && file.path.endsWith(".md"));

  const changedFiles: ChangedRawFile[] = [];
  for (const file of rawFiles) {
    const content = await app.vault.read(file as TFile);
    const hash = hashContent(content);
    if (state[file.path] !== hash) {
      changedFiles.push({ path: file.path, content, hash });
    }
  }
  return changedFiles;
}

export function updateRawFileState(state: RawFileState, files: ChangedRawFile[]): RawFileState {
  const nextState = { ...state };
  for (const file of files) {
    nextState[file.path] = file.hash;
  }
  return nextState;
}
