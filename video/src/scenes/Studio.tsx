import { useCurrentFrame } from "remotion";
import { Frame } from "../design";
import { LiveResume } from "../LiveResume";
const original = "推动组件库建设，覆盖 30+ 业务线。";
const improved = "推动组件库建设，覆盖 30+ 业务线，研发效率提升 40%。";
export const Studio = () => {
  const f = useCurrentFrame();
  const text =
    f < 90
      ? original
      : improved.slice(
          0,
          Math.min(
            improved.length,
            Math.floor((f - 90) / 2) + original.length - 1,
          ),
        );
  return (
    <Frame>
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 115,
          fontSize: 62,
          fontWeight: 500,
        }}
      >
        写清成果，实时呈现。
      </div>
      <div
        style={{
          position: "absolute",
          left: 90,
          right: 90,
          top: 230,
          bottom: 90,
          display: "grid",
          gridTemplateColumns: "215px minmax(0,1fr) 430px",
          background: "#fff",
          border: "1px solid #ccd5ce",
          boxShadow: "0 18px 65px #18372e12",
          overflow: "hidden",
        }}
      >
        <div
          style={{ padding: "34px 20px", background: "#e8eee8", fontSize: 25 }}
        >
          <div style={{ fontSize: 17, letterSpacing: 2, marginBottom: 40 }}>
            简历目录
          </div>
          {[
            "基本信息",
            "个人简介",
            "专业技能",
            "工作经历",
            "项目经历",
            "教育背景",
          ].map((t, i) => (
            <div
              key={t}
              style={{
                padding: "20px 10px",
                marginBottom: 8,
                background: i === 3 ? "#c9d9c9" : "transparent",
                borderRadius: 5,
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div style={{ overflow: "hidden", padding: 28, background: "#f2f3ee" }}>
          <div style={{ fontSize: 19, marginBottom: 18 }}>
            实时预览{" "}
            <span style={{ float: "right", color: "#547961" }}>
              ● {f < 175 ? "编辑中" : "已保存"}
            </span>
          </div>
          <div
            style={{
              background: "white",
            }}
          >
            <LiveResume bullet={text} focus />
          </div>
        </div>
        <div style={{ padding: 30, borderLeft: "1px solid #d6ddd7" }}>
          <div style={{ fontSize: 17, letterSpacing: 2, marginBottom: 26 }}>
            内容编辑
          </div>
          <h2 style={{ fontSize: 35, margin: "0 0 32px" }}>某某科技</h2>
          {[
            ["职位", "高级前端工程师"],
            ["起止时间", "2021.06 - 至今"],
          ].map(([l, v]) => (
            <div key={l} style={{ marginBottom: 25 }}>
              <div style={{ fontSize: 20, opacity: 0.6, marginBottom: 10 }}>
                {l}
              </div>
              <div
                style={{
                  border: "1px solid #cbd4cc",
                  padding: 15,
                  fontSize: 24,
                  borderRadius: 5,
                }}
              >
                {v}
              </div>
            </div>
          ))}
          <div style={{ fontSize: 20, opacity: 0.6, margin: "30px 0 12px" }}>
            正文 · 突出已有成果
          </div>
          <div
            style={{
              border: "2px solid #5f856d",
              padding: 20,
              fontSize: 27,
              lineHeight: 1.65,
              borderRadius: 5,
              background: "#f6f9f3",
            }}
          >
            {text}
            <span style={{ opacity: f < 175 ? 1 : 0 }}>|</span>
          </div>
          <div style={{ fontSize: 20, marginTop: 25, color: "#55735f" }}>
            自动保存 · 同步到画布
          </div>
        </div>
      </div>
    </Frame>
  );
};
