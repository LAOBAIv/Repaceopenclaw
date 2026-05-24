// [2026-05-18] 从 client.ts 拆分出 Session Tabs CRUD
import { getDb } from "./client";

// ── Session Tabs CRUD ─────────────────────────────────────────────────────
export interface SessionTabRecord {
  id: string;
  user_id: string;
  browser_tab_key: string;
  title: string;
  conversation_id: string;
  agent_id: string;
  agent_name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export const SessionTabService = {
  /** 获取用户的所有 session tabs */
  list(userId: string): SessionTabRecord[] {
    const db = getDb();
    return db.prepare(
      "SELECT * FROM session_tabs WHERE user_id = ? ORDER BY updated_at DESC"
    ).all(userId) as unknown as SessionTabRecord[];
  },

  /** 创建或更新（upsert） */
  upsert(tab: Omit<SessionTabRecord, "created_at" | "updated_at">): SessionTabRecord {
    const db = getDb();
    const now = new Date().toISOString();
    const existing = db
      .prepare(
        "SELECT id FROM session_tabs WHERE user_id = ? AND browser_tab_key = ?"
      )
      .get([tab.user_id, tab.browser_tab_key]);

    if (existing) {
      db.run(
        `UPDATE session_tabs SET title=?, conversation_id=?, agent_id=?, agent_name=?, color=?, updated_at=? WHERE user_id=? AND browser_tab_key=?`,
        [
          tab.title, tab.conversation_id, tab.agent_id, tab.agent_name,
          tab.color, now, tab.user_id, tab.browser_tab_key,
        ]
      );
    } else {
      db.run(
        `INSERT INTO session_tabs (id, user_id, browser_tab_key, title, conversation_id, agent_id, agent_name, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          tab.id, tab.user_id, tab.browser_tab_key, tab.title,
          tab.conversation_id, tab.agent_id, tab.agent_name, tab.color,
          now, now,
        ]
      );
    }

    const row = db
      .prepare(
        "SELECT * FROM session_tabs WHERE user_id = ? AND browser_tab_key = ?"
      )
      .get([tab.user_id, tab.browser_tab_key]) as unknown as SessionTabRecord;
    return row;
  },

  /** 删除 */
  delete(userId: string, browserTabKey: string): void {
    const db = getDb();
    db.run(
      "DELETE FROM session_tabs WHERE user_id = ? AND browser_tab_key = ?",
      [userId, browserTabKey]
    );
  },

  /** 批量 upsert */
  batchUpsert(userId: string, tabs: Array<{ browser_tab_key: string; title: string; conversation_id: string; agent_id: string; agent_name: string; color: string }>): SessionTabRecord[] {
    const db = getDb();
    const now = new Date().toISOString();
    const results: SessionTabRecord[] = [];
    for (const t of tabs) {
      const existing = db
        .prepare(
          "SELECT id FROM session_tabs WHERE user_id = ? AND browser_tab_key = ?"
        )
        .get([userId, t.browser_tab_key]);

      if (existing) {
        db.run(
          `UPDATE session_tabs SET title=?, conversation_id=?, agent_id=?, agent_name=?, color=?, updated_at=? WHERE user_id=? AND browser_tab_key=?`,
          [
            t.title, t.conversation_id, t.agent_id, t.agent_name,
            t.color, now, userId, t.browser_tab_key,
          ]
        );
      } else {
        const id = `stab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        db.run(
          `INSERT INTO session_tabs (id, user_id, browser_tab_key, title, conversation_id, agent_id, agent_name, color, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [
            id, userId, t.browser_tab_key, t.title,
            t.conversation_id, t.agent_id, t.agent_name, t.color,
            now, now,
          ]
        );
      }

      const row = db
        .prepare(
          "SELECT * FROM session_tabs WHERE user_id = ? AND browser_tab_key = ?"
        )
        .get([userId, t.browser_tab_key]) as unknown as SessionTabRecord;
      results.push(row);
    }
    return results;
  },
};

