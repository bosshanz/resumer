import { Config } from "@remotion/cli/config";
import path from "node:path";
Config.setVideoImageFormat("png");
Config.setOverwriteOutput(true);
// Shared product templates must use the same React instance as Remotion.
Config.overrideWebpackConfig((config) => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      react: path.resolve("node_modules/react"),
      "react-dom": path.resolve("node_modules/react-dom"),
    },
  },
}));
