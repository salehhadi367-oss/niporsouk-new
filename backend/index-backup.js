const http = require('http');

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });

  res.end(JSON.stringify({
    success: true,
    message: 'تم الاتصال بالسيرفر بنجاح ✅'
  }));
});

server.listen(3000, () => {
  console.log('Backend يعمل على http://localhost:3000');
});
