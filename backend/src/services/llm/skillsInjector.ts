// [2026-05-18] 从 AutoLLMAdapter.ts 拆分出技能注入逻辑
import { getDb } from '../../db/client';

// ─── Skills injection ─────────────────────────────────────────────────────────

/**
 * Load enabled skills bound to an agent and return a formatted prompt block.
 * Returns empty string if agent has no bound/enabled skills.
 */
export function loadAgentSkillsPrompt(agentId: string): string {
  try {
    const db = getDb();
    const result = db.exec(
      `SELECT s.name, s.description, s.category
       FROM skills s
       INNER JOIN agent_skills a ON a.skill_id = s.id
       WHERE a.agent_id = ? AND s.enabled = 1
       ORDER BY a.bound_at ASC`,
      [agentId]
    );
    if (!result.length || !result[0].values.length) return "";

    const cols = result[0].columns;
    // [2026-05-24] 类型安全：any → unknown
    const skills = result[0].values.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {}; // [2026-05-24] 类型安全：any → Record<string, unknown>
      cols.forEach((c: string, i: number) => (obj[c] = row[i]));
      return obj;
    });

    const lines = skills.map(
      // [2026-05-24] 类型安全：any → unknown
      (s: unknown) => `- 【${(s as Record<string, unknown>).name}】(${(s as Record<string, unknown>).category}):${(s as Record<string, unknown>).description}`
    );
    return `\n\n## 可用技能\n你拥有以下技能,可在回答中酌情说明或使用:\n${lines.join("\n")}`;
  } catch {
    return "";
  }
}
