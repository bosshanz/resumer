## Terms

- **简历构建工具 (Resume Builder)**: 个人使用的本地 Web 工具，通过编写结构化 Markdown、选择模板和调整主题，维护并导出 PDF 简历。
- **YAML Frontmatter**: 简历文件顶部的 YAML 元数据块，承载姓名、联系方式、职位、技能标签等结构化字段。
- **Markdown 正文**: YAML Frontmatter 之后的内容，使用标准 Markdown 描述工作经历、项目经历、教育背景等自由文本。
- **模板 (Template)**: 定义简历视觉布局与排版的 React 组件，接收解析后的 YAML/Markdown 数据并渲染成 HTML。
- **主题变量 (Theme Variables)**: 每套模板暴露的可配置样式参数，例如主色、副色、字体、字号、页边距、行高等。
- **共享模板组件 (Shared Template Components)**: 浏览器实时预览与后端 PDF 渲染共用同一套 React 模板组件，确保所见即所得。
- **本地 PDF 渲染 (Local PDF Rendering)**: 本地 Next.js 服务使用 Puppeteer 和 Chrome/Chromium，将共享模板组件渲染的 HTML 转换为 PDF 的过程。
