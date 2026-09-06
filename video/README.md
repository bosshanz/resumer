# Resumer 项目介绍视频

48 秒，1920 × 1080，30 fps，H.264 + AAC。五个场景：品牌开场、原生工作台动画、五套主题、照片构图、PDF 导出与项目入口。

## 预览与重新生成

```sh
npm ci
cd video
npm ci
node scripts/music.mjs
npm run dev -- --no-open
npm run render
npm run poster
```

首次渲染可能下载 Chrome Headless Shell；也可在 render/poster 命令后传入 `--browser-executable=/path/to/chrome` 使用本地 Chrome。依赖锁定在本目录，不进入 Next.js 应用构建。

视频输出到 `../docs/media/resumer-intro.mp4`，封面输出到 `../docs/media/resumer-intro.jpg`。时间线入口为 `src/Composition.tsx`，每个场景独立保存在 `src/scenes/`。

## 原生画面与配乐

- 简历直接导入 `../lib/templates/folio.tsx` 与产品 CSS，文字由 React/Markdown 实时渲染，不使用整页截图或 PDF 图片。
- 工作台是为视频编排的原生 React 演示：字段与简历预览共享同一条随时间变化的内容；侧栏以大字号呈现，便于阅读。它是功能演示动画，不是操作录屏。
- 五套主题逐套展示，各停留 4 秒。视频专用 CSS 只调整画布宽度、字号和资料栏宽度，完整主题逻辑与产品共用。
- `portrait-person.png` 是唯一的图片素材：虚构 AI 人物，用于演示照片排版。案例姓名与履历均为公开演示数据。
- `resumer-score.wav` 由 `scripts/music.mjs` 合成：120 BPM，A 小调和声，柔和合成器、分解旋律与轻节奏，无第三方采样。
- 输出使用无损 PNG 中间帧与 H.264 CRF 16，优先保证正文清晰度。

README 使用封面链接到仓库内 MP4。GitHub Markdown 不依赖自定义 video 标签；点击封面打开视频文件页面即可观看或下载。
