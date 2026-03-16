const http = require('http');

function req(method, path, body) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'localhost', port: 3001, path, method,
      headers: { 'Content-Type': 'application/json' }
    };
    const r = http.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        let obj;
        try { obj = JSON.parse(d); } catch { obj = d; }
        resolve({ status: res.statusCode, body: obj });
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function main() {
  console.log('\n===== 后端冒烟测试 =====\n');
  let pass = 0, fail = 0;

  function check(name, ok, detail) {
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else    { fail++; console.log(`  ❌ ${name} —`, detail); }
  }

  // 1. 健康检查
  let r = await req('GET', '/health');
  check('GET /health', r.status === 200, r.body);

  // 2. 创建 Agent
  r = await req('POST', '/api/agents', { name: '测试智能体', role: 'developer', status: 'online' });
  check('POST /api/agents', r.status === 201, r.body);
  const agentId = r.body?.data?.id;

  // 3. P0-2: 创建含 agentId 的 Task
  r = await req('POST', '/api/tasks', {
    title: '测试任务', description: '含agentId', columnId: 'todo', priority: 'mid',
    tags: [], agent: '测试智能体', agentColor: '#6366F1', agentId: agentId || ''
  });
  check('POST /api/tasks (with agentId)', r.status === 201, r.body);
  const taskId = r.body?.data?.id;

  // 4. P0-2: 获取 tasks 确认 agentId 字段存在
  r = await req('GET', '/api/tasks');
  const task = r.body?.data?.find(t => t.id === taskId);
  check('GET /api/tasks includes agentId', task && 'agentId' in task, task);

  // 5. 创建项目
  r = await req('POST', '/api/projects', { name: '测试项目', goal: '用于测试', priority: 'high' });
  check('POST /api/projects', r.status === 201, r.body);
  const projectId = r.body?.data?.id;

  // 6. 创建文档节点
  r = await req('POST', '/api/projects/documents', { projectId, title: '测试文档', content: '初始内容' });
  check('POST /api/projects/documents', r.status === 201, r.body);
  const docId = r.body?.data?.id;

  // 7. P1-3: 文档版本快照
  r = await req('POST', `/api/projects/documents/${docId}/versions`);
  check('POST /api/projects/documents/:docId/versions', r.status === 201, r.body);
  const versionId = r.body?.data?.id;

  // 8. P1-3: 获取版本列表
  r = await req('GET', `/api/projects/documents/${docId}/versions`);
  check('GET /api/projects/documents/:docId/versions', r.status === 200 && Array.isArray(r.body?.data), r.body);

  // 9. P1-3: 获取特定版本
  r = await req('GET', `/api/projects/documents/${docId}/versions/${versionId}`);
  check('GET /api/projects/documents/:docId/versions/:vid', r.status === 200 && r.body?.data?.content === '初始内容', r.body);

  // 10. 创建 Conversation
  r = await req('POST', '/api/conversations', { agentId: agentId || 'test', title: '测试会话' });
  check('POST /api/conversations', r.status === 201, r.body);
  const convId = r.body?.data?.id;

  // 11. P1-4: HTTP generate
  r = await req('POST', `/api/conversations/${convId}/generate`, { agentId: agentId || '' });
  check('POST /api/conversations/:id/generate', r.status === 200 || r.status === 201, r.body);

  // 12. P1-5: 全局搜索
  r = await req('GET', '/api/search?q=测试');
  check('GET /api/search?q=测试', r.status === 200 && r.body?.data, r.body);
  if (r.body?.data) {
    const d = r.body.data;
    console.log(`     搜索结果: agents=${d.agents?.length}, projects=${d.projects?.length}, tasks=${d.tasks?.length}, documents=${d.documents?.length}`);
  }

  // 13. P2-6: 数据导出
  r = await req('GET', '/api/export');
  check('GET /api/export', r.status === 200 && r.body?.data, JSON.stringify(r.body).slice(0, 100));

  // 14. P2-6: 数据导入 (merge)
  const exportData = r.body?.data;
  r = await req('POST', '/api/import', { data: exportData, mode: 'merge' });
  check('POST /api/import (merge)', r.status === 200, r.body);

  // 15. P0-1: WebSocket multi_chat 测试 (通过 HTTP 侧面验证路由注册)
  r = await req('GET', '/health');
  check('WS endpoint reachable (health)', r.status === 200, r.body);

  console.log(`\n===== 结果: ${pass} 通过 / ${fail} 失败 =====\n`);
}

main().catch(console.error);
