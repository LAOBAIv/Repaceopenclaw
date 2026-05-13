const http = require('http');

const body = JSON.stringify({
  provider: 'test-prov99',
  modelName: 'test-model',
  baseUrl: 'https://x.com/v1',
  apiKey: 'test-key-abc',
  authType: 'Bearer',
  enabled: true,
  priority: 0
});

const req = http.request({
  hostname: 'localhost',
  port: 3001,
  path: '/api/token-channels',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('STATUS:', res.statusCode);
    console.log('BODY:', d);
  });
});

req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();
