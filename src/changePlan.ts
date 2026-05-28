import { ChangePlan, FileOperation, LLMWikiSettings } from "./types";

const ALLOWED_KINDS = new Set(["create", "update", "append"]);

export function parseChangePlan(text: string): ChangePlan {
  const json = stripFences(text.trim());
  const parsed = JSON.parse(json) as ChangePlan;
  if (typeof parsed.summary !== "string" || !Array.isArray(parsed.operations)) {
    throw new Error("Invalid change plan shape");
  }
  parsed.operations.forEach(assertOperationShape);
  return parsed;
}

export function validateChangePlan(plan: ChangePlan, settings: LLMWikiSettings): ChangePlan {
  validateSettingsPaths(settings);
  for (const operation of plan.operations) {
    const normalized = normalizePath(operation.path);
    if (normalized !== operation.path) {
      throw new Error(`Unsafe path: ${operation.path}`);
    }
    if (!isAllowedWritePath(normalized, settings)) {
      throw new Error(`Operation path is outside wiki folder: ${operation.path}`);
    }
    if (isReadOnlyPath(normalized, settings)) {
      throw new Error(`Operation path is inside a read-only folder: ${operation.path}`);
    }
  }
  return plan;
}

export function normalizePath(path: string): string {
  if (path.startsWith("/") || path.includes("\\")) {
    throw new Error(`Unsafe path: ${path}`);
  }
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") throw new Error(`Unsafe path: ${path}`);
    parts.push(part);
  }
  return parts.join("/");
}

function stripFences(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function assertOperationShape(operation: FileOperation): void {
  if (!ALLOWED_KINDS.has(operation.kind)) throw new Error("Invalid operation kind");
  if (typeof operation.path !== "string") throw new Error("Invalid operation path");
  if (typeof operation.content !== "string") throw new Error("Invalid operation content");
  if (typeof operation.rationale !== "string") throw new Error("Invalid operation rationale");
}

function validateSettingsPaths(settings: LLMWikiSettings): void {
  const wikiFolder = normalizePath(settings.wikiFolder);
  const indexPath = normalizePath(settings.indexPath);
  const logPath = normalizePath(settings.logPath);

  if (!isInsideFolder(indexPath, wikiFolder)) {
    throw new Error("Index path must be inside the wiki folder");
  }
  if (!isInsideFolder(logPath, wikiFolder)) {
    throw new Error("Log path must be inside the wiki folder");
  }
}

function isAllowedWritePath(path: string, settings: LLMWikiSettings): boolean {
  const wikiFolder = normalizePath(settings.wikiFolder);
  return isInsideFolder(path, wikiFolder);
}

function isReadOnlyPath(path: string, settings: LLMWikiSettings): boolean {
  return isInsideFolder(path, normalizePath(settings.rawFolder)) ||
    isInsideFolder(path, normalizePath(settings.assetsFolder));
}

function isInsideFolder(path: string, folder: string): boolean {
  return path.startsWith(`${folder}/`);
}
