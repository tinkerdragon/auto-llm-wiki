import { ChangePlanPreviewModal } from "../src/previewModal";
import { Notice } from "obsidian";

const notices = (Notice as unknown as { messages: string[] }).messages;

beforeEach(() => {
  notices.length = 0;
});

test("applies critical shell width inline so modal widens without external CSS", () => {
  const modal = new ChangePlanPreviewModal({} as never, {
    summary: "Create page",
    operations: []
  });

  modal.onOpen();
  const modalEl = modal.modalEl as unknown as { classes: string[]; styles: Record<string, string> };

  expect(modalEl.classes).toContain("llm-wiki-review-modal-shell");
  expect(modalEl.styles.width).toBe("min(1120px, 96vw)");
  expect(modalEl.styles["max-width"]).toBe("1120px");
});

test("renders a polished card-based review layout", () => {
  const modal = new ChangePlanPreviewModal({} as never, {
    summary: "Integrate source notes",
    operations: [
      { kind: "create", path: "wiki/topic.md", content: "# Topic", rationale: "New topic page" },
      { kind: "append", path: "wiki/log.md", content: "log entry", rationale: "Record ingest" }
    ]
  });

  modal.onOpen();
  const contentEl = modal.contentEl as unknown as { classes: string[]; texts: string[] };

  expect(contentEl.classes).toEqual(expect.arrayContaining([
    "llm-wiki-review-modal",
    "llm-wiki-review-hero",
    "llm-wiki-review-stats",
    "llm-wiki-stat-chip",
    "llm-wiki-operation-card",
    "llm-wiki-operation-badge",
    "llm-wiki-path-pill",
    "llm-wiki-code-preview",
    "llm-wiki-action-bar"
  ]));
  expect(contentEl.texts).toEqual(expect.arrayContaining([
    "Review LLM Wiki changes",
    "Integrate source notes",
    "2 proposed file changes",
    "1 create",
    "1 append",
    "CREATE",
    "APPEND",
    "wiki/topic.md",
    "wiki/log.md"
  ]));
});

test("shows an empty-plan explanation when there are no proposed operations", () => {
  const modal = new ChangePlanPreviewModal({} as never, {
    summary: "",
    operations: []
  });

  modal.onOpen();
  const contentEl = modal.contentEl as unknown as { texts: string[] };

  expect(contentEl.texts).toContain("Review LLM Wiki changes");
  expect(contentEl.texts).toContain("No file changes were proposed by the model.");
  expect(contentEl.texts).toContain("0 proposed file changes");
});

test("updates status while applying changes and after success", async () => {
  const statuses: string[] = [];
  const app = {
    vault: {
      getAbstractFileByPath: () => null,
      createFolder: async () => {},
      create: async () => {}
    }
  };
  const modal = new ChangePlanPreviewModal(app as never, {
    summary: "Create page",
    operations: [{ kind: "create", path: "wiki/page.md", content: "# Page", rationale: "test" }]
  }, (message) => statuses.push(message));

  modal.onOpen();
  const contentEl = modal.contentEl as unknown as { buttons: Array<{ onclick: () => Promise<void> }> };
  await contentEl.buttons[0].onclick();

  expect(statuses).toEqual(["LLM Wiki: applying changes...", "LLM Wiki: applied"]);
});

test("updates status when applying changes fails", async () => {
  const statuses: string[] = [];
  const app = {
    vault: {
      getAbstractFileByPath: () => null,
      createFolder: async () => {},
      create: async () => {
        throw new Error("Folder does not exist");
      }
    }
  };
  const modal = new ChangePlanPreviewModal(app as never, {
    summary: "Create page",
    operations: [{ kind: "create", path: "wiki/page.md", content: "# Page", rationale: "test" }]
  }, (message) => statuses.push(message));

  modal.onOpen();
  const contentEl = modal.contentEl as unknown as { buttons: Array<{ onclick: () => Promise<void> }> };
  await contentEl.buttons[0].onclick();

  expect(statuses).toEqual([
    "LLM Wiki: applying changes...",
    "LLM Wiki: error - Folder does not exist"
  ]);
});

test("shows an error notice when applying changes fails", async () => {
  const app = {
    vault: {
      getAbstractFileByPath: () => null,
      createFolder: async () => {},
      create: async () => {
        throw new Error("Folder does not exist");
      }
    }
  };
  const modal = new ChangePlanPreviewModal(app as never, {
    summary: "Create page",
    operations: [{ kind: "create", path: "wiki/page.md", content: "# Page", rationale: "test" }]
  });

  modal.onOpen();
  const contentEl = modal.contentEl as unknown as { buttons: Array<{ onclick: () => Promise<void> }> };
  await contentEl.buttons[0].onclick();

  expect(notices).toContain("Failed to apply LLM Wiki changes: Folder does not exist");
});
