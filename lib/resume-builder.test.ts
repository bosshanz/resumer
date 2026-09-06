import { describe, expect, it } from "vitest";
import {
  readBuilder,
  patchField,
  splitPieces,
  togglePiece,
  joinPieces,
  orderedPieces,
  replacePiece,
  editHeading,
  editPieceBody,
  richTextSafe,
} from "./resume-builder";
const legacy =
  "---\n# keep this comment\nname: Alice\ncustom: { flag: true }\ncontact:\n  email: alice@example.com\n---\n\nIntroduction\n\n## Work\n\n### Acme | Lead | 2024\n\n- **Grew revenue** 20%\n\n```md\n## Not a section\n### Not an entry\n```\n\n### Same | Role | 2023\n\nA table:\n\n| A | B |\n| - | - |\n| x | y |\n\n## Education\n\nSchool without a final newline";
describe("visual resume adapter", () => {
  it("round trips legacy content byte for byte without parsing fenced headings as blocks", () => {
    const doc = readBuilder(legacy);
    expect(doc.front + joinPieces(doc.sections)).toBe(legacy);
    expect(doc.sections.map((s) => s.title)).toEqual([
      "自由内容",
      "Work",
      "Education",
    ]);
    expect(
      splitPieces(doc.sections[1].body, 3).filter((e) => e.heading),
    ).toHaveLength(2);
  });
  it("patches a field while keeping unknown metadata, comments and body", () => {
    const next = patchField(legacy, ["contact", "phone"], "123");
    const doc = readBuilder(next);
    expect(doc.fields.custom).toEqual({ flag: true });
    expect(doc.fields.contact).toEqual({
      email: "alice@example.com",
      phone: "123",
    });
    expect(next).toContain("# keep this comment");
    expect(doc.body).toBe(readBuilder(legacy).body);
  });
  it("does not mutate invalid frontmatter", () => {
    const invalid = "---\nname: [broken\n---\n\n## Work\nText";
    expect(readBuilder(invalid).error).toBeTruthy();
    expect(patchField(invalid, ["name"], "New")).toBe(invalid);
  });
  it("creates metadata for a body-only resume without changing its body", () => {
    expect(
      readBuilder(patchField("## Work\n\nHello", ["name"], "王小明")).body,
    ).toBe("## Work\n\nHello");
  });
  it("hides and restores Unicode sections losslessly, including nested hidden entries", () => {
    const doc = readBuilder(
      "## 工作经历\n\n### 公司 | 工程师 | 2024\n\n成果 🚀\n\n## 教育\n大学",
    );
    const parts = splitPieces(doc.sections[0].body, 3);
    const entryIndex = parts.findIndex((p) => p.heading);
    const originalEntry = parts[entryIndex].raw;
    parts[entryIndex] = togglePiece(parts[entryIndex]);
    const section = replacePiece(
      doc.sections[0],
      doc.sections[0].heading + joinPieces(parts),
    );
    const hidden = togglePiece(section);
    expect(hidden.raw).not.toContain("###");
    expect(hidden.hidden).toBe(true);
    const restored = togglePiece(hidden);
    const entries = splitPieces(restored.body, 3);
    expect(togglePiece(entries[entryIndex]).raw).toBe(originalEntry);
  });
  it("allows editing a hidden section without showing it", () => {
    const original = readBuilder("## 工作\n\n旧内容").sections[0];
    const hidden = togglePiece(original);
    const edited = replacePiece(hidden, "## 工作\n\n新内容");
    expect(edited.hidden).toBe(true);
    expect(togglePiece(edited).body).toContain("新内容");
  });
  it("preserves malformed hidden annotations as ordinary source", () => {
    for (const raw of [
      "<!-- resumer-hidden-2:bad -->\n",
      "<!-- resumer-hidden-2:IyMgV29yaw== -->\n\nImportant suffix",
    ]) {
      const doc = readBuilder(raw);
      expect(joinPieces(doc.sections)).toBe(raw);
      expect(doc.sections[0].hidden).toBe(false);
    }
  });
  it("reorders sections with missing trailing newlines without joining headings", () => {
    const sections = readBuilder("## One\n\nFirst\n\n## Two\n\nLast").sections;
    const swapped = orderedPieces([sections[1], sections[0]]);
    expect(readBuilder(swapped).sections.map((p) => p.title)).toEqual([
      "Two",
      "One",
    ]);
    expect(swapped).toContain("Last\n\n## One");
  });
  it("updates just a heading and retains its original body", () => {
    const first = readBuilder(legacy).sections[1];
    expect(editHeading(first, "Experience").body).toBe(first.body);
  });
  it("keeps the next experience separate when rich text omits trailing newlines", () => {
    const entries = splitPieces(
      "### First | Lead | 2024\n\nOld text\n\n### Second\n\nKeep me",
      3,
    );
    entries[0] = editPieceBody(entries[0], "- New achievement");
    const result = splitPieces(joinPieces(entries), 3);
    expect(result.map((p) => p.title)).toEqual([
      "First | Lead | 2024",
      "Second",
    ]);
    expect(result[1].raw).toBe("### Second\n\nKeep me");
  });
  it("does not accumulate blank lines when editing raw block text", () => {
    const original = splitPieces("### Entry\n\nText\n\n", 3)[0];
    const first = editPieceBody(original, "Text\n\n");
    const second = editPieceBody(first, first.body.replace(/^\n\n/, ""));
    expect(second.raw).toBe(first.raw);
  });
  it("rejects incompatible nested metadata without throwing on form edits", () => {
    const source = "---\ncontact: oops\n---\n## Work";
    expect(readBuilder(source).error).toBeTruthy();
    expect(patchField(source, ["contact", "email"], "new@example.com")).toBe(
      source,
    );
  });
  it("edits empty frontmatter and aliased contact information", () => {
    const empty = "---\n---\n## Work";
    expect(readBuilder(patchField(empty, ["name"], "Test")).fields.name).toBe(
      "Test",
    );
    const aliased =
      "---\nshared: &shared\n  email: old@example.com\ncontact: *shared\n---\n## Work";
    const result = readBuilder(
      patchField(aliased, ["contact", "email"], "new@example.com"),
    );
    expect(result.fields.contact).toEqual({ email: "new@example.com" });
    expect(result.fields.shared).toEqual({ email: "old@example.com" });
  });
  it("only enables rich editing for supported non-lossy node types", () => {
    expect(
      richTextSafe(
        "- **Impact** and [portfolio](https://example.com)\n- Second",
      ),
    ).toBe(true);
    for (const text of [
      "| a | b |\n| - | - |\n| 1 | 2 |",
      "```js\ncode\n```",
      "- [x] Task",
      "![alt](a.png)",
      "<div>custom</div>",
      "[x][ref]\n\n[ref]: https://example.com",
      "#### Heading",
      "`inline code`",
    ])
      expect(richTextSafe(text)).toBe(false);
  });
});
