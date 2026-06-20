# Resume Markdown 书写规则

本项目是一个 Markdown 简历生成器。编辑器接受一段以 YAML frontmatter 开头的 Markdown 文本，渲染成 A4 简历。请严格遵循以下规则编写/修改简历内容。

---

## 1. 文件结构

```markdown
---
name: 姓名
title: 职位标题
summary: 一段个人简介
contact:
  phone: 手机号
  email: 邮箱
  github: github.com/username
  website: username.dev
  linkedin: linkedin.com/in/username
  location: 城市
skills:
  - 技能 1
  - 技能 2
  - 技能 3
---

## 工作经历

### 公司名 | 职位 | 2021.06 - 至今

- 负责核心交易链路前端架构，支撑日均千万级 UV。
- 推动组件库建设，覆盖 30+ 业务线，研发效率提升 40%。

## 项目经历

### 开源组件库 xyz-ui

**项目角色 / 技术栈**

- GitHub Stars: 2.3k
- 基于 React + TypeScript 的轻量级组件库。

## 教育背景

### 某某大学 | 计算机科学与技术 | 2014.09 - 2018.06

```

- 文档由 `---` 包裹的 YAML frontmatter 和后面的 Markdown body 两部分组成。
- frontmatter 控制头部信息（姓名、职位、联系方式、技能等）。
- body 控制经历、项目、教育等主体内容。

---

## 2. Frontmatter 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 姓名，渲染为简历大标题 |
| `title` | string | 职位/头衔，渲染在姓名上方或旁边 |
| `summary` | string | 个人简介/总结，通常显示在头部下方 |
| `contact.phone` | string | 手机号 |
| `contact.email` | string | 邮箱 |
| `contact.github` | string | GitHub 地址，可只写 `github.com/username` |
| `contact.website` | string | 个人网站 |
| `contact.linkedin` | string | LinkedIn 地址 |
| `contact.location` | string | 所在城市 |
| `skills` | string[] | 技能标签列表 |

- 所有 contact 字段都是可选的，未填写则不会显示。
- `skills` 会按模板样式渲染为标签或行内列表。

---

## 3. Body 结构规则

### 3.1 二级标题 `##` = 大章节

每个主要板块用一个二级标题：

```markdown
## 工作经历
## 项目经历
## 教育背景
## 专业技能
## 开源贡献
```

- 不同模板会以不同方式渲染二级标题（下划线、编号、banner 等）。

### 3.2 三级标题 `###` = 具体条目

三级标题用于单个工作、项目或学校条目：

```markdown
### 公司名 | 职位 | 2021.06 - 至今
### 项目名称
### 学校名 | 专业 | 2014.09 - 2018.06
```

- 日期建议放在最后，用 `|` 与前面的内容分隔。
- **科技（tech）模板特殊约定**：若希望日期以等宽字体显示在右侧，请把日期写成斜体或行内代码：
  - `### 公司 | 职位 | *2021.06 - 至今*`
  - `### 公司 | 职位 | \`2021.06 - 至今\``

### 3.3 四级子标题 = 仅加粗的段落

如果一个段落里**只有一段加粗文字**，它会被渲染为四级子标题（`resume-subhead`）：

```markdown
**项目角色 / 技术栈**
```

会渲染成比 `###` 更小、更醒目的子标题，适合标注项目中的职责或技术栈。

> 注意：如果段落里除了加粗还有其他文字，它仍然是一个普通段落。

### 3.4 列表 `-` =  bullet 描述

条目详情用无序列表：

```markdown
- 负责核心交易链路前端架构，支撑日均千万级 UV。
- 推动组件库建设，覆盖 30+ 业务线。
```

- 每个 `-` 对应一个 bullet。
- 长文本会自动换行，bullet 符号保持在左侧。
- 不要使用有序列表 `1.` 来写经历描述。

### 3.5 普通段落

普通段落可用于简短的说明文字：

```markdown
该项目曾获公司年度技术创新奖，目前已开源并维护中。
```

---

## 4. 模板差异提示

| 模板 | 头部照片 | 日期样式 | 列表符号 |
|---|---|---|---|
| `minimal` | 左侧画框肖像 | 普通文本 | 短横线 `—` |
| `tech` | 深色 banner 旁标本 | 斜体/代码日期会右对齐 | 箭头 `▸` |
| `developer` | 左侧方形徽章 | 普通文本 | 小方块 |
| `grid` | 头部左侧方形 | 普通文本（可斜体） | 短横线 |
| `editorial` | 右侧杂志大图 | 普通文本 | 圆点 `·` |

- 不同模板的字号、页边距、颜色可在「样式」面板中调整。
- 照片在「样式」面板 →「照片排版」中可切换「模板默认」或「浮岛肖像」。

---

## 5. 禁止事项

- 不要在 frontmatter 之外的地方写联系方式，系统只会读取 frontmatter 中的 `contact`。
- 不要把整段经历写成纯文本段落而不使用列表，这会让简历难以扫描。
- 不要在一级标题 `#` 中写姓名，姓名必须放在 frontmatter 的 `name` 字段。
- 不要使用 HTML 标签，仅使用标准 Markdown。

---

## 6. 最小可运行示例

```markdown
---
name: 张三
title: 高级前端工程师
summary: 8 年 Web 开发经验，专注于 React 生态与工程化。
contact:
  phone: 138****8888
  email: zhangsan@example.com
  github: github.com/zhangsan
skills:
  - React / Next.js
  - TypeScript
---

## 工作经历

### 某某科技 | 高级前端工程师 | *2021.06 - 至今*

- 负责核心交易链路前端架构。
- 主导 Next.js 全栈迁移。

## 教育背景

### 某某大学 | 计算机科学与技术 | 2014.09 - 2018.06
```
