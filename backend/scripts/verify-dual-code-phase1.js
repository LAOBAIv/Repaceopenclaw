const { initDb } = require('../dist/db/client.js');
const { TaskService } = require('../dist/services/TaskService.js');
const { AgentService } = require('../dist/services/AgentService.js');
const { ConversationService } = require('../dist/services/ConversationService.js');
const fs = require('fs');
const initSqlJs = require('../node_modules/sql.js/dist/sql-wasm.js');

(async () => {
  await initDb();

  const SQL = await initSqlJs({
    locateFile: (f) => require('path').join(__dirname, '../node_modules/sql.js/dist', f),
  });
  const db = new SQL.Database(fs.readFileSync(require('path').join(__dirname, '../data/platform.db')));

  const query = (sql, args = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(args);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };

  const user = query('select id, user_code from users where user_code <> "" limit 1')[0];
  if (!user) throw new Error('No user with user_code found');

  const agent = AgentService.list(user.id)[0];
  if (!agent) throw new Error(`No agent found for user ${user.id}`);

  const task = TaskService.create({
    title: 'dual-code-phase1-verify-task',
    userId: user.id,
    agentId: agent.id,
    agent: agent.name,
    agentColor: agent.color,
  });

  const conversation = ConversationService.create({
    title: 'dual-code-phase1-verify-conv',
    userId: user.id,
    agentIds: [agent.id],
    currentAgentId: agent.id,
  });

  const message = ConversationService.addMessage({
    conversationId: conversation.id,
    role: 'agent',
    content: 'dual-code-phase1-verify-message',
    agentId: agent.id,
  });

  const result = {
    user,
    agent: { id: agent.id, agentCode: agent.agentCode },
    task: { id: task.id, taskCode: task.taskCode },
    conversation: {
      id: conversation.id,
      sessionCode: conversation.sessionCode,
      currentAgentId: conversation.currentAgentId,
      currentAgentCode: conversation.currentAgentCode,
    },
    message: { id: message.id, messageCode: message.messageCode },
    backfillBlankCounts: query(`
      select
        (select count(*) from users where user_code='' or user_code is null) as users_blank,
        (select count(*) from agents where agent_code='' or agent_code is null) as agents_blank,
        (select count(*) from tasks where task_code='' or task_code is null) as tasks_blank,
        (select count(*) from conversations where session_code='' or session_code is null) as conv_blank,
        (select count(*) from conversations where current_agent_id<>'' and (current_agent_code='' or current_agent_code is null)) as current_agent_code_blank,
        (select count(*) from messages m join conversations c on c.id=m.conversation_id where m.message_code='' or m.message_code is null) as live_message_blank,
        (select count(*) from messages m left join conversations c on c.id=m.conversation_id where c.id is null) as orphan_message_count
    `)[0],
  };

  console.log(JSON.stringify(result, null, 2));
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
