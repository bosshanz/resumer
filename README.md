# Resumer

面向程序员的在线 Markdown 简历模板生成器。

## 功能

- 使用 GitHub OAuth 登录（未配置 OAuth 时启用开发模式登录）。
- 在线编辑器编写 YAML Frontmatter + Markdown 正文。
- 实时预览与导出 PDF 共用同一套 React 模板组件，确保所见即所得。
- 3 套面向程序员的模板：极简、科技、开发者。
- 主题变量控制配色、字体、页边距等。
- 输入防抖 1 秒后自动保存到 SQLite。
- Markdown 导入/导出。
- 头像/照片上传，以 base64 数据 URL 存入数据库，预览与 PDF 共用。
- 后端使用 Puppeteer 渲染 A4 PDF。

## 技术栈

- Next.js 16 (App Router)
- React 19 + TypeScript
- Tailwind CSS
- Auth.js v5 + GitHub OAuth
- better-sqlite3
- Puppeteer (puppeteer-core)
- yaml + react-markdown

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env.local` 并填入实际值：

```bash
cp .env.example .env.local
```

如果只需要本地体验，可以暂不配置 GitHub OAuth，系统会自动启用开发模式登录。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000。

## Docker 本地运行

```bash
docker compose up --build
```

首次构建会安装 Chromium，耗时较长。

## 配置 GitHub OAuth

1. 打开 GitHub Settings → Developer settings → OAuth Apps → New OAuth App。
2. Homepage URL: `http://localhost:3000`
3. Authorization callback URL: `http://localhost:3000/api/auth/callback/github`
4. 将 Client ID 和 Client Secret 填入 `.env.local` 的 `GITHUB_ID` 和 `GITHUB_SECRET`。
5. 配置后开发模式登录自动关闭，必须使用 GitHub 登录。

## 项目结构

```
app/                    Next.js App Router
  api/
    auth/               Auth.js 路由
    export/pdf/         PDF 导出 API
    resumes/            简历 CRUD API
  page.tsx              主页（登录/编辑器）
components/             React 组件
lib/
  auth.ts               Auth.js 配置
  db.ts                 SQLite 连接与初始化
  parser.ts             YAML/Markdown 解析
  pdf.ts                PDF 渲染逻辑
  templates/            共享简历模板组件
  types.ts              类型定义与默认值
scripts/                本地脚本
```

## 简历 Markdown 格式

```markdown
---
name: 张三
title: 高级前端工程师
summary: 简短自我介绍
contact:
  phone: 138****8888
  email: zhangsan@example.com
  github: github.com/zhangsan
  website: zhangsan.dev
skills:
  - React
  - TypeScript
---

## 工作经历

### 公司 | 职位 | 2020.01 - 至今

- 职责与成果
```

## 后续可扩展

- 自定义 CSS
- 版本历史
- 云端部署
- 更多模板
