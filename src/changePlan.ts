import { t } from "./i18n";
import { ChangePlan, FileOperation, LLMWikiSettings } from "./types";

const ALLOWED_KINDS = new Set(["create", "update", "append", "prepend", "delete"]);

export function parseChangePlan(text: string): ChangePlan {
  const parsed = extractJsonObject(text);
  if (!isRecord(parsed) || typeof parsed.summary !== "string" || !Array.isArray(parsed.operations)) {
    throw new Error(t("error.invalidChangePlanShape"));
  }
  const operations = parsed.operations.map(assertOperationShape);
  return { summary: parsed.summary, operations };
}

// Tolerate prose around the JSON: strip a whole-string code fence, else fall back to the
// outermost {...} object so a chatty model reply still yields a parseable change plan.
function extractJsonObject(text: string): unknown {
  const stripped = stripFences(text.trim());
  try {
    return JSON.parse(stripped);
  } catch {
    const start = stripped.indexOf("{");
    const end = stripped.lastIndexOf("}");
    if (start < 0 || end <= start) return undefined;
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

export function validateChangePlan(plan: ChangePlan, settings: LLMWikiSettings): ChangePlan {
  validateSettingsPaths(settings);
  for (const operation of plan.operations) {
    const normalized = normalizePath(operation.path);
    if (normalized !== operation.path) {
      throw new Error(t("error.unsafePath", { path: operation.path }));
    }
    if (!isAllowedWritePath(normalized, settings)) {
      throw new Error(t("error.pathOutsideWiki", { path: operation.path }));
    }
    if (isReadOnlyPath(normalized, settings)) {
      throw new Error(t("error.pathInsideReadOnly", { path: operation.path }));
    }
  }
  return plan;
}

export function normalizePath(path: string): string {
  if (path.startsWith("/") || path.includes("\\")) {
    throw new Error(t("error.unsafePath", { path }));
  }
  const parts: string[] = [];
  for (const part of path.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") throw new Error(t("error.unsafePath", { path }));
    parts.push(part);
  }
  return parts.join("/");
}

function stripFences(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function assertOperationShape(operation: unknown): FileOperation {
  if (!isRecord(operation) || typeof operation.kind !== "string" || !ALLOWED_KINDS.has(operation.kind)) {
    throw new Error(t("error.invalidOperationKind"));
  }
  const kind = operation.kind as FileOperation["kind"];
  if (typeof operation.path !== "string") throw new Error(t("error.invalidOperationPath"));
  // delete has nothing to write, so its content is optional (defaults to empty).
  if (kind !== "delete" && typeof operation.content !== "string") throw new Error(t("error.invalidOperationContent"));
  if (typeof operation.rationale !== "string") throw new Error(t("error.invalidOperationRationale"));
  return {
    kind,
    path: operation.path,
    content: typeof operation.content === "string" ? operation.content : "",
    rationale: operation.rationale
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validateSettingsPaths(settings: LLMWikiSettings): void {
  const wikiFolder = normalizePath(settings.wikiFolder);
  const indexPath = normalizePath(settings.indexPath);
  const logPath = normalizePath(settings.logPath);

  if (!isInsideFolder(indexPath, wikiFolder)) {
    throw new Error(t("error.indexOutsideWiki"));
  }
  if (!isInsideFolder(logPath, wikiFolder)) {
    throw new Error(t("error.logOutsideWiki"));
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
