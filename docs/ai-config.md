# AI 模型配置

「AI 共创」和「改写」共用一套服务端模型配置（`lib/ai/provider.ts`）。环境变量只在服务端读取，API Key 不会出现在任何接口响应或页面里；前端只拿到「提供方 / 模型名 / 是否已配置」的摘要。

## 最简配置（DeepSeek，默认）

```bash
DEEPSEEK_API_KEY=sk-...
# 可选，默认 deepseek-v4-flash
DEEPSEEK_MODEL=deepseek-v4-flash
```

只设置这两个旧变量的部署无需改动。

## 选择其他模型

| 变量 | 说明 |
|---|---|
| `AI_PROVIDER` | 提供方 ID，默认 `deepseek`，不区分大小写 |
| `AI_MODEL` | 模型 ID。优先于 `DEEPSEEK_MODEL`；DeepSeek 以外的提供方必须设置 |
| `AI_API_KEY` | 通用 Key，优先于下表各家的 Key 变量 |
| `AI_BASE_URL` | 可选；自定义兼容网关地址 |

Key 查找顺序：`AI_API_KEY` → 该提供方自己的变量。

| `AI_PROVIDER` | 名称 | Key 变量 |
|---|---|---|
| `deepseek` | DeepSeek | `DEEPSEEK_API_KEY` |
| `openai` | OpenAI | `OPENAI_API_KEY` |
| `anthropic` | Anthropic | `ANTHROPIC_API_KEY` |
| `google` | Google Gemini | `GEMINI_API_KEY` |
| `moonshotai` / `moonshotai-cn` | Moonshot（Kimi） | `MOONSHOT_API_KEY` |
| `zai` | 智谱 Z.ai | `ZAI_API_KEY` |
| `minimax-cn` | MiniMax 中国站 | `MINIMAX_CN_API_KEY` |
| `openrouter` | OpenRouter | `OPENROUTER_API_KEY` |
| `xai` | xAI | `XAI_API_KEY` |
| `mistral` | Mistral | `MISTRAL_API_KEY` |
| `groq` | Groq | `GROQ_API_KEY` |
| `mock` | 演示模型 | 不需要 |

示例：

```bash
AI_PROVIDER=anthropic
AI_MODEL=claude-sonnet-4-5
ANTHROPIC_API_KEY=sk-ant-...
```

提供方都来自 `@earendil-works/pi-ai` 内置实现。需要新增时，在 `lib/ai/provider.ts` 的 `PROVIDERS` 里按同样格式加一行。

配置有误（提供方不支持、缺 Key、缺模型）时，共创面板和改写会显示具体缺哪个变量，不会发起请求。

Docker Compose 只转发 `DEEPSEEK_*` 和 `AI_*` 变量；使用其他提供方时请把 Key 放在 `AI_API_KEY`。

## 演示模型 `mock`

`AI_PROVIDER=mock` 使用 `lib/ai/mock.ts` 中脚本化的「面试官」：不联网、不需要 Key，按简单规则从用户原话抽取事实，并调用与真模型相同的编辑工具。用于本地演示、单元测试和 `scripts/test-cocreate-flows.mjs` 端到端流程。

- 消息里包含 `#mock-error` 时模拟模型 503 错误，用于检查出错与重试。
- 它只能驱动流程，写作质量不代表真实模型。不要在正式部署中使用。

## 验证

- `npm test` 覆盖配置解析、DeepSeek 默认值与旧变量兼容、摘要不含 Key。
- 真实模型调用没有自动化测试，换模型后请在页面上手动跑一轮共创与改写。
