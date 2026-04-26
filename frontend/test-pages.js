import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

const results = [];

const pages = [
  { name: '登录页', url: 'http://localhost:3001/login' },
  { name: '工作台', url: 'http://localhost:3001/workspace' },
  { name: 'Agent创建', url: 'http://localhost:3001/agent-create' },
  { name: '智能体管理', url: 'http://localhost:3001/agents' },
  { name: 'Agent模板库', url: 'http://localhost:3001/agent-library' },
  { name: '看板', url: 'http://localhost:3001/kanban' },
];

for (const p of pages) {
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text().substring(0, 200));
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message.substring(0, 200));
  });

  try {
    const response = await page.goto(p.url, { waitUntil: 'networkidle', timeout: 15000 });
    const status = response.status();
    const hasErrors = pageErrors.length > 0;

    results.push({
      name: p.name,
      url: p.url,
      status,
      ok: status === 200 && !hasErrors,
      pageErrors,
      consoleErrors: consoleErrors.slice(0, 3),
    });
  } catch (err) {
    results.push({
      name: p.name,
      url: p.url,
      status: 'N/A',
      ok: false,
      error: err.message.substring(0, 200),
    });
  }
}

await browser.close();

console.log('\n═══════════════════════════════════════');
console.log('       前端页面自动化测试结果');
console.log('═══════════════════════════════════════\n');

for (const r of results) {
  const icon = r.ok ? '✅' : '❌';
  console.log(`${icon} ${r.name} — ${r.url} (HTTP ${r.status})`);
  if (r.error) console.log(`   🔴 ${r.error}`);
  if (r.pageErrors?.length) {
    for (const e of r.pageErrors) console.log(`   🔴 ${e}`);
  }
  if (r.consoleErrors?.length) {
    for (const e of r.consoleErrors) console.log(`   🟡 ${e}`);
  }
  console.log('');
}

const passed = results.filter(r => r.ok).length;
const total = results.length;
console.log(`───────────────────────────────────────`);
console.log(`总计: ${passed}/${total} 通过`);
console.log(`───────────────────────────────────────\n`);

const allPassed = results.every(r => r.ok);
console.log(allPassed ? '🎉 全部通过！前端正常。' : '⚠️ 有页面存在问题，需要修复。');
process.exit(allPassed ? 0 : 1);
