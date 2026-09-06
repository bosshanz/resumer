import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { CSSProperties, ReactNode } from "react";
export const ink = "#18372e",
  paper = "#f4f2eb",
  mint = "#b9d1b7";
export const ease = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;
export function Frame({
  children,
  dark = false,
}: {
  children: ReactNode;
  dark?: boolean;
}) {
  return (
    <AbsoluteFill
      style={{
        background: dark ? ink : paper,
        color: dark ? paper : ink,
        fontFamily: '"PingFang SC", "Helvetica Neue", sans-serif',
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 90,
          top: 44,
          fontSize: 28,
          letterSpacing: 1,
        }}
      >
        Resumer{" "}
        <span style={{ opacity: 0.55, marginLeft: 25, fontSize: 17 }}>
          YOUR STORY, WELL DESIGNED
        </span>
      </div>
      {children}
      <div
        style={{
          position: "absolute",
          bottom: 38,
          left: 90,
          right: 90,
          height: 1,
          background: dark ? "#ffffff30" : "#18372e30",
        }}
      />
    </AbsoluteFill>
  );
}
export function Reveal({
  children,
  style,
  delay = 0,
}: {
  children: ReactNode;
  style?: CSSProperties;
  delay?: number;
}) {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        ...style,
        opacity: interpolate(f, [delay, delay + 15], [0, 1], ease),
        translate: `0 ${interpolate(f, [delay, delay + 22], [24, 0], ease)}px`,
      }}
    >
      {children}
    </div>
  );
}
