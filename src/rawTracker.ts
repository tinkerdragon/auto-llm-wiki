import { App, TFile } from "obsidian";
import { LLMWikiSettings } from "./types";
import { normalizePath } from "./changePlan";
import { t } from "./i18n";
import { isImageRawPath, isPdfRawPath, isSupportedRawPath, readRawFileWithParser } from "./rawParsers";
import type { ImageOcrProvider, PdfOcrProvider, PdfPage } from "./rawParsers";

export interface ChangedRawFile {
  path: string;
  content: string;
  hash: string;
}

export type { ImageOcrProvider, ImageOcrRequest, PdfOcrProvider, PdfOcrRequest } from "./rawParsers";

export async function renderPdfPageToPngDataUrl(page: PdfPage, scale = 2): Promise<string> {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error(t("error.renderPdfPageForOcr"));
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export type RawFileState = Record<string, string>;

interface RawCandidateFile {
  path: string;
}

export interface RawFileCandidates<T extends RawCandidateFile = RawCandidateFile> {
  sourceFiles: T[];
  pdfPaths: string[];
}

export function hashContent(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index++) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function hashBinaryContent(buffer: ArrayBuffer): string {
  let hash = 2166136261;
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function findRawFileCandidates<T extends RawCandidateFile>(files: T[], settings: LLMWikiSettings): RawFileCandidates<T> {
  const rawFolder = normalizePath(settings.rawFolder);
  const sourceFiles = files.filter((file) => file.path.startsWith(`${rawFolder}/`) && isSupportedRawPath(file.path));
  return {
    sourceFiles,
    pdfPaths: sourceFiles.filter((file) => isPdfRawPath(file.path)).map((file) => file.path)
  };
}

export async function findChangedRawFiles(
  app: App,
  settings: LLMWikiSettings,
  state: RawFileState,
  onPdfExtract?: (path: string) => void,
  pdfOcrProvider?: PdfOcrProvider,
  imageOcrProvider?: ImageOcrProvider
): Promise<ChangedRawFile[]> {
  const rawFiles = findRawFileCandidates(app.vault.getFiles(), settings).sourceFiles;

  const changedFiles: ChangedRawFile[] = [];
  for (const file of rawFiles) {
    if (isImageRawPath(file.path) || isPdfRawPath(file.path)) {
      const binaryBuffer = await app.vault.readBinary(file as TFile);
      const hash = hashBinaryContent(binaryBuffer);
      if (state[file.path] === hash) continue;
      const content = await readRawFileContent(app, file as TFile, onPdfExtract, pdfOcrProvider, imageOcrProvider);
      changedFiles.push({ path: file.path, content, hash });
      continue;
    }

    const content = await readRawFileContent(app, file as TFile, onPdfExtract, pdfOcrProvider, imageOcrProvider);
    const hash = hashContent(content);
    if (state[file.path] !== hash) {
      changedFiles.push({ path: file.path, content, hash });
    }
  }
  return changedFiles;
}

async function readRawFileContent(
  app: App,
  file: TFile,
  onPdfExtract?: (path: string) => void,
  pdfOcrProvider?: PdfOcrProvider,
  imageOcrProvider?: ImageOcrProvider
): Promise<string> {
  return readRawFileWithParser(app, file, { onPdfExtract, pdfOcrProvider, imageOcrProvider });
}

export function updateRawFileState(state: RawFileState, files: ChangedRawFile[]): RawFileState {
  const nextState = { ...state };
  for (const file of files) {
    nextState[file.path] = file.hash;
  }
  return nextState;
}
