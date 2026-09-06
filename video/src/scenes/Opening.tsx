import { Frame, Reveal, mint } from "../design";
import { LiveResume } from "../LiveResume";
export const Opening = () => (
  <Frame dark>
    <Reveal style={{ position: "absolute", left: 100, top: 260, width: 710 }}>
      <div style={{ fontSize: 26, letterSpacing: 6, color: mint }}>
        让经历成为作品
      </div>
      <h1
        style={{
          fontSize: 145,
          fontWeight: 500,
          letterSpacing: -8,
          margin: "30px 0",
        }}
      >
        Resumer.
      </h1>
      <div style={{ fontSize: 49, lineHeight: 1.6 }}>
        写好内容。
        <br />
        让专业，清晰可见。
      </div>
    </Reveal>
    <Reveal
      delay={8}
      style={{
        position: "absolute",
        left: 880,
        top: 125,
        width: 960,
        height: 850,
        overflow: "hidden",
        background: "white",
        boxShadow: "0 30px 80px #0003",
      }}
    >
      <LiveResume />
    </Reveal>
    <div
      style={{
        position: "absolute",
        left: 100,
        bottom: 95,
        fontSize: 25,
        color: mint,
      }}
    >
      可视化简历工作台 / 产品导览
    </div>
  </Frame>
);
