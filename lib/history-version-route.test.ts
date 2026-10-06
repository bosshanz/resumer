import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { ensurePhotosTable, photoRef } from "./photos";
import { ensureResumeVersionsTable } from "./resume-versions";

let db: Database.Database;
let userId: string | null = "alice";
vi.mock("next-auth/next", () => ({ getServerSession: async () => userId ? { user: { id: userId } } : null }));
vi.mock("@/lib/auth", () => ({ authOptions: {} }));
vi.mock("@/lib/db", () => ({ getDatabase: () => db }));
import { GET } from "../app/api/resumes/[id]/versions/[versionId]/route";

const request = new Request("http://localhost/api/resumes/root/versions/v1");
const params = (id: string, versionId: string) => ({ params: Promise.resolve({ id, versionId }) });

beforeEach(() => {
  userId = "alice";
  db = new Database(":memory:");
  db.exec(`CREATE TABLE resumes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL);
    INSERT INTO resumes VALUES ('root', 'alice'), ('other', 'bob');`);
  ensurePhotosTable(db);
  ensureResumeVersionsTable(db);
  const ref = photoRef(db, "data:image/png;base64,AAAA");
  db.prepare(`INSERT INTO resume_versions
    (id, resume_id, user_id, title, content, template_id, theme_variables, photo)
    VALUES ('v1', 'root', 'alice', '旧版', '历史正文', 'editorial', '{"primaryColor":"#123456"}', ?)`).run(ref);
});
afterEach(() => db.close());

describe("历史版本详情", () => {
  it("返回可预览的完整快照并解析照片，读取不写数据库", async () => {
    const before = db.prepare("SELECT * FROM resume_versions").all();
    const response = await GET(request, params("root", "v1"));
    expect(response.status).toBe(200);
    expect((await response.json()).version).toMatchObject({
      id: "v1", title: "旧版", content: "历史正文", templateId: "editorial",
      themeVariables: { primaryColor: "#123456" }, photo: "data:image/png;base64,AAAA",
    });
    expect(db.prepare("SELECT * FROM resume_versions").all()).toEqual(before);
  });

  it("拒绝未登录、其他用户简历及不属于该简历的版本", async () => {
    userId = null;
    expect((await GET(request, params("root", "v1"))).status).toBe(401);
    userId = "bob";
    expect((await GET(request, params("root", "v1"))).status).toBe(404);
    expect((await GET(request, params("other", "v1"))).status).toBe(404);
    userId = "alice";
    expect((await GET(request, params("root", "missing"))).status).toBe(404);
  });
});
