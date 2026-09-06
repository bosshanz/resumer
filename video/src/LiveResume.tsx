import { Folio } from "../../lib/templates/folio";
import type { CollectionId } from "../../lib/templates/collection";
import { staticFile } from "remotion";
import "../../lib/templates/styles/base.css";
import "../../lib/templates/styles/folio.css";
import "./resume-video.css";
export function LiveResume({
  variant = "minimal",
  photo = false,
  bullet = "推动组件库建设，覆盖 30+ 业务线。",
  large = false,
  focus = false,
}: {
  variant?: CollectionId;
  photo?: boolean;
  bullet?: string;
  large?: boolean;
  focus?: boolean;
}) {
  return (
    <div className={`video-resume${focus ? " video-resume-focus" : ""}`}>
      <Folio
        variant={variant}
        frontmatter={{
          name: "林知夏",
          title: "高级前端工程师",
          summary:
            "专注于设计系统与前端工程化，让复杂产品拥有清晰、一致的体验。",
          contact: { email: "hello@example.com", location: "上海" },
          skills: {
            前端: ["React", "TypeScript"],
            工程: ["Node.js", "Docker"],
          },
        }}
        body={`## 工作经历\n\n### 某某科技 | 高级前端工程师 | 2021.06 - 至今\n\n- ${bullet}\n- 优化首屏加载，加载时间降低 60%。${focus ? "\n\n## 项目经历\n\n### 开源组件库 xyz-ui\n\n- 构建轻量组件库，支持无障碍与主题定制。\n\n## 教育背景\n\n### 某某大学 | 计算机科学与技术 | 2014.09 - 2018.06" : ""}`}
        themeVariables={{
          baseFontSize: large ? "23pt" : "20pt",
          marginTop: "12mm",
          marginLeft: "12mm",
          marginRight: "12mm",
          marginBottom: "12mm",
          lineHeight: 1.55,
        }}
        photo={photo ? staticFile("portrait-person.png") : undefined}
      />
    </div>
  );
}
