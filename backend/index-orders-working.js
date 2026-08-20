const http = require('http');

const products = [
  { id: 1, name: 'هاتف ذكي', price: 500000 },
  { id: 2, name: 'سماعات لاسلكية', price: 75000 },
  { id: 3, name: 'ساعة ذكية', price: 120000 }
];

const orders = [];
let nextOrderId = 1001;

const server = http.createServer((req, res) => {

  res.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  if (req.method === 'OPTIONS') {
    res.end();
    return;
  }

  if (req.url === '/products' && req.method === 'GET') {
    res.end(JSON.stringify(products));
    return;
  }

  if (req.url === '/orders' && req.method === 'POST') {

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {

      try {

        const data = JSON.parse(body);

        const order = {
          id: nextOrderId++,
          customer: {
            name: data.name,
            phone: data.phone,
            address: data.address
          },
          items: data.items,
          total: data.total,
          createdAt: new Date().toISOString()
        };

        orders.push(order);

        res.end(JSON.stringify({
          success: true,
          message: 'تم إنشاء الطلب بنجاح ✅',
          order: order
        }));

      } catch (error) {

        res.end(JSON.stringify({
          success: false,
          message: 'بيانات الطلب غير صحيحة'
        }));

      }

    });

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
