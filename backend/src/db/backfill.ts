// [2026-05-18] 从 client.ts 拆分出业务码回填逻辑
import { execToRows } from "./client";
import { IdGenerator } from "../utils/IdGenerator";

// ── Dual-code backfill（idempotent）──────────────────────────────────────────
export function backfillBusinessCodes(db: any) {
  // 设计原则：
  // 1) 只补业务码，不改 UUID 主键，不重写外键
  // 2) 幂等执行：重复启动不会重复生成已存在的业务码
  // 3) 旧数据优先复用已有 taskId 语义，减少会话链路抖动

  // users.user_code
  for (const row of execToRows(db, "SELECT id, user_code FROM users")) {
    if (!row.user_code) {
      let userCode = '';
      do {
        userCode = IdGenerator.userCode();
      } while (execToRows(db, "SELECT id FROM users WHERE user_code=? AND id<>?", [userCode, row.id]).length);
      db.run("UPDATE users SET user_code=? WHERE id=?", [userCode, row.id]);
    }
  }

  // agents.agent_code（同用户唯一）
  for (const row of execToRows(db, "SELECT id, user_id, agent_code FROM agents")) {
    if (!row.agent_code) {
      let agentCode = '';
      do {
        agentCode = IdGenerator.agentCode();
      } while (execToRows(db, "SELECT id FROM agents WHERE user_id=? AND agent_code=? AND id<>?", [row.user_id || '', agentCode, row.id]).length);
      db.run("UPDATE agents SET agent_code=? WHERE id=?", [agentCode, row.id]);
    }
  }

  // tasks.task_code
  // task_code 是后续 session_code 的来源，因此先补 task，再补 conversation。
  for (const row of execToRows(db, "SELECT id, user_id, task_code FROM tasks")) {
    if (!row.task_code) {
      const user = execToRows(db, "SELECT user_code FROM users WHERE id=?", [row.user_id || ''])[0];
      const userCode = user?.user_code || IdGenerator.userCode();
      let taskCode = '';
      do {
        taskCode = IdGenerator.taskCode(userCode);
      } while (execToRows(db, "SELECT id FROM tasks WHERE task_code=? AND id<>?", [taskCode, row.id]).length);
      db.run("UPDATE tasks SET task_code=? WHERE id=?", [taskCode, row.id]);
    }
  }

  // conversations.session_code / current_agent_code
  // 优先级：tasks.task_code > 历史业务 taskId > 重新生成。
  for (const row of execToRows(db, "SELECT id, user_id, task_id, session_code, current_agent_id, current_agent_code FROM conversations")) {
    let sessionCode = row.session_code || '';
    if (!sessionCode) {
      const task = row.task_id ? execToRows(db, "SELECT task_code FROM tasks WHERE id=?", [row.task_id])[0] : null;
      if (task?.task_code) {
        sessionCode = task.task_code;
      } else if (row.task_id && IdGenerator.validate.taskId(String(row.task_id))) {
        // 兼容历史过渡期：若 task_id 里存的就是旧业务 taskId，则直接复用为 session_code
        sessionCode = row.task_id;
      } else {
        const user = execToRows(db, "SELECT user_code FROM users WHERE id=?", [row.user_id || ''])[0];
        const userCode = user?.user_code || IdGenerator.userCode();
        sessionCode = IdGenerator.taskCode(userCode);
      }
      db.run("UPDATE conversations SET session_code=? WHERE id=?", [sessionCode, row.id]);
    }

    if (!row.current_agent_code && row.current_agent_id && sessionCode) {
      const agent = execToRows(db, "SELECT agent_code FROM agents WHERE id=?", [row.current_agent_id])[0];
      if (agent?.agent_code) {
        db.run("UPDATE conversations SET current_agent_code=? WHERE id=?", [IdGenerator.currentAgentCode(sessionCode, agent.agent_code), row.id]);
      }
    }
  }

  // messages.message_code（按 conversation_id + created_at 排序回填）
  // 只给仍然能找到所属 conversation 的消息回填；孤儿消息保持原状，避免误绑到错误会话。
  for (const conv of execToRows(db, "SELECT id, session_code FROM conversations WHERE session_code <> ''")) {
    const msgs = execToRows(db, "SELECT id, message_code FROM messages WHERE conversation_id=? ORDER BY created_at ASC, id ASC", [conv.id]);
    let seq = 1;
    for (const msg of msgs) {
      if (!msg.message_code) {
        try {
          db.run("UPDATE messages SET message_code=? WHERE id=?", [IdGenerator.messageCode(conv.session_code, seq), msg.id]);
        } catch (e: any) {
          // UNIQUE 约束冲突时跳过（已存在的 message_code）
          if (!e?.message?.includes('UNIQUE')) throw e;
        }
      }
      seq += 1;
    }
  }
}

