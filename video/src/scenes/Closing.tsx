import { Frame, Reveal, mint } from "../design";
export const Closing = () => (
  <Frame dark>
    <Reveal style={{ position: "absolute", left: 120, top: 245 }}>
      <div style={{ fontSize: 26, letterSpacing: 5, color: mint }}>
        READY FOR YOUR NEXT CHAPTER
      </div>
      <h1 style={{ fontSize: 118, fontWeight: 500, margin: "38px 0" }}>
        整理好，导出即用。
      </h1>
      <p style={{ fontSize: 45, lineHeight: 1.9 }}>
        A4 PDF 导出 · 多份简历 · 本地保存
        <br />
        保留 Markdown 专业模式
      </p>
      <div
        style={{
          display: "inline-block",
          background: mint,
          color: "#18372e",
          padding: "23px 38px",
          fontSize: 34,
          marginTop: 24,
        }}
      >
        github.com/bosshanz/resumer ↗
      </div>
    </Reveal>
  </Frame>
);
