const WebSocket = require('ws');
const http = require('http');

async function test() {
  // 1. 登录
  const loginRes = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'test@test.com', password: 'test123' });
    const req = http.request('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  const token = loginRes.token;
  if (!token && loginRes.user && loginRes.user.token) token = loginRes.user.token;
  
  console.log('登录:', token ? '✅' : '❌');
  
  // 2. 获取 claude agent
  const agents = await new Promise((resolve, reject) => {
    const req = http.request('http://localhost:3001/api/agents', {
      headers: { 'Authorization': 'Bearer ' + (loginRes.token || '') },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.end();
  });
  
  let agentId = '';
  let agentName = '';
  for (const a of (agents.data || [])) {
    if (a.modelName === 'claude-opus-4-6') { agentId = a.id; agentName = a.name; break; }
  }
  if (!agentId && agents.data?.length) { agentId = agents.data[0].id; agentName = agents.data[0].name; }
  console.log('智能体:', agentName, agentId ? '(' + agentId.substring(0, 8) + '...)' : '❌');
  
  // 3. 创建会话
  const conv = await new Promise((resolve, reject) => {
    const data = JSON.stringify({ agentIds: [agentId], title: '测试会话' });
    const req = http.request('http://localhost:3001/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token, 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve(JSON.parse(body)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
  const convId = conv.data?.id;
  console.log('会话:', convId ? '✅ ' + convId.substring(0, 8) : '❌', conv.error ? conv.error.message : '');
  
  if (!convId) { console.log('创建会话失败'); process.exit(1); }
  
  // 4. WebSocket 测试
  const ws = new WebSocket('ws://localhost:3001/ws');
  let fullResponse = '';
  
  ws.on('open', () => {
    console.log('\n📡 发送消息: "请用2句话介绍你自己"');
    ws.send(JSON.stringify({
      type: 'chat',
      conversationId: convId,
      agentId: agentId,
      content: '请用2句话介绍你自己',
    }));
  });
  
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'user_message') console.log('✅ 用户消息已保存');
      if (msg.type === 'agent_start') console.log('🤖 智能体响应中...');
      if (msg.type === 'agent_chunk' && msg.chunk) {
        fullResponse += msg.chunk;
        process.stdout.write('.');
      }
      if (msg.type === 'agent_done') {
        console.log('\n\n════════ 回复内容 ════════');
        console.log(fullResponse);
        console.log('\n═══════════════════════════');
        console.log('长度:', fullResponse.length, '字符');
        console.log('质量: ' + (fullResponse.length > 20 ? '✅ 正常' : '❌ 内容为空'));
        ws.close();
        process.exit(0);
      }
      if (msg.type === 'error') {
        console.log('\n❌ 错误:', msg.message);
        ws.close();
        process.exit(1);
      }
    } catch (e) {}
  });
  
  setTimeout(() => {
    console.log('\n⏱️ 超时(60s)，已收到:', fullResponse.length, '字符');
    if (fullResponse.length > 0) console.log(fullResponse.substring(0, 500));
    ws.close();
    process.exit(fullResponse.length > 20 ? 0 : 1);
  }, 60000);
}

test().catch(e => { console.error(e); process.exit(1); });
