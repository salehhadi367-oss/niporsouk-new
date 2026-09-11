const { httpServerHandler } = require("cloudflare:node");
const http = require('http');
const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// جلسات الدخول المؤقتة للإدارة والبائعين
const sessions = new Map();

function createSession(type, userId = null) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    type,
    userId,
    createdAt: Date.now()
  });
  return token;
}

function getSession(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7).trim();
  return sessions.get(token) || null;
}

function requireSession(req, type, userId = null) {
  const session = getSession(req);

  if (!session || session.type !== type) return false;

  if (userId !== null && Number(session.userId) !== Number(userId)) {
    return false;
  }

  return true;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored) return false;

  // كلمات المرور القديمة غير المشفرة
  if (!stored.startsWith('scrypt:')) {
    return stored === password;
  }

  const parts = stored.split(':');
  if (parts.length !== 3) return false;

  const salt = parts[1];
  const storedHash = Buffer.from(parts[2], 'hex');
  const hash = crypto.scryptSync(password, salt, 64);

  return storedHash.length === hash.length &&
    crypto.timingSafeEqual(storedHash, hash);
}
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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
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

  if (req.method === 'GET') {
    const requested = decodeURIComponent(req.url.split('?')[0]);
    const relative = requested === '/' ? '/index.html' : requested;
    const frontendRoot = path.join(__dirname, '..', 'frontend');
    const filePath = path.resolve(frontendRoot, '.' + relative);

    if (filePath.startsWith(frontendRoot + path.sep) || filePath === path.join(frontendRoot, 'index.html')) {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'application/javascript; charset=utf-8',
          '.css': 'text/css; charset=utf-8',
          '.json': 'application/json; charset=utf-8',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.webp': 'image/webp',
          '.svg': 'image/svg+xml'
        };
        res.writeHead(200, {
          'Content-Type': types[ext] || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*'
        });
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
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
          const token = createSession('admin');

          sendJSON(res, {
            success: true,
            message: 'تم تسجيل الدخول بنجاح',
            token
          });
        } else {
          sendJSON(res, { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' }, 401);
        }
      } catch (error) {
        sendJSON(res, { success: false, message: 'بيانات غير صحيحة' }, 400);
      }
    });

    return;
  } 
  if (req.url === '/seller-login' && req.method === 'POST') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.email || !data.password) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
          }, 400);
          return;
        }

        const seller = db.prepare(`
          SELECT id, name, phone, email, password, status
          FROM sellers
          WHERE email = ?
        `).get(data.email);

        if (!seller) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          }, 401);
          return;
        }

        if (!verifyPassword(data.password, seller.password)) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          }, 401);
          return;
        }

        // تحويل كلمة المرور القديمة إلى نسخة مشفرة بعد أول تسجيل دخول
        if (!seller.password.startsWith('scrypt:')) {
          const hashedPassword = hashPassword(data.password);

          db.prepare(
            'UPDATE sellers SET password = ? WHERE id = ?'
          ).run(hashedPassword, seller.id);
        }

        if (seller.status !== 'active') {
          sendJSON(res, {
            success: false,
            message: 'حساب البائع غير مفعّل'
          }, 403);
          return;
        }

        const token = createSession('seller', seller.id);

        sendJSON(res, {
          success: true,
          message: 'تم تسجيل دخول البائع بنجاح',
          token: token,
          seller: {
            id: seller.id,
            name: seller.name,
            phone: seller.phone,
            email: seller.email
          }
        });
      } catch (error) {
        console.error('Seller login error:', error);

        sendJSON(res, {
          success: false,
          message: 'بيانات غير صحيحة'
        }, 400);
      }
    });

    return;
  }

  if (req.url === '/delivery-register' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || !data.phone || !data.email || !data.password) {
          sendJSON(res, {
            success: false,
            message: 'الاسم والهاتف والبريد الإلكتروني وكلمة المرور مطلوبة'
          }, 400);
          return;
        }

        const existing = db.prepare(
          'SELECT id FROM delivery_agents WHERE email = ?'
        ).get(data.email);

        if (existing) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني مستخدم مسبقًا'
          }, 409);
          return;
        }

        const hashedPassword = hashPassword(data.password);

        const result = db.prepare(`
          INSERT INTO delivery_agents (name, phone, email, password, status)
          VALUES (?, ?, ?, ?, 'active')
        `).run(
          data.name,
          data.phone,
          data.email,
          hashedPassword
        );

        sendJSON(res, {
          success: true,
          message: 'تم إنشاء حساب المندوب بنجاح',
          deliveryAgent: {
            id: Number(result.lastInsertRowid),
            name: data.name,
            phone: data.phone,
            email: data.email,
            status: 'active'
          }
        });
      } catch (error) {
        console.error('Delivery register error:', error);
        sendJSON(res, {
          success: false,
          message: 'بيانات التسجيل غير صحيحة'
        }, 400);
      }
    });

    return;
  }

  if (req.url === '/delivery-login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.email || !data.password) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني وكلمة المرور مطلوبان'
          }, 400);
          return;
        }

        const agent = db.prepare(`
          SELECT id, name, phone, email, password, status
          FROM delivery_agents
          WHERE email = ?
        `).get(data.email);

        if (!agent || !verifyPassword(data.password, agent.password)) {
          sendJSON(res, {
            success: false,
            message: 'البريد الإلكتروني أو كلمة المرور غير صحيحة'
          }, 401);
          return;
        }

        if (agent.status !== 'active') {
          sendJSON(res, {
            success: false,
            message: 'حساب المندوب غير مفعّل'
          }, 403);
          return;
        }

        const token = createSession('delivery', agent.id);

        sendJSON(res, {
          success: true,
          message: 'تم تسجيل دخول المندوب بنجاح',
          token: token,
          deliveryAgent: {
            id: agent.id,
            name: agent.name,
            phone: agent.phone,
            email: agent.email
          }
        });
      } catch (error) {
        console.error('Delivery login error:', error);
        sendJSON(res, {
          success: false,
          message: 'بيانات غير صحيحة'
        }, 400);
      }
    });

    return;
  }

  if (req.url === '/restaurant-register' && req.method === 'POST') {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (!data.name || !data.email || !data.password) {
          sendJSON(res, { success: false, message: "الاسم والبريد وكلمة المرور مطلوبة" }, 400);
          return;
        }
        const existing = db.prepare("SELECT id FROM restaurant_accounts WHERE email = ?").get(data.email);
        if (existing) {
          sendJSON(res, { success: false, message: "هذا البريد مسجل مسبقًا" }, 409);
          return;
        }
        const password = hashPassword(data.password);
        const result = db.prepare(
          "INSERT INTO restaurant_accounts (name, phone, email, password) VALUES (?, ?, ?, ?)"
        ).run(data.name, data.phone || "", data.email, password);
        sendJSON(res, {
          success: true,
          message: "تم إنشاء حساب المطعم بنجاح",
          restaurantAccount: {
            id: Number(result.lastInsertRowid),
            name: data.name,
            phone: data.phone || "",
            email: data.email
          }
        });
      } catch (error) {
        console.error("Restaurant register error:", error);
        sendJSON(res, { success: false, message: "بيانات التسجيل غير صحيحة" }, 400);
      }
    });
    return;
  }

  if (req.url === '/restaurant-login' && req.method === 'POST') {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        if (!data.email || !data.password) {
          sendJSON(res, { success: false, message: "البريد الإلكتروني وكلمة المرور مطلوبان" }, 400);
          return;
        }
        const account = db.prepare(
          "SELECT id, name, phone, email, password, status FROM restaurant_accounts WHERE email = ?"
        ).get(data.email);

        if (!account || !verifyPassword(data.password, account.password)) {
          sendJSON(res, { success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" }, 401);
          return;
        }

        if (account.status !== "active") {
          sendJSON(res, { success: false, message: "حساب المطعم غير مفعّل" }, 403);
          return;
        }

        const token = createSession("restaurant", account.id);
        sendJSON(res, {
          success: true,
          message: "تم تسجيل دخول المطعم بنجاح",
          token,
          restaurantAccount: {
            id: account.id,
            name: account.name,
            phone: account.phone,
            email: account.email
          }
        });
      } catch (error) {
        console.error("Restaurant login error:", error);
        sendJSON(res, { success: false, message: "بيانات غير صحيحة" }, 400);
      }
    });
    return;
  }



  // ===== Public Restaurants List =====
  if (req.url === '/restaurants' && req.method === 'GET') {
    try {
      const restaurants = db.prepare(
        "SELECT id, name, phone, address, image, status FROM restaurants WHERE status = 'active' ORDER BY id DESC"
      ).all();

      sendJSON(res, {
        success: true,
        restaurants
      });
    } catch (error) {
      console.error('Restaurants list error:', error);
      sendJSON(res, {
        success: false,
        message: 'حدث خطأ أثناء تحميل المطاعم'
      }, 500);
    }
    return;
  }


  // ===== Public Restaurant Items =====
  if (req.method === 'GET' && req.url.startsWith('/restaurant-items/')) {
    try {
      const restaurantId = Number(req.url.split('/')[2]);

      if (!Number.isInteger(restaurantId) || restaurantId <= 0) {
        sendJSON(res, { success:false, message:'معرف المطعم غير صحيح' }, 400);
        return;
      }

      const restaurant = db.prepare(
        "SELECT id, name, phone, address, image FROM restaurants WHERE id = ? AND status = 'active'"
      ).get(restaurantId);

      if (!restaurant) {
        sendJSON(res, { success:false, message:'المطعم غير موجود' }, 404);
        return;
      }

      const items = db.prepare(
        "SELECT id, restaurant_id, name, price, description, image, category FROM restaurant_items WHERE restaurant_id = ? AND active = 1 ORDER BY id DESC"
      ).all(restaurantId);

      sendJSON(res, {
        success:true,
        restaurant,
        items
      });
    } catch (error) {
      console.error('Public restaurant items error:', error);
      sendJSON(res, {
        success:false,
        message:'حدث خطأ أثناء تحميل وجبات المطعم'
      }, 500);
    }
    return;
  }

  // ===== Restaurant API =====
  if (req.url === '/restaurants' && req.method === 'POST') {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, { success: false, message: 'غير مصرح لك بإضافة مطعم' }, 401);
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name) {
          sendJSON(res, { success: false, message: 'اسم المطعم مطلوب' }, 400);
          return;
        }

        const existing = db.prepare(
          'SELECT id FROM restaurants WHERE account_id = ?'
        ).get(session.userId);

        if (existing) {
          sendJSON(res, {
            success: false,
            message: 'لديك مطعم مسجل مسبقًا'
          }, 409);
          return;
        }

        const result = db.prepare(
          'INSERT INTO restaurants (name, phone, address, image, status, account_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          data.name,
          data.phone || '',
          data.address || '',
          data.image || '',
          'active',
          session.userId
        );

        sendJSON(res, {
          success: true,
          message: 'تم إضافة المطعم بنجاح',
          restaurant: {
            id: Number(result.lastInsertRowid),
            name: data.name,
            phone: data.phone || '',
            address: data.address || '',
            image: data.image || '',
            status: 'active',
            account_id: session.userId
          }
        });
      } catch (error) {
        console.error('Restaurant create error:', error);
        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء إضافة المطعم'
        }, 500);
      }
    });

    return;
  }

  if (req.url === '/restaurants/my' && req.method === 'GET') {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك'
      }, 401);
      return;
    }

    const restaurant = db.prepare(
      'SELECT id, name, phone, address, image, status, account_id FROM restaurants WHERE account_id = ?'
    ).get(session.userId);

    sendJSON(res, {
      success: true,
      restaurant: restaurant || null
    });

    return;
  }


  // ===== Restaurant Items API =====
  if (req.url === '/restaurant-items' && req.method === 'POST') {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, { success: false, message: 'غير مصرح لك بإضافة وجبة' }, 401);
      return;
    }

    const restaurant = db.prepare(
      'SELECT id FROM restaurants WHERE account_id = ?'
    ).get(session.userId);

    if (!restaurant) {
      sendJSON(res, { success: false, message: 'يجب إضافة المطعم أولًا' }, 404);
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || data.price === undefined) {
          sendJSON(res, {
            success: false,
            message: 'اسم الوجبة والسعر مطلوبان'
          }, 400);
          return;
        }

        const result = db.prepare(
          'INSERT INTO restaurant_items (restaurant_id, name, price, description, image, category) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(
          restaurant.id,
          data.name,
          Number(data.price),
          data.description || '',
          data.image || '',
          data.category || 'وجبات'
        );

        sendJSON(res, {
          success: true,
          message: 'تمت إضافة الوجبة بنجاح',
          item: {
            id: Number(result.lastInsertRowid),
            restaurant_id: restaurant.id,
            name: data.name,
            price: Number(data.price),
            description: data.description || '',
            image: data.image || '',
            category: data.category || 'وجبات',
            active: 1
          }
        });
      } catch (error) {
        console.error('Restaurant item create error:', error);
        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء إضافة الوجبة'
        }, 500);
      }
    });

    return;
  }


  // ===== Restaurant Item Edit/Delete =====
  if (req.method === 'PUT' && req.url.startsWith('/restaurant-items/')) {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, { success:false, message:'غير مصرح لك' }, 401);
      return;
    }

    const itemId = Number(req.url.split('/')[2]);
    if (!Number.isInteger(itemId) || itemId <= 0) {
      sendJSON(res, { success:false, message:'معرف الوجبة غير صحيح' }, 400);
      return;
    }

    const restaurant = db.prepare(
      'SELECT id FROM restaurants WHERE account_id = ?'
    ).get(session.userId);

    if (!restaurant) {
      sendJSON(res, { success:false, message:'المطعم غير موجود' }, 404);
      return;
    }

    let body = '';
    req.on('data', chunk => { body += chunk; });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        const item = db.prepare(
          'SELECT id FROM restaurant_items WHERE id = ? AND restaurant_id = ?'
        ).get(itemId, restaurant.id);

        if (!item) {
          sendJSON(res, { success:false, message:'الوجبة غير موجودة' }, 404);
          return;
        }

        db.prepare(
          'UPDATE restaurant_items SET name = ?, price = ?, description = ?, category = ? WHERE id = ? AND restaurant_id = ?'
        ).run(
          data.name,
          Number(data.price),
          data.description || '',
          data.category || 'وجبات',
          itemId,
          restaurant.id
        );

        sendJSON(res, { success:true, message:'تم تعديل الوجبة بنجاح' });
      } catch (error) {
        console.error('Restaurant item update error:', error);
        sendJSON(res, { success:false, message:'حدث خطأ أثناء تعديل الوجبة' }, 500);
      }
    });
    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/restaurant-items/')) {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, { success:false, message:'غير مصرح لك' }, 401);
      return;
    }

    const itemId = Number(req.url.split('/')[2]);

    const restaurant = db.prepare(
      'SELECT id FROM restaurants WHERE account_id = ?'
    ).get(session.userId);

    if (!restaurant) {
      sendJSON(res, { success:false, message:'المطعم غير موجود' }, 404);
      return;
    }

    const result = db.prepare(
      'UPDATE restaurant_items SET active = 0 WHERE id = ? AND restaurant_id = ?'
    ).run(itemId, restaurant.id);

    if (result.changes === 0) {
      sendJSON(res, { success:false, message:'الوجبة غير موجودة' }, 404);
      return;
    }

    sendJSON(res, { success:true, message:'تم حذف الوجبة بنجاح' });
    return;
  }

  if (req.url === '/restaurant-items/my' && req.method === 'GET') {
    const session = getSession(req);

    if (!session || session.type !== 'restaurant') {
      sendJSON(res, { success: false, message: 'غير مصرح لك' }, 401);
      return;
    }

    const restaurant = db.prepare(
      'SELECT id FROM restaurants WHERE account_id = ?'
    ).get(session.userId);

    if (!restaurant) {
      sendJSON(res, {
        success: false,
        message: 'المطعم غير موجود'
      }, 404);
      return;
    }

    const items = db.prepare(
      'SELECT id, restaurant_id, name, price, description, image, category, active FROM restaurant_items WHERE restaurant_id = ? ORDER BY id DESC'
    ).all(restaurant.id);

    sendJSON(res, {
      success: true,
      items
    });

    return;
  }

  if (req.url === '/upload' && req.method === 'POST') {
    console.log("UPLOAD AUTH:", req.headers.authorization || "NO AUTH");
    console.log("UPLOAD SESSION:", getSession(req));
    if (!requireSession(req, "admin") && !requireSession(req, "seller")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك برفع الصور'
      }, 401);
      return;
    }

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
    const session = getSession(req);
    if (!session || (session.type !== "admin" && session.type !== "seller")) {
      sendJSON(res, {
        success: false,
        message: "غير مصرح لك بإضافة منتج"
      }, 401);
      return;
    }

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

  if (req.url.startsWith('/products') && req.method === 'GET') {
    const url = new URL(req.url, 'http://localhost');
    const sellerIdParam = url.searchParams.get('seller_id');

    let products;

    if (sellerIdParam !== null) {
      const sellerId = Number(sellerIdParam);

      if (!Number.isInteger(sellerId) || sellerId <= 0) {
        sendJSON(res, {
          success: false,
          message: 'معرف البائع غير صحيح'
        }, 400);
        return;
      }

      products = db.prepare(`
        SELECT products.id, products.name, products.price, products.category,
               products.description, products.image, products.seller_id, products.active,
               sellers.name AS seller_name
        FROM products
        LEFT JOIN sellers ON products.seller_id = sellers.id
        WHERE products.seller_id = ?
        ORDER BY products.id
      `).all(sellerId);
    } else {
      products = db.prepare(`
        SELECT products.id, products.name, products.price, products.category,
               products.description, products.image, products.seller_id, products.active,
               sellers.name AS seller_name
        FROM products
        LEFT JOIN sellers ON products.seller_id = sellers.id
        WHERE products.active = 1
        ORDER BY products.id
      `).all();
    }

    sendJSON(res, products);
    return;
  }

 
  if (req.method === 'PUT' && req.url.startsWith('/delivery-agents/')) {
    const session = getSession(req);

    if (!session || session.type !== 'admin') {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك'
      }, 401);
      return;
    }

    const agentId = Number(req.url.split('/')[2]);

    if (!Number.isInteger(agentId) || agentId <= 0) {
      sendJSON(res, {
        success: false,
        message: 'معرف المندوب غير صحيح'
      }, 400);
      return;
    }

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!['active', 'inactive'].includes(data.status)) {
          sendJSON(res, {
            success: false,
            message: 'حالة المندوب غير صحيحة'
          }, 400);
          return;
        }

        const result = db.prepare(
          'UPDATE delivery_agents SET status = ? WHERE id = ?'
        ).run(data.status, agentId);

        if (Number(result.changes) !== 1) {
          sendJSON(res, {
            success: false,
            message: 'المندوب غير موجود'
          }, 404);
          return;
        }

        sendJSON(res, {
          success: true,
          message: data.status === 'active'
            ? 'تم تفعيل المندوب'
            : 'تم تعطيل المندوب'
        });
      } catch (error) {
        console.error('Delivery agent status error:', error);
        sendJSON(res, {
          success: false,
          message: 'بيانات غير صحيحة'
        }, 400);
      }
    });

    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/delivery-agents/')) {
    const session = getSession(req);

    if (!session || session.type !== 'admin') {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك'
      }, 401);
      return;
    }

    const agentId = Number(req.url.split('/')[2]);

    if (!Number.isInteger(agentId) || agentId <= 0) {
      sendJSON(res, {
        success: false,
        message: 'معرف المندوب غير صحيح'
      }, 400);
      return;
    }

    try {
      const result = db.prepare(
        'DELETE FROM delivery_agents WHERE id = ?'
      ).run(agentId);

      if (Number(result.changes) !== 1) {
        sendJSON(res, {
          success: false,
          message: 'المندوب غير موجود'
        }, 404);
        return;
      }

      sendJSON(res, {
        success: true,
        message: 'تم حذف المندوب بنجاح'
      });
    } catch (error) {
      console.error('Delete delivery agent error:', error);
      sendJSON(res, {
        success: false,
        message: 'تعذر حذف المندوب'
      }, 500);
    }

    return;
  }

  if (req.url === '/delivery-agents' && req.method === 'GET') {
    const session = getSession(req);

    if (!session || session.type !== 'admin') {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك'
      }, 401);
      return;
    }

    try {
      const agents = db.prepare(`
        SELECT id, name, phone, email, status
        FROM delivery_agents
        ORDER BY id DESC
      `).all();

      sendJSON(res, {
        success: true,
        agents
      });
    } catch (error) {
      console.error('Delivery agents error:', error);
      sendJSON(res, {
        success: false,
        message: 'تعذر تحميل المندوبين'
      }, 500);
    }

    return;
  }

  if (req.method === 'PUT' && req.url.startsWith('/products/')) {
    const session = getSession(req);

    if (!session || (session.type !== 'admin' && session.type !== 'seller')) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بتعديل المنتج'
      }, 401);
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const productId = Number(url.pathname.split('/')[2]);

    if (!Number.isInteger(productId)) {
      sendJSON(res, {
        success: false,
        message: 'معرف المنتج غير صحيح'
      }, 400);
      return;
    }

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        const product = db.prepare(
          'SELECT id, seller_id FROM products WHERE id = ?'
        ).get(productId);

        if (!product) {
          sendJSON(res, {
            success: false,
            message: 'المنتج غير موجود'
          }, 404);
          return;
        }

        if (
          session.type === 'seller' &&
          Number(product.seller_id) !== Number(session.userId)
        ) {
          sendJSON(res, {
            success: false,
            message: 'لا يمكنك تعديل منتج بائع آخر'
          }, 403);
          return;
        }

        const name = String(data.name ?? '').trim();
        const price = Number(data.price);
        const category = String(data.category ?? '');
        const description = String(data.description ?? '');
        const image = String(data.image ?? '');

        if (!name || !Number.isFinite(price)) {
          sendJSON(res, {
            success: false,
            message: 'اسم المنتج والسعر مطلوبان'
          }, 400);
          return;
        }

        db.prepare(`
          UPDATE products
          SET name = ?, price = ?, category = ?, description = ?, image = ?
          WHERE id = ?
        `).run(name, price, category, description, image, productId);

        sendJSON(res, {
          success: true,
          message: 'تم تعديل المنتج بنجاح',
          productId
        });
      } catch (error) {
        console.error('Update product error:', error);

        sendJSON(res, {
          success: false,
          message: 'بيانات المنتج غير صحيحة'
        }, 400);
      }
    });

    return;
  }

  if (req.method === 'DELETE' && req.url.startsWith('/products/')) {
    const session = getSession(req);

    if (!session || (session.type !== 'admin' && session.type !== 'seller')) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بحذف المنتج'
      }, 401);
      return;
    }

    const url = new URL(req.url, 'http://localhost');
    const productId = Number(url.pathname.split('/')[2]);

    if (!Number.isInteger(productId)) {
      sendJSON(res, {
        success: false,
        message: 'معرف المنتج غير صحيح'
      }, 400);
      return;
    }

    const product = db.prepare(
      'SELECT id, seller_id FROM products WHERE id = ?'
    ).get(productId);

    if (!product) {
      sendJSON(res, {
        success: false,
        message: 'المنتج غير موجود'
      }, 404);
      return;
    }

    if (
      session.type === 'seller' &&
      Number(product.seller_id) !== Number(session.userId)
    ) {
      sendJSON(res, {
        success: false,
        message: 'لا يمكنك حذف منتج بائع آخر'
      }, 403);
      return;
    }

    db.prepare(
      'UPDATE products SET active = 0 WHERE id = ?'
    ).run(productId);

    sendJSON(res, {
      success: true,
      message: 'تم إخفاء المنتج بنجاح ✅',
      productId
    });

    return;
  }

if (req.url === '/admin-stats' && req.method === 'GET') {
    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بعرض الإحصائيات'
      }, 401);
      return;
    }

    try {
      const visitors = db.prepare(
        'SELECT COUNT(DISTINCT visitor_id) AS count FROM site_visits'
      ).get().count;

      const customers = db.prepare(
        "SELECT COUNT(DISTINCT phone) AS count FROM orders WHERE phone IS NOT NULL AND TRIM(phone) != ''"
      ).get().count;

      const sellers = db.prepare(
        'SELECT COUNT(*) AS count FROM sellers'
      ).get().count;

      const deliveryAgents = db.prepare(
        'SELECT COUNT(*) AS count FROM delivery_agents'
      ).get().count;

      const products = db.prepare(
        'SELECT COUNT(*) AS count FROM products WHERE active = 1'
      ).get().count;

      const totalOrders = db.prepare(
        'SELECT COUNT(*) AS count FROM orders'
      ).get().count;

      const orderStatuses = db.prepare(
        'SELECT status, COUNT(*) AS count FROM orders GROUP BY status'
      ).all();

      const statuses = {
        new: 0,
        processing: 0,
        shipped: 0,
        completed: 0,
        cancelled: 0
      };

      for (const row of orderStatuses) {
        if (Object.prototype.hasOwnProperty.call(statuses, row.status)) {
          statuses[row.status] = row.count;
        }
      }

      sendJSON(res, {
        success: true,
        stats: {
          visitors,
          customers,
          sellers,
          deliveryAgents,
          products,
          totalOrders,
          ordersByStatus: statuses
        }
      });
    } catch (error) {
      console.error('Admin stats error:', error);
      sendJSON(res, {
        success: false,
        message: 'تعذر تحميل الإحصائيات'
      }, 500);
    }

    return;
  }

// ===== Admin Restaurants =====
if (req.url.startsWith('/admin/restaurants/') && req.method === 'PUT') {
  if (!requireSession(req, "admin")) {
    sendJSON(res, { success: false, message: "غير مصرح" }, 401);
    return;
  }

  const id = Number(req.url.split('/')[3]);

  if (!Number.isInteger(id) || id <= 0) {
    sendJSON(res, { success: false, message: "معرف المطعم غير صحيح" }, 400);
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const status = data.status === 'active' ? 'active' : 'inactive';

      const result = db.prepare(
        "UPDATE restaurants SET status = ? WHERE id = ?"
      ).run(status, id);

      if (result.changes === 0) {
        sendJSON(res, { success: false, message: "المطعم غير موجود" }, 404);
        return;
      }

      sendJSON(res, {
        success: true,
        message: status === 'active' ? 'تم تفعيل المطعم' : 'تم تعطيل المطعم'
      });
    } catch (error) {
      console.error("Admin restaurant update error:", error);
      sendJSON(res, {
        success: false,
        message: "تعذر تعديل حالة المطعم"
      }, 500);
    }
  });

  return;
}

if (req.url === '/admin/restaurants' && req.method === 'GET') {
  if (!requireSession(req, "admin")) {
    sendJSON(res, { success: false, message: "غير مصرح" }, 401);
    return;
  }

  try {
    const restaurants = db.prepare(
      `SELECT id, name, phone, address, image, status, account_id
       FROM restaurants
       ORDER BY id DESC`
    ).all();

    sendJSON(res, {
      success: true,
      restaurants
    });
  } catch (error) {
    console.error("Admin restaurants error:", error);
    sendJSON(res, {
      success: false,
      message: "تعذر تحميل المطاعم"
    }, 500);
  }
  return;
}

if (req.url === '/sellers' && req.method === 'GET') {
    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بعرض البائعين'
      }, 401);
      return;
    }

    const sellers = db.prepare(`
      SELECT id, name, phone, email, status
      FROM sellers
      ORDER BY id DESC
    `).all();

    sendJSON(res, sellers);
    return;
  }

if (req.url === '/sellers' && req.method === 'POST') {
    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بإضافة بائع'
      }, 401);
      return;
    }

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name || !data.password) {
          sendJSON(res, {
            success: false,
            message: 'اسم البائع وكلمة المرور مطلوبان'
          }, 400);
          return;
        }

        const result = db.prepare(`
          INSERT INTO sellers (name, phone, email, password, status)
          VALUES (?, ?, ?, ?, ?)
        `).run(
          data.name,
          data.phone || '',
          data.email || '',
          hashPassword(data.password),
          data.status || 'active'
        );

        const seller = db.prepare(`
          SELECT id, name, phone, email, status
          FROM sellers
          WHERE id = ?
        `).get(result.lastInsertRowid);

        sendJSON(res, {
          success: true,
          message: 'تمت إضافة البائع بنجاح ✅',
          seller
        });
      } catch (error) {
        console.error(error);
        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء إضافة البائع'
        }, 500);
      }
    });

    return;
  }

if (req.method === 'PUT' && req.url.startsWith('/sellers/')) {
    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بتعديل بيانات البائع'
      }, 401);
      return;
    }

    const sellerId = Number(req.url.split('/')[2]);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      sendJSON(res, {
        success: false,
        message: 'رقم البائع غير صالح'
      }, 400);
      return;
    }

    const seller = db.prepare(
      'SELECT id FROM sellers WHERE id = ?'
    ).get(sellerId);

    if (!seller) {
      sendJSON(res, {
        success: false,
        message: 'البائع غير موجود'
      }, 404);
      return;
    }

    let body = '';

    req.on('data', chunk => {
      body += chunk;
    });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);

        if (!data.name) {
          sendJSON(res, {
            success: false,
            message: 'اسم البائع مطلوب'
          }, 400);
          return;
        }

        db.prepare(`
          UPDATE sellers
          SET name = ?, phone = ?, email = ?, status = ?
          WHERE id = ?
        `).run(
          data.name,
          data.phone || '',
          data.email || '',
          data.status || 'active',
          sellerId
        );

        const updatedSeller = db.prepare(`
          SELECT id, name, phone, email, status
          FROM sellers
          WHERE id = ?
        `).get(sellerId);

        sendJSON(res, {
          success: true,
          message: 'تم تحديث بيانات البائع بنجاح ✅',
          seller: updatedSeller
        });
      } catch (error) {
        console.error(error);
        sendJSON(res, {
          success: false,
          message: 'حدث خطأ أثناء تحديث بيانات البائع'
        }, 500);
      }
    });

    return;
  }

if (req.method === 'DELETE' && req.url.startsWith('/sellers/')) {
    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بحذف البائع'
      }, 401);
      return;
    }

    const sellerId = Number(req.url.split('/')[2]);

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      sendJSON(res, {
        success: false,
        message: 'رقم البائع غير صالح'
      }, 400);
      return;
    }

    const seller = db.prepare(
      'SELECT id FROM sellers WHERE id = ?'
    ).get(sellerId);

    if (!seller) {
      sendJSON(res, {
        success: false,
        message: 'البائع غير موجود'
      }, 404);
      return;
    }

    const productCount = db.prepare(
      'SELECT COUNT(*) AS count FROM products WHERE seller_id = ?'
    ).get(sellerId).count;

    const orderItemCount = db.prepare(
      'SELECT COUNT(*) AS count FROM order_items WHERE seller_id = ?'
    ).get(sellerId).count;

    if (productCount > 0 || orderItemCount > 0) {
      sendJSON(res, {
        success: false,
        message: 'لا يمكن حذف البائع لأنه مرتبط بمنتجات أو طلبات'
      }, 409);
      return;
    }

    db.prepare('DELETE FROM sellers WHERE id = ?').run(sellerId);

    sendJSON(res, {
      success: true,
      message: 'تم حذف البائع بنجاح ✅',
      sellerId
    });
    return;
  }


if (req.url === '/seller-stats' && req.method === 'GET') {

    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بعرض إحصائيات البائعين'
      }, 401);
      return;
    }

    try {

      const stats = db.prepare(`
        SELECT
          sellers.id,
          sellers.name,
          sellers.status,
          COUNT(DISTINCT order_items.order_id) AS orders_count,
          COALESCE(SUM(order_items.price * order_items.quantity), 0) AS sales_total
        FROM sellers
        LEFT JOIN order_items
          ON sellers.id = order_items.seller_id
        GROUP BY sellers.id
        ORDER BY sellers.id DESC
      `).all();

      const result = stats.map(seller => ({
        id: seller.id,
        name: seller.name,
        status: seller.status,
        ordersCount: Number(seller.orders_count),
        salesTotal: Number(seller.sales_total),
        dueAmount: Number(seller.sales_total)
      }));

      sendJSON(res, result);

    } catch (error) {

      console.error(error);

      sendJSON(res, {
        success: false,
        message: 'حدث خطأ أثناء حساب مبيعات البائعين'
      }, 500);
    }

    return;
  }


if (req.method === 'GET' && req.url.startsWith('/seller-orders/')) {

    const sellerId = Number(req.url.split('/')[2]);
    const session = getSession(req);

    if (!session || (session.type !== 'admin' && session.type !== 'seller')) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بعرض طلبات البائع'
      }, 401);
      return;
    }

    if (
      session.type === 'seller' &&
      Number(session.userId) !== sellerId
    ) {
      sendJSON(res, {
        success: false,
        message: 'لا يمكنك عرض طلبات بائع آخر'
      }, 403);
      return;
    }

    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      sendJSON(res, {
        success: false,
        message: 'رقم البائع غير صالح'
      }, 400);
      return;
    }

    try {

      const rows = db.prepare(`
        SELECT
          orders.id,
          orders.name,
          orders.phone,
          orders.address,
          orders.created_at,
          orders.status,
          order_items.product_id,
          order_items.quantity,
          order_items.price,
          products.name AS product_name
        FROM order_items
        JOIN orders ON orders.id = order_items.order_id
        LEFT JOIN products ON products.id = order_items.product_id
        WHERE order_items.seller_id = ?
        ORDER BY orders.id DESC, order_items.id DESC
      `).all(sellerId);

      const grouped = {};

      for (const row of rows) {

        if (!grouped[row.id]) {
          grouped[row.id] = {
            id: row.id,
            customer: {
              name: row.name,
              phone: row.phone,
              address: row.address
            },
            createdAt: row.created_at,
            status: row.status,
            items: [],
            total: 0
          };
        }

        grouped[row.id].items.push({
          id: row.product_id,
          name: row.product_name,
          quantity: row.quantity,
          price: row.price
        });

        grouped[row.id].total +=
          Number(row.price) * Number(row.quantity);
      }

      sendJSON(res, {
        success: true,
        orders: Object.values(grouped)
      });

    } catch (error) {

      console.error(error);

      sendJSON(res, {
        success: false,
        message: 'حدث خطأ أثناء تحميل طلبات البائع'
      }, 500);
    }

    return;
  }


// ==================== PAYMENT TEST ====================

if (req.url === '/payment-test' && req.method === 'POST') {
  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      if (!data.order_id) {
        sendJSON(res, {
          success: false,
          message: 'رقم الطلب مطلوب'
        }, 400);
        return;
      }

      const order = db.prepare(
        'SELECT id, total, payment_method, payment_status FROM orders WHERE id = ?'
      ).get(Number(data.order_id));

      if (!order) {
        sendJSON(res, {
          success: false,
          message: 'الطلب غير موجود'
        }, 404);
        return;
      }

      if (order.payment_method !== 'online') {
        sendJSON(res, {
          success: false,
          message: 'الطلب ليس دفعًا إلكترونيًا'
        }, 400);
        return;
      }

      sendJSON(res, {
        success: true,
        message: 'تم إنشاء عملية الدفع التجريبية ✅',
        payment: {
          order_id: order.id,
          amount: order.total,
          status: 'pending'
        }
      });

    } catch (error) {
      console.error(error);

      sendJSON(res, {
        success: false,
        message: 'حدث خطأ في عملية الدفع التجريبية'
      }, 500);
    }
  });

  return;
}

if (req.url === '/delivery-orders' && req.method === 'GET') {
  const session = getSession(req);

  if (!session || session.type !== 'delivery') {
    sendJSON(res, {
      success: false,
      message: 'غير مصرح لك'
    }, 401);
    return;
  }

  try {
    const orders = db.prepare(`
      SELECT
        id,
        name,
        phone,
        address,
        total,
        created_at,
        status
      FROM orders
      WHERE delivery_agent_id IS NULL
        AND status IN ('new', 'processing', 'shipped')
      ORDER BY id DESC
    `).all();

    sendJSON(res, {
      success: true,
      orders
    });
  } catch (error) {
    console.error('Delivery orders error:', error);
    sendJSON(res, {
      success: false,
      message: 'تعذر تحميل الطلبات'
    }, 500);
  }

  return;
}

if (req.url === '/delivery-my-orders' && req.method === 'GET') {
  const session = getSession(req);

  if (!session || session.type !== 'delivery') {
    sendJSON(res, {
      success: false,
      message: 'غير مصرح لك'
    }, 401);
    return;
  }

  try {
    const orders = db.prepare(`
      SELECT
        id,
        name,
        phone,
        address,
        total,
        created_at,
        status,
        delivery_agent_id
      FROM orders
      WHERE delivery_agent_id = ?
      ORDER BY id DESC
    `).all(session.userId);

    sendJSON(res, {
      success: true,
      orders
    });
  } catch (error) {
    console.error('Delivery my orders error:', error);
    sendJSON(res, {
      success: false,
      message: 'تعذر تحميل طلباتك'
    }, 500);
  }

  return;
}

if (req.method === 'PUT' && req.url.startsWith('/delivery-orders/') && req.url.endsWith('/claim')) {
  const session = getSession(req);

  if (!session || session.type !== 'delivery') {
    sendJSON(res, {
      success: false,
      message: 'غير مصرح لك'
    }, 401);
    return;
  }

  const agent = db.prepare(
    'SELECT id, status FROM delivery_agents WHERE id = ?'
  ).get(session.userId);

  if (!agent || agent.status !== 'active') {
    sendJSON(res, {
      success: false,
      message: 'حساب المندوب غير مفعّل'
    }, 403);
    return;
  }

  const parts = req.url.split('/');
  const orderId = Number(parts[2]);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    sendJSON(res, {
      success: false,
      message: 'رقم الطلب غير صحيح'
    }, 400);
    return;
  }

  try {
    const result = db.prepare(`
      UPDATE orders
      SET delivery_agent_id = ?
      WHERE id = ?
        AND delivery_agent_id IS NULL
    `).run(agent.id, orderId);

    if (Number(result.changes) !== 1) {
      sendJSON(res, {
        success: false,
        message: 'الطلب غير متاح أو تم استلامه من مندوب آخر'
      }, 409);
      return;
    }

    const order = db.prepare(`
      SELECT id, name, phone, address, total, created_at, status, delivery_agent_id
      FROM orders
      WHERE id = ?
    `).get(orderId);

    sendJSON(res, {
      success: true,
      message: 'تم استلام الطلب بنجاح',
      order
    });
  } catch (error) {
    console.error('Delivery claim error:', error);
    sendJSON(res, {
      success: false,
      message: 'تعذر استلام الطلب'
    }, 500);
  }

  return;
}

if (req.method === 'PUT' && req.url.startsWith('/delivery-my-orders/') && req.url.endsWith('/status')) {
  const session = getSession(req);

  if (!session || session.type !== 'delivery') {
    sendJSON(res, {
      success: false,
      message: 'غير مصرح لك'
    }, 401);
    return;
  }

  const parts = req.url.split('/');
  const orderId = Number(parts[2]);

  if (!Number.isInteger(orderId) || orderId <= 0) {
    sendJSON(res, {
      success: false,
      message: 'رقم الطلب غير صحيح'
    }, 400);
    return;
  }

  let body = '';

  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const allowedStatuses = ['processing', 'shipped', 'completed'];

      if (!allowedStatuses.includes(data.status)) {
        sendJSON(res, {
          success: false,
          message: 'حالة الطلب غير صحيحة'
        }, 400);
        return;
      }

      const result = db.prepare(`
        UPDATE orders
        SET status = ?
        WHERE id = ?
          AND delivery_agent_id = ?
      `).run(data.status, orderId, session.userId);

      if (Number(result.changes) !== 1) {
        sendJSON(res, {
          success: false,
          message: 'الطلب غير موجود ضمن طلباتك'
        }, 404);
        return;
      }

      const order = db.prepare(`
        SELECT id, name, phone, address, total, created_at, status, delivery_agent_id
        FROM orders
        WHERE id = ?
      `).get(orderId);

      sendJSON(res, {
        success: true,
        message: 'تم تحديث حالة الطلب',
        order
      });
    } catch (error) {
      console.error('Delivery status error:', error);
      sendJSON(res, {
        success: false,
        message: 'بيانات غير صحيحة'
      }, 400);
    }
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

        const paymentMethod =
          data.payment_method === 'online' ? 'online' : 'cod';

        const paymentStatus = 'pending';

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

let serverTotal = 0;
const validatedItems = [];

for (const item of data.items) {
  const quantity = Number(item.quantity) || 1;

  if (item.cartType === 'restaurant') {
    const restaurantItem = db.prepare(
      "SELECT id, restaurant_id, name, price FROM restaurant_items WHERE id = ? AND active = 1"
    ).get(item.id);

    if (!restaurantItem) {
      throw new Error('وجبة المطعم غير موجودة: ' + item.id);
    }

    const price = Number(restaurantItem.price) || 0;

    serverTotal += price * quantity;

    validatedItems.push({
      id: restaurantItem.id,
      name: restaurantItem.name,
      price: price,
      quantity: quantity,
      seller_id: null,
      restaurant_item_id: restaurantItem.id,
      restaurant_id: restaurantItem.restaurant_id,
      cartType: 'restaurant'
    });

  } else {
    const product = db.prepare(
      'SELECT id, seller_id, price FROM products WHERE id = ?'
    ).get(item.id);

    if (!product) {
      throw new Error('المنتج غير موجود: ' + item.id);
    }

    const price = Number(product.price) || 0;

    serverTotal += price * quantity;

    validatedItems.push({
      id: product.id,
      name: item.name,
      price: price,
      quantity: quantity,
      seller_id: product.seller_id,
      cartType: 'product'
    });
  }
}

const insert = db.prepare(`
  INSERT INTO orders
  (id, name, phone, address, items, total, created_at, status, payment_method, payment_status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

insert.run(
  orderId,
  data.name,
  data.phone,
  data.address,
  JSON.stringify(validatedItems),
  serverTotal,
  createdAt,
  'new',
  paymentMethod,
  paymentStatus
);

const insertItem = db.prepare(`
  INSERT INTO order_items
  (order_id, product_id, seller_id, quantity, price, restaurant_item_id, restaurant_id)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

for (const item of validatedItems) {
  insertItem.run(
    orderId,
    item.cartType === 'restaurant' ? null : item.id,
    item.seller_id,
    item.quantity,
    item.price,
    item.restaurant_item_id || null,
    item.restaurant_id || null
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
            items: validatedItems,
            total: serverTotal,
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

    if (!requireSession(req, "admin")) {
      sendJSON(res, {
        success: false,
        message: 'غير مصرح لك بعرض الطلبات'
      }, 401);
      return;
    }

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
    const session = getSession(req);
    if (!session || (session.type !== "admin" && session.type !== "seller")) {
      sendJSON(res, {
        success: false,
        message: "غير مصرح لك بتنفيذ هذه العملية"
      }, 401);
      return;
    }

    const orderId = Number(req.url.split("/")[2]);

    if (session.type === "seller") {
      const owned = db.prepare(
        "SELECT 1 FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1"
      ).get(orderId, Number(session.userId));

      if (!owned) {
        sendJSON(res, {
          success: false,
          message: "لا يمكنك تغيير حالة طلب لا يحتوي على منتجاتك"
        }, 403);
        return;
      }
    }

    const order = db
      .prepare("SELECT id FROM orders WHERE id = ?")
      .get(orderId);

    if (!order) {
      sendJSON(res, {
        success: false,
        message: "الطلب غير موجود"
      });
      return;
    }

    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(orderId);

    db.prepare("DELETE FROM orders WHERE id = ?").run(orderId);

    sendJSON(res, {
      success: true,
      message: "تم حذف الطلب والعناصر المرتبطة به بنجاح"
    });
    return;
  } if (req.url.startsWith("/orders/") && req.url.endsWith("/status") && req.method === "PUT") {
    const session = getSession(req);

    if (!session || (session.type !== "admin" && session.type !== "seller")) {
      sendJSON(res, {
        success: false,
        message: "غير مصرح لك بتنفيذ هذه العملية"
      }, 401);
      return;
    }

    const orderId = Number(req.url.split("/")[2]);

    if (!Number.isInteger(orderId)) {
      sendJSON(res, {
        success: false,
        message: "معرف الطلب غير صحيح"
      }, 400);
      return;
    }

    // البائع يستطيع تعديل الطلبات التي تحتوي على منتجاته فقط
    if (session.type === "seller") {
      const sellerOrder = db.prepare(
        "SELECT 1 FROM order_items WHERE order_id = ? AND seller_id = ? LIMIT 1"
      ).get(orderId, Number(session.userId));

      if (!sellerOrder) {
        sendJSON(res, {
          success: false,
          message: "غير مصرح لك بتعديل هذا الطلب"
        }, 403);
        return;
      }
    }
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
  if (req.url === '/track-visit' && req.method === 'POST') {
    try {
      const visitorId = req.headers['x-visitor-id'];

      if (!visitorId || typeof visitorId !== 'string' || visitorId.length > 100) {
        sendJSON(res, {
          success: false,
          message: 'معرف الزائر غير صالح'
        }, 400);
        return;
      }

      db.prepare(
        'INSERT INTO site_visits (visitor_id, visited_at) VALUES (?, ?)'
      ).run(visitorId, new Date().toISOString());

      sendJSON(res, {
        success: true,
        message: 'تم تسجيل الزيارة بنجاح ✅'
      });
    } catch (error) {
      console.error('Track visit error:', error);
      sendJSON(res, {
        success: false,
        message: 'حدث خطأ أثناء تسجيل الزيارة'
      }, 500);
    }
    return;
  }

  sendJSON(res, {
    success: true,
    message: 'تم الاتصال بالسيرفر بنجاح ✅'
  });
});


server.listen(3000);
export default httpServerHandler(server);
