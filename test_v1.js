const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    const r = http.request(
      { hostname: 'localhost', port: 3001, path, method: 'GET', headers: { 'Authorization': 'Bearer test' } },
      (res) => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
          catch (e) { resolve({ status: res.statusCode, body: d.slice(0, 300) }); }
        });
      }
    );
    r.on('error', reject);
    r.end();
  });
}

async function main() {
  console.log('\n=== 测试 GET /v1/models ===');
  try {
    const res = await get('/v1/models');
    console.log('HTTP', res.status);
    if (res.body && res.body.data) {
      console.log('模型数量:', res.body.data.length);
      console.log('第一个模型:', JSON.stringify(res.body.data[0], null, 2));
    } else {
      console.log('响应:', JSON.stringify(res.body).slice(0, 300));
    }
  } catch (e) {
    console.log('失败:', e.message);
  }
}

main();
