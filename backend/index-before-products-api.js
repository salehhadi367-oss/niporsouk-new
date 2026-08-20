const http = require('http');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('./marketplace.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT NOT NULL,
    items TEXT NOT NULL,
    total REAL NOT NULL,
    created_at TEXT NOT NULL
  )
`);

const products = [
  { id: 1, name: 'هاتف ذكي', price: 500000 },
  { id: 2, name: 'سماعات لاسلكية', price: 75000 },
  { id: 3, name: 'ساعة ذكية', price: 120000 }
];

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });

  res.end(JSON.stringify(data));
}

const server = http.createServer((req, res) => {

  if (req.method === 'OPTIONS') {
    sendJSON(res, {});
    return;
  }

  if (req.url === '/products' && req.method === 'GET') {
    sendJSON(res, products);
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

        if (!data.name || !data.phone || !data.address || !data.items) {
          sendJSON(res, {
            success: false,
            message: 'بيانات الطلب ناقصة'
          }, 400);
          return;
        }

        const row = db.prepare(
  'SELECT COALESCE(MAX(id), 1000) + 1 AS nextId FROM orders'
).get();

const orderId = row.nextId;
const createdAt = new Date().toISOString();

const insert = db.prepare(`
  INSERT INTO orders
  (id, name, phone, address, items, total, created_at, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

insert.run(
  orderId,
  data.name,
  data.phone,
  data.address,
  JSON.stringify(data.items),
  Number(data.total) || 0,
  createdAt,
  'new'
);

        sendJSON(res, {
          success: true,
          message: 'تم إنشاء الطلب وحفظه بنجاح ✅',
          order: {
            id: orderId,
            customer: {
              name: data.name,
              phone: data.phone,
              address: data.address
            },
            items: data.items,
            total: Number(data.total) || 0,
            createdAt: createdAt
          }
        });

      } catch (error) {

        console.error(error);

        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء حفظ الطلب'
        }, 500);
      }
    });

    return;
  }

  if (req.url === '/orders' && req.method === 'GET') {

    const rows = db.prepare(`
      SELECT id, name, phone, address, items, total, created_at, status
      FROM orders
      ORDER BY id DESC
    `).all();

    const orders = rows.map(order => ({
      id: order.id,
      customer: {
        name: order.name,
        phone: order.phone,
        address: order.address
      },
      items: JSON.parse(order.items),
      total: order.total,
      createdAt: order.created_at,
      status: order.status
    }));

    sendJSON(res, orders);
    return;
  }

  if (req.url.startsWith("/orders/") && req.url.endsWith("/status") && req.method === "PUT") {
    const orderId = Number(req.url.split("/")[2]);
    let body = "";

    req.on("data", chunk => { body += chunk; });

    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const allowedStatuses = ["new", "processing", "shipped", "completed"];

        if (!allowedStatuses.includes(data.status)) {
          sendJSON(res, { success: false, message: "حالة غير صالحة" }, 400);
          return;
        }

        const update = db.prepare("UPDATE orders SET status = ? WHERE id = ?");
        const result = update.run(data.status, orderId);

        if (result.changes === 0) {
          sendJSON(res, { success: false, message: "الطلب غير موجود" }, 404);
          return;
        }

        sendJSON(res, { success: true, message: "تم تحديث حالة الطلب بنجاح ✅", orderId, status: data.status });
      } catch (error) {
        console.error(error);
        sendJSON(res, { success: false, message: "حدث خطأ أثناء تحديث الطلب" }, 500);
      }
    });

    return;
  }
  sendJSON(res, {
    success: true,
    message: 'تم الاتصال بالسيرفر بنجاح ✅'
  });
});

server.listen(3000, () => {
  console.log('Backend يعمل على http://localhost:3000');
});
