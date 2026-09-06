import { Composition } from "remotion";
import { ResumerIntro } from "./Composition";
export const RemotionRoot = () => (
  <Composition
    id="ResumerIntro"
    component={ResumerIntro}
    durationInFrames={1440}
    fps={30}
    width={1920}
    height={1080}
  />
);
