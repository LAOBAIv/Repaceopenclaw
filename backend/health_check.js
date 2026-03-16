const http = require('http');
http.get('http://localhost:3001/health', r => {
  let d = '';
  r.on('data', c => d += c);
  r.on('end', () => console.log('HEALTH:', d));
}).on('error', e => console.log('ERR:', e.message));
