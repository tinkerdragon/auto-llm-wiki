import { applyChangePlan, ensureMarkdownPath, isRawPath } from "../src/vaultOps";
import { DEFAULT_SETTINGS } from "../src/settings";

test("detects raw paths", () => {
  expect(isRawPath("raw/source.md", DEFAULT_SETTINGS)).toBe(true);
  expect(isRawPath("wiki/page.md", DEFAULT_SETTINGS)).toBe(false);
});

test("requires markdown file extension", () => {
  expect(ensureMarkdownPath("wiki/page.md")).toBe("wiki/page.md");
  expect(() => ensureMarkdownPath("wiki/page.txt")).toThrow("Markdown files");
});

test("creates missing parent folders before creating files", async () => {
  const createdFolders: string[] = [];
  const createdFiles: Array<{ path: string; content: string }> = [];
  const existing = new Set<string>();
  const app = {
    vault: {
      getAbstractFileByPath: (path: string) => existing.has(path) ? { path } : null,
      createFolder: async (path: string) => {
        createdFolders.push(path);
        existing.add(path);
      },
      create: async (path: string, content: string) => {
        createdFiles.push({ path, content });
      }
    }
  };

  await applyChangePlan(app as never, {
    summary: "Create nested page",
    operations: [{ kind: "create", path: "wiki/topics/page.md", content: "# Page", rationale: "test" }]
  });

  expect(createdFolders).toEqual(["wiki", "wiki/topics"]);
  expect(createdFiles).toEqual([{ path: "wiki/topics/page.md", content: "# Page" }]);
});
