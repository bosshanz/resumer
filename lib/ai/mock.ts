import type { StreamFn } from "@earendil-works/pi-agent-core";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
  type AssistantMessage,
  type Context,
} from "@earendil-works/pi-ai";
import type { AgentRuntime } from "./provider";

// AI_PROVIDER=mock：本地演示与端到端测试用的“面试官”。
// 不联网，只按简单规则从用户原话里抽取事实，再像真模型一样调用同一套编辑工具。
// 它的价值是驱动真实 UI 与工具链，而不是写得多好。

type ToolPlan = { name: string; args: Record<string, unknown> };

interface MockState {
  planned: ToolPlan[];
  reply: (results: Array<{ name: string; ok: boolean; text: string }>) => string;
}

function between(text: string, open: RegExp, close: string): string {
  const match = open.exec(text);
  if (!match) return "";
  const start = match.index + match[0].length;
  const end = text.indexOf(close, start);
  return text.slice(start, end < 0 ? undefined : end).trim();
}

function taskOf(prompt: string) {
  const head = /<task kind="(\w+)"(?: action="(\w+)")?>/.exec(prompt);
  return {
    kind: head?.[1] || "chat",
    action: head?.[2] || "",
    body: between(prompt, /<task[^>]*>/, "</task>"),
    resume: between(prompt, /<resume>/, "</resume>"),
  };
}

interface Outline {
  sections: Array<{ title: string; entries: Array<{ heading: string; bullets: string[] }> }>;
}

function outline(resume: string): Outline {
  const sections: Outline["sections"] = [];
  for (const line of resume.split("\n")) {
    const h2 = /^##(?!#)\s+(.*)$/.exec(line);
    if (h2) {
      sections.push({ title: h2[1].trim(), entries: [] });
      continue;
    }
    const h3 = /^###\s+(.*)$/.exec(line);
    if (h3 && sections.length) {
      sections.at(-1)!.entries.push({ heading: h3[1].trim(), bullets: [] });
      continue;
    }
    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const entry = sections.at(-1)?.entries.at(-1);
    if (bullet && entry) entry.bullets.push(bullet[1].trim());
  }
  return { sections };
}

const DATE_RANGE = /(\d{4})[.年/-](\d{1,2})月?\s*(?:到|至|-|~|—|–)\s*(至今|现在|今|(\d{4})[.年/-](\d{1,2})月?)/;
const ROLE_AT = /在([\u4e00-\u9fa5A-Za-z0-9]{2,16}?)(?:做|担任|当|任)([\u4e00-\u9fa5A-Za-z ]{2,16}?)(?=[，,。；;\s]|$)/;
const WORK_VERBS = /(负责|做了|开发|搭建|优化|设计|重构|实现|推动|带|写了|接入|改造|上线)/;

function pad(month: string): string {
  return month.padStart(2, "0");
}

function dateRange(text: string): string | null {
  const match = DATE_RANGE.exec(text);
  if (!match) return null;
  const end = match[4] ? `${match[4]}.${pad(match[5])}` : "至今";
  return `${match[1]}.${pad(match[2])} - ${end}`;
}

function sentences(text: string): string[] {
  return text
    .split(/[。！？!?\n；;]/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function cleanClause(text: string): string {
  return text.replace(/^(?:然后|另外|还有|我主要|我还|我|也)+/, "").replace(/[，,。\s]+$/, "").trim();
}

const PENDING = /「待补[:：][^」]*」/;

function workTarget(o: Outline): { section: string; entry: string } | null {
  for (let i = o.sections.length - 1; i >= 0; i -= 1) {
    const section = o.sections[i];
    if (/教育/.test(section.title)) continue;
    const entry = section.entries.at(-1);
    if (entry) return { section: section.title, entry: entry.heading };
  }
  return null;
}

function planChat(body: string, resume: string): MockState {
  const o = outline(resume);
  const planned: ToolPlan[] = [];
  const name = /我叫([\u4e00-\u9fa5]{2,4}|[A-Za-z]{2,20})/.exec(body)?.[1];
  if (name) planned.push({ name: "set_profile", args: { field: "name", value: name } });
  const title = /(?:想找|想做|方向是|应聘|求职)([\u4e00-\u9fa5A-Za-z]{2,16}?)(?:的工作|方向|岗位|职位)?(?=[，,。；\s]|$)/.exec(body)?.[1];
  if (title) planned.push({ name: "set_profile", args: { field: "title", value: title } });

  let entry: { section: string; entry: string } | null = workTarget(o);
  let addedEntry = "";
  const role = ROLE_AT.exec(body);
  const range = dateRange(body);
  if (role && range) {
    const heading = `${role[1]} | ${role[2].trim()} | ${range}`;
    planned.push({ name: "add_entry", args: { section: "工作经历", heading } });
    entry = { section: "工作经历", entry: role[1] };
    addedEntry = role[1];
  }

  const pendingBullet = o.sections
    .flatMap((section) => section.entries.flatMap((item) => item.bullets.map((bullet) => ({ section: section.title, entry: item.heading, bullet }))))
    .find((item) => PENDING.test(item.bullet));
  let filled = false;
  let addedPending = false;
  let addedBullets = 0;
  for (const sentence of sentences(body)) {
    if (ROLE_AT.test(sentence) || /我叫/.test(sentence)) continue;
    if (/\d/.test(sentence) && pendingBullet && !filled && !WORK_VERBS.test(sentence)) {
      planned.push({
        name: "rewrite_bullet",
        args: {
          section: pendingBullet.section,
          entry: pendingBullet.entry,
          old_text: pendingBullet.bullet,
          new_text: pendingBullet.bullet.replace(/[，,]?\s*(?:效果|结果)?「待补[:：][^」]*」/, `，${cleanClause(sentence)}`),
        },
      });
      filled = true;
      continue;
    }
    if (WORK_VERBS.test(sentence) && entry) {
      let text = cleanClause(sentence);
      if (!/\d/.test(text)) {
        text = `${text}，效果「待补：量化结果」`;
        addedPending = true;
      }
      planned.push({ name: "add_bullet", args: { section: entry.section, entry: entry.entry, text } });
      addedBullets += 1;
    }
  }

  return {
    planned,
    reply: (results) => {
      const failed = results.find((result) => !result.ok);
      const lines: string[] = [];
      if (failed) lines.push(`有一处我没有写进去：${failed.text.replace(/^未写入：/, "").split("。")[0]}。`);
      const okNames = results.filter((result) => result.ok).map((result) => result.name);
      if (okNames.length) lines.push(`已经把你说的写进简历了（${okNames.length} 处修改）。`);
      if (addedEntry && !addedBullets) {
        lines.push(`在${addedEntry}这段经历里，你主要做了哪些事？哪一部分是你自己负责的？`);
      } else if (addedPending) {
        lines.push("这件事的结果怎么样？有没有具体数字，比如性能、效率或用户量的变化？我先标了「待补」，你也可以直接在右边填。");
      } else if (filled) {
        lines.push("数字补上了，这条现在更有说服力。这段经历里还有哪件事值得写？");
      } else if (name && !title) {
        lines.push(`你好，${name}。你想找什么方向的工作？最近一段经历是在哪里、做什么的？`);
      } else if (!okNames.length && !failed) {
        lines.push("明白。能具体说说你在其中做了什么、结果怎么样吗？");
      } else {
        lines.push("最近一段工作（或项目）是在哪里、做什么的？大概从什么时候到什么时候？");
      }
      return lines.join("\n\n");
    },
  };
}

function tighten(text: string): string {
  let next = text
    .replace(/主要|进行了|相关的|相关|的工作|工作中|日常|一些|方面的/g, "")
    .replace(/负责(?=[\u4e00-\u9fa5])/g, "")
    .replace(/，\s*，/g, "，")
    .trim();
  if (next === text) {
    const parts = text.split("，");
    if (parts.length > 2) next = parts.slice(0, -1).join("，");
  }
  return next || text;
}

function planAction(action: string, body: string): MockState {
  const bullet = /这条要点：(.*)/.exec(body)?.[1]?.trim() || "";
  const where = /「([^」]+)」下的这条要点/.exec(body)?.[1] || "";
  const [section, entry] = where.split(" › ");
  if (action === "hint" || !bullet) {
    return {
      planned: [],
      reply: () =>
        [
          "这条可以更有说服力，建议补三类信息：",
          "1. 你个人做了哪部分？是独立完成，还是和谁一起？",
          "2. 结果有没有数字：耗时、转化率、成本、用户量的前后对比？",
          "3. 过程中最难的一个技术点是什么，你是怎么解决的？",
          "回答任意一个，我就帮你改进这一条。",
        ].join("\n"),
    };
  }
  const core = bullet.replace(/[，,]?\s*(?:效果|结果)?「待补[:：][^」]*」/g, "").trim();
  const next =
    action === "tighten"
      ? tighten(bullet)
      : /\d/.test(core)
        ? `在「待补：业务背景」下，${core}`
        : `在「待补：业务背景」下，${core}，最终「待补：结果与数字」`;
  return {
    planned: [{ name: "rewrite_bullet", args: { section, entry, old_text: bullet, new_text: next } }],
    reply: (results) =>
      results.every((result) => result.ok)
        ? action === "tighten"
          ? "精简好了，去掉了空话，事实没有增减。"
          : "按 STAR 重写了。背景和结果我不知道，先标成「待补」，你补上后这条会更完整。"
        : `没能改这条：${results.find((result) => !result.ok)?.text || "未知原因"}`,
  };
}

function planImport(body: string): MockState {
  const text = between(body, /<imported>/, "</imported>");
  const planned: ToolPlan[] = [];
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const name = lines.find((line) => /^[\u4e00-\u9fa5]{2,4}$/.test(line));
  if (name) planned.push({ name: "set_profile", args: { field: "name", value: name } });
  const email = /[\w.+-]+@[\w-]+\.[\w.]+/.exec(text)?.[0];
  if (email) planned.push({ name: "set_profile", args: { field: "email", value: email } });
  const phone = /1\d{10}/.exec(text)?.[0];
  if (phone) planned.push({ name: "set_profile", args: { field: "phone", value: phone } });
  let current: { section: string; entry: string } | null = null;
  let entries = 0;
  for (const line of lines) {
    const range = dateRange(line);
    if (range) {
      const head = line.slice(0, DATE_RANGE.exec(line)!.index).replace(/[|｜,，]+\s*$/, "").trim();
      const parts = head.split(/\s*[|｜]\s*|\s{2,}|\s+/).filter(Boolean);
      if (!parts.length) continue;
      const section = /大学|学院|学校/.test(head) ? "教育经历" : "工作经历";
      const heading = [parts[0], parts.slice(1).join(" ") || "", range].filter(Boolean).join(" | ");
      planned.push({ name: "add_entry", args: { section, heading } });
      current = { section, entry: parts[0] };
      entries += 1;
      continue;
    }
    const bullet = /^[-•·*]\s*(.+)$/.exec(line);
    if (bullet && current) {
      planned.push({ name: "add_bullet", args: { section: current.section, entry: current.entry, text: bullet[1] } });
    }
  }
  return {
    planned,
    reply: (results) => {
      const okCount = results.filter((result) => result.ok).length;
      const failed = results.filter((result) => !result.ok).length;
      return [
        `整理好了：识别出 ${entries} 段经历，写入 ${okCount} 处${failed ? `，${failed} 处没写进去（格式没认出来或缺少依据）` : ""}。`,
        "右边可以直接改。我们从最近一段经历开始补充：这段经历里你最有成就感的一件事是什么？结果有数字吗？",
      ].join("\n\n");
    },
  };
}

function planReview(resume: string): MockState {
  const o = outline(resume);
  const entries = o.sections.flatMap((section) => section.entries);
  const pending = (resume.match(/「待补[:：]/g) || []).length;
  const first = entries[0]?.heading.split("|")[0].trim();
  return {
    planned: [],
    reply: () =>
      [
        `我通读了一遍：${o.sections.length} 个分区、${entries.length} 段经历${pending ? `，还有 ${pending} 处待补` : ""}。结构是清楚的，最值得加强的是结果和个人贡献的写法。`,
        first
          ? `先从「${first}」开始：这段经历里你最有成就感的一件事是什么？哪部分是你自己做的，结果有数字吗？`
          : "先说说你最近的一段工作或项目经历吧：在哪里、做什么、做了多久？",
      ].join("\n\n"),
  };
}

function planTask(prompt: string): MockState {
  const task = taskOf(prompt);
  if (task.kind === "action") return planAction(task.action, task.body);
  if (task.kind === "import") return planImport(task.body);
  if (task.kind === "review") return planReview(task.resume);
  return planChat(task.body, task.resume);
}

/** 提示里有 <human_edits> 时，像真模型一样先确认会以用户的改动为准 */
function plan(prompt: string): MockState {
  const state = planTask(prompt);
  const edits = between(prompt, /<human_edits>/, "</human_edits>");
  const changed = /用户新写或改成了这些行：\n\s*(.+)/.exec(edits)?.[1]?.replace(/^[-*+]\s+/, "").trim();
  if (!changed) return state;
  const shown = changed.length > 28 ? `${changed.slice(0, 27)}…` : changed;
  return {
    planned: state.planned,
    reply: (results) => `看到你改成了「${shown}」，我以你的版本为准，不会改回去。\n\n${state.reply(results)}`,
  };
}

function lastUserText(context: Context): string {
  for (let i = context.messages.length - 1; i >= 0; i -= 1) {
    const message = context.messages[i];
    if (message.role === "user") {
      return typeof message.content === "string"
        ? message.content
        : message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
    }
  }
  return "";
}

export function createMockRuntime(modelId: string): AgentRuntime {
  const handle = fauxProvider({
    provider: "mock",
    models: [{ id: modelId, name: "演示模型" }],
    tokensPerSecond: 45,
    tokenSize: { min: 2, max: 4 },
  });
  let state: MockState | null = null;
  let call = 0;

  const respond = (context: Context): AssistantMessage => {
    const last = context.messages.at(-1);
    if (!last || last.role === "user") {
      const prompt = lastUserText(context);
      if (prompt.includes("#mock-error")) {
        return fauxAssistantMessage("", { stopReason: "error", errorMessage: "演示模型模拟的服务错误（503）" });
      }
      state = plan(prompt);
      if (state.planned.length) {
        return fauxAssistantMessage(
          state.planned.map((step) => fauxToolCall(step.name, step.args, { id: `mock-${(call += 1)}` })),
          { stopReason: "toolUse" }
        );
      }
      return fauxAssistantMessage(fauxText(state.reply([])));
    }
    const results: Array<{ name: string; ok: boolean; text: string }> = [];
    for (let i = context.messages.length - 1; i >= 0; i -= 1) {
      const message = context.messages[i];
      if (message.role !== "toolResult") break;
      const text = message.content.map((part) => (part.type === "text" ? part.text : "")).join("");
      results.unshift({ name: message.toolName, ok: !message.isError, text });
    }
    return fauxAssistantMessage(fauxText((state ?? plan(lastUserText(context))).reply(results)));
  };

  handle.setResponses(Array.from({ length: 24 }, () => respond));
  const models = createModels();
  models.setProvider(handle.provider);
  return {
    model: handle.getModel(),
    streamFn: models.streamSimple.bind(models) as StreamFn,
    getApiKey: () => undefined,
  };
}
