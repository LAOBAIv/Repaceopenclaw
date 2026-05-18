// [2026-05-18] 从 client.ts 拆分出默认数据种子
import { execToRows } from "./client";

// ── Seed default data (idempotent: skip if already present) ─────────────────
export function seedDefaultData(db: any) {
  const now = new Date().toISOString();

  // ── Default Skills ──────────────────────────────────────────────────────────
  const defaultSkills: Array<{
    id: string; name: string; description: string;
    category: string; type: string; config: string;
  }> = [
    {
      id: "skill-web-search",
      name: "网络搜索",
      description: "实时联网搜索，获取最新资讯、文档和数据。支持 Google / Bing / DuckDuckGo 等搜索引擎。",
      category: "search",
      type: "builtin",
      config: JSON.stringify({ engine: "google", maxResults: 10, safeSearch: true }),
    },
    {
      id: "skill-code-executor",
      name: "代码执行",
      description: "在沙箱环境中执行 Python / JavaScript 代码，返回运行结果。适合数据分析、脚本验证场景。",
      category: "code",
      type: "builtin",
      config: JSON.stringify({ timeout: 30, languages: ["python", "javascript"], sandbox: true }),
    },
    {
      id: "skill-image-understanding",
      name: "图像理解",
      description: "解析图片内容，支持 OCR 文字识别、图表分析、截图问答等视觉任务。",
      category: "vision",
      type: "builtin",
      config: JSON.stringify({ ocrEnabled: true, maxImageSizeMB: 10 }),
    },
    {
      id: "skill-file-reader",
      name: "文件读取",
      description: "读取并解析 PDF、Word、Excel、Markdown 等常见格式文档，提取结构化内容供 Agent 处理。",
      category: "data",
      type: "builtin",
      config: JSON.stringify({ supportedFormats: ["pdf","docx","xlsx","md","txt","csv"], maxFileSizeMB: 50 }),
    },
    {
      id: "skill-memory",
      name: "长期记忆",
      description: "将重要信息持久化存储，跨会话召回，让 Agent 记住用户偏好、项目上下文等关键知识。",
      category: "memory",
      type: "builtin",
      config: JSON.stringify({ maxMemories: 1000, similarityThreshold: 0.75 }),
    },
    {
      id: "skill-summarizer",
      name: "内容摘要",
      description: "对长文、会议记录、文档自动生成摘要，支持多种输出格式（要点列表、段落、思维导图）。",
      category: "text",
      type: "builtin",
      config: JSON.stringify({ maxInputTokens: 100000, outputFormats: ["bullets","paragraph","mindmap"] }),
    },
    {
      id: "skill-translator",
      name: "多语言翻译",
      description: "专业级多语言互译，支持 100+ 语言，保留原文格式与术语风格，适合文档本地化场景。",
      category: "text",
      type: "builtin",
      config: JSON.stringify({ supportedLangs: 100, preserveFormatting: true }),
    },
    {
      id: "skill-data-analysis",
      name: "数据分析",
      description: "对结构化数据（CSV/Excel/JSON）进行统计分析、趋势预测，并自动生成可视化图表。",
      category: "data",
      type: "builtin",
      config: JSON.stringify({ chartTypes: ["bar","line","pie","scatter","heatmap"], autoDetectSchema: true }),
    },
    {
      id: "skill-task-planner",
      name: "任务规划",
      description: "将复杂目标拆分为可执行子任务，自动分配优先级和依赖关系，输出结构化执行计划。",
      category: "planning",
      type: "builtin",
      config: JSON.stringify({ maxDepth: 5, planFormats: ["list","gantt","kanban"] }),
    },
    {
      id: "skill-browser-control",
      name: "浏览器操控",
      description: "自动化控制浏览器完成网页填写、点击、截图、抓取等操作，适合 RPA 和信息采集场景。",
      category: "automation",
      type: "builtin",
      config: JSON.stringify({ headless: true, timeout: 60, screenshotEnabled: true }),
    },
  ];

  for (const s of defaultSkills) {
    const exists = db.exec("SELECT id FROM skills WHERE id=?", [s.id]);
    if (exists.length && exists[0].values.length) continue; // already seeded
    db.run(
      `INSERT INTO skills (id, name, description, category, type, config, enabled, created_at, updated_at)
       VALUES (?,?,?,?,?,?,1,?,?)`,
      [s.id, s.name, s.description, s.category, s.type, s.config, now, now]
    );
  }

  // ── Default Plugins ─────────────────────────────────────────────────────────
  const defaultPlugins: Array<{
    id: string; name: string; description: string; version: string;
    author: string; homepage: string; icon: string;
    category: string; config: string; manifest: string;
  }> = [
    {
      id: "plugin-github",
      name: "GitHub",
      description: "连接 GitHub 仓库，支持代码检索、PR 审查、Issue 管理、Commit 查询等操作。",
      version: "1.2.0",
      author: "WorkBuddy",
      homepage: "https://github.com",
      icon: "github",
      category: "code",
      config: JSON.stringify({ accessToken: "", defaultOrg: "" }),
      manifest: JSON.stringify({
        actions: ["list_repos","get_file","create_issue","list_prs","comment_pr","search_code"]
      }),
    },
    {
      id: "plugin-notion",
      name: "Notion",
      description: "读写 Notion 数据库与页面，实现知识库同步、任务看板联动和内容自动整理。",
      version: "1.1.0",
      author: "WorkBuddy",
      homepage: "https://notion.so",
      icon: "notion",
      category: "productivity",
      config: JSON.stringify({ apiKey: "", defaultWorkspaceId: "" }),
      manifest: JSON.stringify({
        actions: ["query_database","create_page","update_page","append_block","search"]
      }),
    },
    {
      id: "plugin-slack",
      name: "Slack",
      description: "发送消息、创建频道、监听事件，让 Agent 直接在团队工作区中协作与通知。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "https://slack.com",
      icon: "slack",
      category: "communication",
      config: JSON.stringify({ botToken: "", signingSecret: "", defaultChannel: "" }),
      manifest: JSON.stringify({
        actions: ["send_message","list_channels","upload_file","get_thread"]
      }),
    },
    {
      id: "plugin-jira",
      name: "Jira",
      description: "与 Jira 项目看板对接，自动创建 Issue、更新状态、查询 Sprint 进度。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "https://atlassian.com/jira",
      icon: "jira",
      category: "project",
      config: JSON.stringify({ baseUrl: "", email: "", apiToken: "", projectKey: "" }),
      manifest: JSON.stringify({
        actions: ["create_issue","update_issue","list_issues","get_sprint","add_comment"]
      }),
    },
    {
      id: "plugin-google-calendar",
      name: "Google Calendar",
      description: "读取和创建日历事件，Agent 可自动安排会议、提醒和时间规划。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "https://calendar.google.com",
      icon: "calendar",
      category: "productivity",
      config: JSON.stringify({ clientId: "", clientSecret: "", calendarId: "primary" }),
      manifest: JSON.stringify({
        actions: ["list_events","create_event","update_event","delete_event","check_availability"]
      }),
    },
    {
      id: "plugin-email",
      name: "Email",
      description: "通过 SMTP/IMAP 发送和读取邮件，支持 HTML 模板、附件和自动回复。",
      version: "1.1.0",
      author: "WorkBuddy",
      homepage: "",
      icon: "mail",
      category: "communication",
      config: JSON.stringify({ smtpHost: "", smtpPort: 465, username: "", password: "", from: "" }),
      manifest: JSON.stringify({
        actions: ["send_email","read_inbox","search_emails","reply_email","mark_read"]
      }),
    },
    {
      id: "plugin-database-query",
      name: "数据库查询",
      description: "连接 MySQL / PostgreSQL / MongoDB，直接执行 SQL/查询语句，返回结构化数据。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "",
      icon: "database",
      category: "data",
      config: JSON.stringify({ dbType: "mysql", host: "", port: 3306, database: "", username: "", password: "" }),
      manifest: JSON.stringify({
        actions: ["execute_query","list_tables","describe_table","export_csv"]
      }),
    },
    {
      id: "plugin-http-request",
      name: "HTTP 请求",
      description: "向任意 REST / GraphQL API 发起请求，支持自定义 Header、Body 和认证方式，是打通外部系统的万能胶水。",
      version: "1.2.0",
      author: "WorkBuddy",
      homepage: "",
      icon: "globe",
      category: "tool",
      config: JSON.stringify({ defaultTimeout: 30, maxRetries: 3, followRedirects: true }),
      manifest: JSON.stringify({
        actions: ["get","post","put","patch","delete","graphql"]
      }),
    },
    {
      id: "plugin-weather",
      name: "天气查询",
      description: "获取全球实时天气和未来 15 天预报，支持按城市/坐标/IP 定位。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "https://openweathermap.org",
      icon: "cloud",
      category: "tool",
      config: JSON.stringify({ apiKey: "", units: "metric", defaultCity: "" }),
      manifest: JSON.stringify({
        actions: ["current_weather","forecast","hourly","air_quality"]
      }),
    },
    {
      id: "plugin-cron-trigger",
      name: "定时触发器",
      description: "使用 Cron 表达式定时触发 Agent 执行任务，支持复杂周期配置，适合报告生成、数据同步等场景。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "",
      icon: "clock",
      category: "automation",
      config: JSON.stringify({ timezone: "Asia/Shanghai", maxConcurrentJobs: 5 }),
      manifest: JSON.stringify({
        actions: ["create_job","update_job","delete_job","list_jobs","pause_job","resume_job"]
      }),
    },
    {
      id: "plugin-vector-store",
      name: "向量知识库",
      description: "将文档切片、向量化并存入知识库，支持语义检索，为 RAG 场景提供精准上下文。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "",
      icon: "layers",
      category: "data",
      config: JSON.stringify({ provider: "local", embeddingModel: "text-embedding-3-small", chunkSize: 512, overlap: 64 }),
      manifest: JSON.stringify({
        actions: ["add_document","search","delete_document","list_documents","clear"]
      }),
    },
    {
      id: "plugin-feishu",
      name: "飞书",
      description: "与飞书 IM / 多维表格 / 文档对接，实现消息推送、表格读写、云文档管理等协作能力。",
      version: "1.0.0",
      author: "WorkBuddy",
      homepage: "https://open.feishu.cn",
      icon: "feishu",
      category: "communication",
      config: JSON.stringify({ appId: "", appSecret: "", defaultChatId: "" }),
      manifest: JSON.stringify({
        actions: ["send_message","create_bitable_record","update_record","query_bitable","upload_file"]
      }),
    },
  ];

  for (const p of defaultPlugins) {
    const exists = db.exec("SELECT id FROM plugins WHERE id=?", [p.id]);
    if (exists.length && exists[0].values.length) continue; // already seeded
    db.run(
      `INSERT INTO plugins
         (id, name, description, version, author, homepage, icon, category, config, manifest, enabled, installed_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,1,?,?)`,
      [p.id, p.name, p.description, p.version, p.author, p.homepage, p.icon,
       p.category, p.config, p.manifest, now, now]
    );
  }
}

