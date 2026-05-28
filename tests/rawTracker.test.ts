import { findChangedRawFiles, hashContent } from "../src/rawTracker";
import { DEFAULT_SETTINGS } from "../src/settings";

test("hashContent changes when file content changes", () => {
  expect(hashContent("alpha")).toBe(hashContent("alpha"));
  expect(hashContent("alpha")).not.toBe(hashContent("beta"));
});

test("findChangedRawFiles returns new and changed markdown files only", async () => {
  const files = [
    { path: "raw/new.md" },
    { path: "raw/changed.md" },
    { path: "raw/unchanged.md" },
    { path: "wiki/page.md" },
    { path: "raw/image.png" }
  ];
  const contentByPath: Record<string, string> = {
    "raw/new.md": "new",
    "raw/changed.md": "changed-v2",
    "raw/unchanged.md": "same",
    "wiki/page.md": "wiki",
    "raw/image.png": "binary"
  };
  const app = {
    vault: {
      getMarkdownFiles: () => files,
      read: async (file: { path: string }) => contentByPath[file.path]
    }
  };
  const state = {
    "raw/changed.md": hashContent("changed-v1"),
    "raw/unchanged.md": hashContent("same")
  };

  const changed = await findChangedRawFiles(app as never, DEFAULT_SETTINGS, state);

  expect(changed).toEqual([
    { path: "raw/new.md", content: "new", hash: hashContent("new") },
    { path: "raw/changed.md", content: "changed-v2", hash: hashContent("changed-v2") }
  ]);
});
