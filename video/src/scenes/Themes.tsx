import { interpolate, useCurrentFrame } from "remotion";
import { Frame, ease, mint } from "../design";
import { LiveResume } from "../LiveResume";
import type { CollectionId } from "../../../lib/templates/collection";
const themes: [CollectionId, string, string, string][] = [
  ["minimal", "留白", "衬线姓名，舒展单栏。", "让内容成为主角"],
  ["editorial", "纸刊", "经历主栏，资料侧栏。", "像杂志一样组织信息"],
  ["ledger", "序列", "章节编号，清晰层级。", "用秩序建立专业感"],
  ["authority", "沉静", "居中名帖，松墨色调。", "克制而从容的表达"],
  ["blueprint", "构筑", "墨蓝页首，技术档案。", "让系统思维清晰可见"],
];
export const Themes = () => {
  const f = useCurrentFrame(),
    index = Math.min(4, Math.floor(f / 120)),
    local = f % 120;
  const [variant, name, description, tagline] = themes[index];
  return (
    <Frame dark>
      <div style={{ position: "absolute", left: 100, top: 260, width: 560 }}>
        <div style={{ fontSize: 22, color: mint, letterSpacing: 4 }}>
          FIVE COMPOSITIONS / 0{index + 1}
        </div>
        <h1 style={{ fontSize: 125, fontWeight: 500, margin: "32px 0" }}>
          {name}
        </h1>
        <p style={{ fontSize: 35, lineHeight: 1.8 }}>
          {description}
          <br />
          {tagline}
        </p>
        <div style={{ display: "flex", gap: 16, marginTop: 60 }}>
          {themes.map((t, i) => (
            <div
              key={t[0]}
              style={{
                width: 62,
                height: 4,
                background: i === index ? mint : "#ffffff30",
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 720,
          top: 125,
          width: 1100,
          height: 850,
          overflow: "hidden",
          background: "white",
          boxShadow: "0 24px 60px #0003",
        }}
      >
        <div
          style={{
            opacity: interpolate(local, [0, 10], [0.2, 1], ease),
          }}
        >
          <LiveResume variant={variant} />
        </div>
      </div>
    </Frame>
  );
};
