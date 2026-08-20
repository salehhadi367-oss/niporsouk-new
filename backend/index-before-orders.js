const http = require('http');

const products = [
  { id: 1, name: 'هاتف ذكي', price: 500000 },
  { id: 2, name: 'سماعات لاسلكية', price: 75000 },
  { id: 3, name: 'ساعة ذكية', price: 120000 }
];

const server = http.createServer((req, res) => {

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });

  if (req.url === '/products') {
    res.end(JSON.stringify(products));
    return;
  }

  res.end(JSON.stringify({
    success: true,
    message: 'تم الاتصال بالسيرفر بنجاح ✅'
  }));

});

server.listen(3000, () => {
  console.log('Backend يعمل على http://localhost:3000');
});
