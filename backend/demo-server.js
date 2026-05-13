const http = require('http');
const fs = require('fs');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, 'demo.html'));

http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(HTML);
}).listen(8090, () => {
  console.log('Demo server running on http://localhost:8090');
});
