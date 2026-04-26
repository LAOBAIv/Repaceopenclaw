/**
 * import-agency-agents.ts
 * 将 agency-agents 仓库的 100+ 专业角色模板导入到 RepaceClaw 的 agent_templates 表
 *
 * 用法: npx tsx backend/src/scripts/import-agency-agents.ts
 */

import { initDb, getDb, saveDb } from "../db/client";
import { logger } from '../utils/logger';
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";

const AGENCY_DIR = path.join(__dirname, "../../../../agency-agents");

// 分类映射（目录名 → 中文分类名）
const CATEGORY_MAP: Record<string, string> = {
  engineering: "engineering",
  design: "design",
  "paid-media": "paid-media",
  sales: "sales",
  marketing: "marketing",
  product: "product",
  "project-management": "project-management",
  specialized: "specialized",
  support: "support",
  testing: "testing",
  academic: "academic",
  integrations: "integrations",
  strategy: "strategy",
};

// 颜色映射（按分类）
const CATEGORY_COLORS: Record<string, string> = {
  engineering: "#3B82F6",
  design: "#8B5CF6",
  "paid-media": "#F59E0B",
  sales: "#10B981",
  marketing: "#EF4444",
  product: "#6366F1",
  "project-management": "#0EA5E9",
  specialized: "#EC4899",
  support: "#14B8A6",
  testing: "#F97316",
  academic: "#64748B",
  integrations: "#A855F7",
  strategy: "#06B6D4",
};

/**
 * 解析 markdown 文件的 YAML frontmatter 和正文
 */
function parseAgentFile(
  filePath: string,
  category: string,
  githubSource: string
): { name: string; emoji: string; color: string; vibe: string; description: string; systemPrompt: string; writingStyle: string; expertise: string[]; outputFormat: string } | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");

    // 提取 YAML frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;

    const fmText = fmMatch[1];
    const parseYamlField = (key: string): string => {
      const match = fmText.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
      return match ? match[1].trim().replace(/^["']|["']$/g, "") : "";
    };

    const name = parseYamlField("name");
    if (!name) return null;

    const emoji = parseYamlField("emoji") || "🤖";
    const color = CATEGORY_COLORS[category] || "#6366F1";
    const vibe = parseYamlField("vibe");
    const description = parseYamlField("description");

    // 从正文提取 identity 和 core mission 作为 system_prompt
    const body = content.slice(fmMatch[0].length).trim();

    // 提取 Identity & Memory 段
    const identityMatch = body.match(/## 🧠 Your Identity & Memory\n([\s\S]*?)(?=\n## |\n### |\Z)/);
    const identity = identityMatch ? identityMatch[1].trim() : "";

    // 提取 Core Mission 段
    const missionMatch = body.match(/## 🎯 Your Core Mission\n([\s\S]*?)(?=\n## 🚨|\n## 📋|\Z)/);
    const mission = missionMatch ? missionMatch[1].trim() : "";

    // 提取 Critical Rules
    const rulesMatch = body.match(/## 🚨 Critical Rules[\s\S]*?\n([\s\S]*?)(?=\n## |\Z)/);
    const rules = rulesMatch ? rulesMatch[1].trim() : "";

    // 组合 system prompt
    const systemPrompt = [
      `You are **${name}**. ${vibe || ""}`,
      "",
      "## 🧠 Identity & Memory",
      identity,
      "",
      "## 🎯 Core Mission",
      mission,
      "",
      "## 🚨 Critical Rules",
      rules,
    ].filter(Boolean).join("\n");

    // 从 description 提取 expertise 关键词
    const expertise: string[] = [];
    const desc = description.toLowerCase();
    if (desc.includes("react") || desc.includes("vue") || desc.includes("angular")) expertise.push("frontend");
    if (desc.includes("api") || desc.includes("microservice") || desc.includes("backend") || desc.includes("server-side")) expertise.push("backend");
    if (desc.includes("cloud") || desc.includes("aws") || desc.includes("infrastructure")) expertise.push("cloud");
    if (desc.includes("database") || desc.includes("sql") || desc.includes("schema")) expertise.push("database");
    if (desc.includes("security") || desc.includes("threat") || desc.includes("vulnerability")) expertise.push("security");
    if (desc.includes("ml") || desc.includes("machine learning") || desc.includes("ai ")) expertise.push("ai-ml");
    if (desc.includes("devops") || desc.includes("ci/cd") || desc.includes("pipeline")) expertise.push("devops");
    if (desc.includes("design") || desc.includes("ui") || desc.includes("ux")) expertise.push("design");
    if (desc.includes("marketing") || desc.includes("seo") || desc.includes("content")) expertise.push("marketing");
    if (desc.includes("sales") || desc.includes("revenue") || desc.includes("pipeline")) expertise.push("sales");
    if (desc.includes("product") || desc.includes("roadmap") || desc.includes("sprint")) expertise.push("product");
    if (!expertise.length) expertise.push(category);

    return {
      name,
      emoji,
      color,
      vibe,
      description,
      systemPrompt,
      writingStyle: "professional",
      expertise,
      outputFormat: "markdown",
    };
  } catch (err) {
    logger.error(`  ❌ 解析失败: ${filePath} — ${err}`);
    return null;
  }
}

/**
 * 遍历 agency-agents 目录，导入所有 agent 模板
 */
function importAgencyAgents(): number {
  let imported = 0;
  const db = getDb();
  const now = new Date().toISOString();

  const categories = Object.keys(CATEGORY_MAP);

  for (const catDir of categories) {
    const dirPath = path.join(AGENCY_DIR, catDir);
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) continue;

    const files = fs.readdirSync(dirPath).filter((f) => f.endsWith(".md"));
    logger.info(`\n📂 ${catDir}/ (${files.length} 个文件)`);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const githubSource = `msitarzewski/agency-agents/${catDir}/${file}`;
      const parsed = parseAgentFile(filePath, catDir, githubSource);

      if (!parsed) continue;

      // 检查是否已存在（按 name + category 去重）
      const existing = db.exec(
        "SELECT id FROM agent_templates WHERE name = ? AND category = ?",
        [parsed.name, catDir]
      );
      if (existing.length && existing[0].values.length) {
        logger.info(`  ⏭️ 已存在: ${parsed.name}`);
        continue;
      }

      const id = uuidv4();
      db.run(
        `INSERT INTO agent_templates (
          id, name, category, emoji, color, vibe, description,
          system_prompt, writing_style, expertise, output_format,
          github_source, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          parsed.name,
          catDir,
          parsed.emoji,
          parsed.color,
          parsed.vibe,
          parsed.description,
          parsed.systemPrompt,
          parsed.writingStyle,
          JSON.stringify(parsed.expertise),
          parsed.outputFormat,
          githubSource,
          now,
        ]
      );
      imported++;
      logger.info(`  ✅ ${parsed.emoji} ${parsed.name}`);
    }
  }

  saveDb();
  return imported;
}

// ── 主入口 ──
(async () => {
  logger.info("🚀 开始导入 agency-agents 到 RepaceClaw...\n");
  await initDb();
  const count = importAgencyAgents();
  logger.info(`\n🎉 导入完成！共导入 ${count} 个 agent 模板。`);
})();
