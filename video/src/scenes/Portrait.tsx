import { Frame } from "../design";
import { LiveResume } from "../LiveResume";
export const Portrait = () => {
  return (
    <Frame>
      <div style={{ position: "absolute", left: 100, top: 260, width: 590 }}>
        <h1
          style={{ fontSize: 89, lineHeight: 1.3, fontWeight: 500, margin: 0 }}
        >
          有照片，
          <br />
          也有好构图。
        </h1>
        <p style={{ fontSize: 34, lineHeight: 1.9, marginTop: 38 }}>
          照片随主题安排位置
          <br />
          支持裁切与完整显示
          <br />
          上下取景，自由调整
        </p>
        <div style={{ fontSize: 20, opacity: 0.55, marginTop: 25 }}>
          仅人像为图片素材 · 人物为虚构示例
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 760,
          top: 150,
          width: 1050,
          height: 800,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 24px 65px #18372e25",
        }}
      >
        <div style={{}}>
          <LiveResume photo />
        </div>
      </div>
    </Frame>
  );
};
