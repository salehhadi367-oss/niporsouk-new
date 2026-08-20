const http = require('http');
const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync(path.join(__dirname, 'marketplace.db'));

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


const ADMIN_USERNAME = 'swelhnipor';
const ADMIN_PASSWORD = 'nipor88';
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
  if (req.url.startsWith('/uploads/') && req.method === 'GET') {
    const filename = path.basename(req.url.substring('/uploads/'.length));
    const filepath = path.join(__dirname, 'uploads', filename);

    if (!fs.existsSync(filepath)) {
      res.writeHead(404);
      res.end('الصورة غير موجودة');
      return;
    }

    const ext = path.extname(filepath).toLowerCase();
    const types = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp'
    };

    res.writeHead(200, {
      'Content-Type': types[ext] || 'application/octet-stream',
      'Access-Control-Allow-Origin': '*'
    });

    fs.createReadStream(filepath).pipe(res);
    return;
  }

  if (req.url === '/login' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (
          data.username === ADMIN_USERNAME &&
          data.password === ADMIN_PASSWORD
        ) {
          sendJSON(res, { success: true, message: 'تم تسجيل الدخول بنجاح' });
        } else {
          sendJSON(res, { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
        }
      } catch (error) {
        sendJSON(res, { success: false, message: 'بيانات غير صحيحة' }, 400);
      }
    });

    return;
  } 
  if (req.url === '/upload' && req.method === 'POST') {
    const contentType = req.headers['content-type'] || '';

    if (!contentType.startsWith('multipart/form-data')) {
      sendJSON(res, {
        success: false,
        message: 'يجب إرسال صورة'
      }, 400);
      return;
    }

    const busboy = Busboy({ headers: req.headers });
    let savedFile = null;
    let pendingWrites = 0;
    let busboyFinished = false;

    const finishUpload = () => {
      if (!busboyFinished || pendingWrites > 0) return;

      if (!savedFile) {
        sendJSON(res, {
          success: false,
          message: 'لم يتم رفع صورة صحيحة'
        }, 400);
        return;
      }

      sendJSON(res, {
        success: true,
        image: `http://127.0.0.1:3000/uploads/${savedFile}`
      });
    };

    busboy.on('file', (fieldname, file, info) => {
      const ext = path.extname(info.filename || '').toLowerCase() || '.jpg';
      const allowed = ['.jpg', '.jpeg', '.png', '.webp'];

      if (!allowed.includes(ext)) {
        file.resume();
        return;
      }

      const filename = `product-${Date.now()}${ext}`;
      const filepath = path.join(__dirname, 'uploads', filename);

      pendingWrites++;

      const writeStream = fs.createWriteStream(filepath);
      file.pipe(writeStream);

      writeStream.on('finish', () => {
        savedFile = filename;
        pendingWrites--;
        finishUpload();
      });

      writeStream.on('error', (error) => {
        console.error(error);
        pendingWrites--;
        finishUpload();
      });
    });

    busboy.on('finish', () => {
      busboyFinished = true;
      finishUpload();
    });

    req.pipe(busboy);
    return;
  }
 if (req.url === '/products' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || data.price === undefined) {
          sendJSON(res, {
            success: false,
            message: 'اسم المنتج والسعر مطلوبان'
          }, 400);
          return;
        }

        const row = db.prepare(
          'SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM products'
        ).get();

        const productId = row.nextId;

        db.prepare(
                    'INSERT INTO products (id, name, price, category, description, image, seller_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(
          productId,
          data.name,
          Number(data.price),
          data.category || 'electronics',
          data.description || '',
          data.image || '',
          data.seller_id ?? null

        );

        sendJSON(res, {
          success: true,
          message: 'تمت إضافة المنتج بنجاح ✅',
          product: {
            id: productId,
            name: data.name,
            price: Number(data.price)
          }
        });

      } catch (error) {
        console.error(error);

        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء إضافة المنتج'
        }, 500);
      }
    });

    return;
  }  if (req.method === 'OPTIONS') {
    sendJSON(res, {});
    return;
  }

  if (req.url === '/products' && req.method === 'GET') {
    sendJSON(res, db.prepare(`
      SELECT products.id, products.name, products.price, products.category,
             products.description, products.image, products.seller_id,
             sellers.name AS seller_name
      FROM products
      LEFT JOIN sellers ON products.seller_id = sellers.id
      ORDER BY products.id
    `).all());
    return;
  }

 
  if (req.method === 'PUT' && req.url.startsWith('/products/')) {

    const url = new URL(req.url, 'http://localhost');
    const productId = Number(url.pathname.split('/')[2]);
    if (!Number.isInteger(productId)) {
      sendJSON(res, {
        success: false,
        message: 'معرف المنتج غير صحيح'
      }, 400);
      return;
    }
    const sellerId = Number(url.searchParams.get('seller_id'));

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || data.price === undefined) {
          sendJSON(res, {
            success: false,
            message: 'اسم المنتج والسعر مطلوبان'
          }, 400);
          return;
        }

        if (data.seller_id === undefined || data.seller_id === null) {
          sendJSON(res, {
            success: false,
            message: 'معرف البائع مطلوب'
          }, 400);
          return;
        }

        const result = db.prepare(
          'UPDATE products SET name = ?, price = ?, category = COALESCE(?, category), description = COALESCE(?, description), image = COALESCE(?, image) WHERE id = ? AND seller_id = ?'
        ).run(
          data.name,
          Number(data.price),
          data.category,
          data.description,
          data.image,
          productId,
          Number(data.seller_id)
        );

        if (result.changes === 0) {
          sendJSON(res, {
            success: false,
            message: 'المنتج غير موجود'
          }, 404);
          return;
        }

        sendJSON(res, {
          success: true,
          message: 'تم تعديل المنتج بنجاح ✅',
          product: {
            id: productId,
            name: data.name,
            price: Number(data.price),
category: data.category || 'electronics'

          }
        });

      } catch (error) {
        console.error(error);

        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء تعديل المنتج'
        }, 500);
      }
    });

    return;
  }
 if (req.method === 'DELETE' && req.url.startsWith('/products/')) {

const url = new URL(req.url, 'http://localhost');
const productId = Number(url.pathname.split('/')[2]);
    if (!Number.isInteger(productId)) {
      sendJSON(res, { success: false, message: 'معرف المنتج غير صحيح' }, 400);
      return;
    }
const sellerId = Number(url.searchParams.get('seller_id'));
    if (!Number.isInteger(sellerId)) {
      sendJSON(res, {
        success: false,
        message: 'معرف البائع مطلوب'
      }, 400);
      return;
    }

const result = db.prepare(
  'DELETE FROM products WHERE id = ? AND seller_id = ?'
).run(productId, sellerId);
    if (result.changes === 0) {
      sendJSON(res, { success: false, message: 'المنتج غير موجود' }, 404);
      return;
    }

    sendJSON(res, {
      success: true,
      message: 'تم حذف المنتج بنجاح ✅',
      productId
    });
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

        const insertItem = db.prepare(`
          INSERT INTO order_items
          (order_id, product_id, seller_id, quantity, price)
          VALUES (?, ?, ?, ?, ?)
        `);

        for (const item of data.items) {
          const product = db.prepare(
            'SELECT id, seller_id, price FROM products WHERE id = ?'
          ).get(item.id);

          if (!product) {
            throw new Error('المنتج غير موجود: ' + item.id);
          }

          insertItem.run(
            orderId,
            product.id,
            product.seller_id,
            Number(item.quantity) || 1,
            product.price
          );
        }
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

    const orders = rows.map(order => {
      const oldItems = JSON.parse(order.items || '[]');

      const orderItems = db.prepare(`
        SELECT order_items.product_id,
               order_items.seller_id,
               order_items.quantity,
               order_items.price,
               sellers.name AS seller_name
        FROM order_items
        LEFT JOIN sellers ON order_items.seller_id = sellers.id
        WHERE order_items.order_id = ?
        ORDER BY order_items.id
      `).all(order.id);

      const items = orderItems.length > 0
        ? oldItems.map(item => {
            const savedItem = orderItems.find(
              oi => Number(oi.product_id) === Number(item.id)
            );

            return {
              ...item,
              seller_id: savedItem ? savedItem.seller_id : null,
              seller_name: savedItem ? savedItem.seller_name : null,
              price: savedItem ? savedItem.price : item.price
            };
          })
        : oldItems;

      return {
        id: order.id,
        customer: {
          name: order.name,
          phone: order.phone,
          address: order.address
        },
        items,
        total: order.total,
        createdAt: order.created_at,
        status: order.status
      };
    });

    sendJSON(res, orders);
    return;
  }


  if (req.url.startsWith("/orders/") && req.method === "GET") {
    const orderId = Number(req.url.split("/")[2]);

    const order = db.prepare(`
      SELECT id, name, phone, address, items, total, created_at, status
      FROM orders
      WHERE id = ?
    `).get(orderId);

    if (!order) {
      sendJSON(res, {
        success: false,
        message: "الطلب غير موجود"
      }, 404);
      return;
    }

    const oldItems = JSON.parse(order.items || '[]');

    const orderItems = db.prepare(`
      SELECT order_items.product_id,
             order_items.seller_id,
             order_items.quantity,
             order_items.price,
             sellers.name AS seller_name
      FROM order_items
      LEFT JOIN sellers ON order_items.seller_id = sellers.id
      WHERE order_items.order_id = ?
      ORDER BY order_items.id
    `).all(order.id);

    const items = orderItems.length > 0
      ? oldItems.map(item => {
          const savedItem = orderItems.find(
            oi => Number(oi.product_id) === Number(item.id)
          );

          return {
            ...item,
            seller_id: savedItem ? savedItem.seller_id : null,
            seller_name: savedItem ? savedItem.seller_name : null,
            price: savedItem ? savedItem.price : item.price
          };
        })
      : oldItems;

    sendJSON(res, {
      success: true,
      order: {
        id: order.id,
        customer: {
          name: order.name,
          phone: order.phone,
          address: order.address
        },
        items,
        total: order.total,
        createdAt: order.created_at,
        status: order.status
      }
    });
    return;
  }


  if (req.method === "DELETE" && req.url.startsWith("/orders/")) {
    const orderId = Number(req.url.split("/")[2]);

    const result = db
      .prepare("DELETE FROM orders WHERE id = ?")
      .run(orderId);

    if (result.changes === 0) {
      sendJSON(res, {
        success: false,
        message: "الطلب غير موجود"
      });
      return;
    }

    sendJSON(res, {
      success: true,
      message: "تم حذف الطلب بنجاح"
    });
    return;
  } if (req.url.startsWith("/orders/") && req.url.endsWith("/status") && req.method === "PUT") {
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
