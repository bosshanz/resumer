import { AbsoluteFill, interpolate, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries } from "@remotion/transitions";
import { Opening } from "./scenes/Opening";
import { Studio } from "./scenes/Studio";
import { Themes } from "./scenes/Themes";
import { Portrait } from "./scenes/Portrait";
import { Closing } from "./scenes/Closing";
export const ResumerIntro = () => (
  <AbsoluteFill>
    <Audio
      src={staticFile("resumer-score.wav")}
      volume={(f) =>
        interpolate(f, [0, 20, 1380, 1440], [0, 0.85, 0.85, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        })
      }
    />
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={120} name="Opening">
        <Opening />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={270} name="Studio">
        <Studio />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={600} name="Five themes">
        <Themes />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={240} name="Portrait">
        <Portrait />
      </TransitionSeries.Sequence>
      <TransitionSeries.Sequence durationInFrames={210} name="Export">
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
