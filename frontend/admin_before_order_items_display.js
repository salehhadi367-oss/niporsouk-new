<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Marketplace - لوحة الإدارة</title>

  <style>
    body {
      font-family: Arial, sans-serif;
      background: #f2f2f2;
      margin: 0;
      padding: 20px;
    }

    h1 {
      text-align: center;
    }

    button {
      padding: 10px 18px;
      font-size: 16px;
      cursor: pointer;
      margin-bottom: 20px;
    }

    .order {
      background: white;
      padding: 18px;
      margin-bottom: 15px;
      border-radius: 12px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .order h2 {
      margin-top: 0;
    }

    .items {
      background: #f8f8f8;
      padding: 10px;
      margin-top: 10px;
      border-radius: 8px;
    }

    .status {
      text-align: center;
      margin-bottom: 15px;
      font-weight: bold;
    }
/* تحسين لوحة الإدارة للموبايل */
@media (max-width: 600px) {
  body {
    padding: 10px;
    font-size: 15px;
  }

  h1 {
    font-size: 24px;
    text-align: center;
  }

  h2 {
    font-size: 20px;
  }

  input,
  button {
    box-sizing: border-box;
    max-width: 100%;
  }

  button {
    margin: 4px 2px;
    padding: 10px 12px;
    border-radius: 8px;
}

  #orders > div,
  #productsList > div {
    margin-bottom: 12px;
    padding: 12px;
    border-radius: 10px;
  }
} 
 </style>
</head>

<body>
<div id="loginScreen" style="position:fixed;top:0;left:0;width:100%;height:100%;background:white;z-index:9999;text-align:center;margin:50px auto;max-width:350px;">
  <h2>🔐 تسجيل دخول الإدارة</h2>
  <input id="username" placeholder="اسم المستخدم" style="display:block;width:100%;padding:10px;margin:10px 0;">
  <input id="password" type="password" placeholder="كلمة المرور" style="display:block;width:100%;padding:10px;margin:10px 0;">
  <button onclick="backendLogin()" style="padding:10px;width:100%;">دخول</button>
  <p id="loginMessage"></p>
</div>
  <h1>🧑‍💼 لوحة إدارة Mini Marketplace</h1>
<div id="dashboardStats"></div>


<div style="display:flex; gap:15px; flex-wrap:wrap; margin:20px 0;">
  <div style="background:white; padding:20px; border-radius:10px; flex:1; min-width:150px; text-align:center;">
    <h3>🛍️ المنتجات</h3>
    <p id="productsCount" style="font-size:24px; font-weight:bold;">0</p>
  </div>

  <div style="background:white; padding:20px; border-radius:10px; flex:1; min-width:150px; text-align:center;">
    <h3>📦 الطلبات</h3>
    <p id="ordersCount" style="font-size:24px; font-weight:bold;">0</p>
  </div>

  <div style="background:white; padding:20px; border-radius:10px; flex:1; min-width:150px; text-align:center;">
    <h3>🆕 الجديدة</h3>
    <p id="newOrdersCount" style="font-size:24px; font-weight:bold;">0</p>
  </div>

  <div style="background:white; padding:20px; border-radius:10px; flex:1; min-width:150px; text-align:center;">
    <h3>💰 المبيعات</h3>
    <p id="salesTotal" style="font-size:24px; font-weight:bold;">0</p>
  </div>
</div>
  <div style="background:white; padding:20px; margin-bottom:20px; border-radius:12px;">
    <h2>➕ إضافة منتج جديد</h2>
    <input id="productName" type="text" placeholder="اسم المنتج" style="padding:10px; width:90%; margin-bottom:10px;">
    <input id="productPrice" type="number" placeholder="السعر" style="padding:10px; width:90%; margin-bottom:10px;">
    <textarea id="productDescription" placeholder="وصف المنتج" style="padding:10px; width:90%; margin-bottom:10px; min-height:70px;"></textarea>
<input id="productImage" type="url" placeholder="رابط صورة المنتج (اختياري)" style="padding:10px; width:90%; margin-bottom:10px;">

<input id="productImageFile" type="file" accept="image/*" style="padding:10px; width:90%; margin-bottom:10px;">
<input id="editProductImageFile" type="file" accept="image/*" style="padding:10px; width:90%; margin-bottom:10px;">

<small style="display:block; margin-bottom:10px;">📷 أو اختر صورة من الهاتف</small>
<select id="addProductCategory" style="padding:10px; width:90%; margin-bottom:10px;">
  <option value="electronics">📱 إلكترونيات</option>
  <option value="watches">⌚ ساعات</option>
  <option value="accessories">🎧 إكسسوارات</option>
</select>
    <button onclick="addProduct()">➕ إضافة المنتج</button>
    <p id="productMessage"></p>
  </div>

  <div style="background:white; padding:20px; margin-bottom:20px; border-radius:12px;">
    <h2>📦 إدارة المنتجات</h2>

    <button onclick="loadProducts()">🔄 تحديث المنتجات</button>

<input
  type="text"
  id="productSearch">
<select
  id="productCategory"
  onchange="filterProducts()"
  style="width:100%; padding:12px; margin:10px 0; border:1px solid #ccc; border-radius:8px; box-sizing:border-box;"
>
  <option value="">📂 كل التصنيفات</option>
  <option value="electronics">📱 إلكترونيات</option>
  <option value="watches">⌚ ساعات</option>
  <option value="accessories">🎧 إكسسوارات</option>
</select>

  style="width:100%; padding:12px; margin:10px 0; border:1px solid #ccc; border-radius:8px; box-sizing:border-box;"
>
   
 <div id="productsList" style="margin-top:15px;">
      جاري تحميل المنتجات...
    </div>
  </div> 
 <div id="status" class="status">
    جاري تحميل الطلبات...
  </div>

  <button onclick="loadOrders()">🔄 تحديث الطلبات</button>

  <div id="orders"></div>

  <script>

    async function loadProducts() {
      const productsList = document.getElementById("productsList");
      productsList.innerHTML = "جاري تحميل المنتجات...";

      try {
        const response = await fetch(
          "http://127.0.0.1:3000/products"
        );

        const products = await response.json();
window.allProducts = products;

document.getElementById("productsCount").textContent = products.length;

        if (products.length === 0) {
          productsList.innerHTML = "لا توجد منتجات حاليًا";
          return;
        }

        productsList.innerHTML = "";

        products.forEach(product => {
          const box = document.createElement("div");
box.dataset.category = product.category || "";
          box.style.cssText =
            "border:1px solid #ddd; padding:12px; margin-bottom:10px; border-radius:8px;";

          box.innerHTML = `
            ${product.image ? `<img src="${product.image}" alt="${product.name}" style="width:120px; height:90px; object-fit:contain; border-radius:8px; display:block; margin-bottom:10px;">` : ""}
            <strong>${product.name}</strong>${!product.image ? `<br><small>📷 لا توجد صورة</small>` : ""}
            <br>
            السعر: ${product.price}
            <br>
            التصنيف: ${product.category || "غير محدد"}
            ${product.description ? `<br>الوصف: ${product.description}` : ""}
            <br><br>

            <button onclick="editProduct(${product.id})">
              ✏️ تعديل
            </button>

            <button onclick="changeProductImage(${product.id})">
              📷 تغيير الصورة
            </button>

            <button onclick="deleteProduct(${product.id})">
              🗑️ حذف
            </button>
          `;

          productsList.appendChild(box);
        });

      } catch (error) {
        console.error(error);
        productsList.innerHTML =
  "تعذر تحميل المنتجات ❌ " + error.message;;
      }
    }

    async function changeProductImage(id) {
      const product = (window.allProducts || []).find(
        p => Number(p.id) === Number(id)
      );

      if (!product) {
        alert("المنتج غير موجود");
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        try {
          const image = await uploadProductImage(file);

          const response = await fetch(
            `http://127.0.0.1:3000/products/${id}`,
            {
              method: "PUT",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                name: product.name,
                price: Number(product.price),
                category: product.category || "electronics",
                description: product.description || "",
                image: image
              })
            }
          );

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || "تعذر تحديث الصورة");
          }

          alert("تم تغيير صورة المنتج بنجاح ✅");
          loadProducts();

        } catch (error) {
          console.error(error);
          alert("تعذر تغيير الصورة ❌ " + error.message);
        }
      };

      input.click();
    }

async function editProduct(id) {
      const product = (window.allProducts || []).find(p => Number(p.id) === Number(id));

      if (!product) {
        alert("المنتج غير موجود");
        return;
      }

      const name = prompt("اسم المنتج:", product.name);
      if (name === null) return;

      const price = prompt("السعر:", product.price);
      if (price === null) return;

      const category = prompt(
        "التصنيف (electronics / watches / accessories):",
        product.category || "electronics"
      );
      if (category === null) return;

      const description = prompt(
        "وصف المنتج:",
        product.description || ""
      );
      if (description === null) return;

      let image = product.image || "";

      const imageInput = document.getElementById("editProductImageFile");
      const imageFile = imageInput.files[0];

      if (imageFile) {
        image = await uploadProductImage(imageFile);
      }

      if (!name.trim() || !price.trim()) {
        alert("يرجى إدخال الاسم والسعر");
        return;
      }

      try {
        const response = await fetch(
          `http://127.0.0.1:3000/products/${id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: name.trim(),
              price: Number(price),
              category: category.trim() || "electronics",
              description: description.trim(),
              image: image.trim()
            })
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر تعديل المنتج");
        }

        alert("تم تعديل المنتج بنجاح ✅");
        loadProducts();

      } catch (error) {
        console.error(error);
        alert("تعذر تعديل المنتج ❌");
      }
    }

    async function deleteProduct(id) {
      const confirmed = confirm(
        "هل أنت متأكد من حذف هذا المنتج؟"
      );

      if (!confirmed) return;

      try {
        const response = await fetch(
          `http://127.0.0.1:3000/products/${id}`,
          {
            method: "DELETE"
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر حذف المنتج");
        }

        alert("تم حذف المنتج بنجاح ✅");

        loadProducts();

      } catch (error) {
        console.error(error);
        alert("تعذر حذف المنتج ❌");
      }
    }
    async function loadOrders() {

      const status = document.getElementById("status");
      const ordersBox = document.getElementById("orders");

      status.textContent = "جاري تحميل الطلبات...";
      ordersBox.innerHTML = "";

      try {

        const response = await fetch(
          "http://127.0.0.1:3000/orders"
        );

        const orders = await response.json();

document.getElementById("ordersCount").textContent = orders.length;
document.getElementById("newOrdersCount").textContent = orders.filter(order => order.status === "new").length;
document.getElementById("salesTotal").textContent = orders.reduce((sum, order) => sum + Number(order.total || 0), 0).toLocaleString();
        if (orders.length === 0) {
          status.textContent = "لا توجد طلبات حاليًا";
          return;
        }

        status.textContent =
          "عدد الطلبات: " + orders.length;

        orders.reverse().forEach(order => {

          const div = document.createElement("div");

          div.className = "order";

          let itemsHTML = "";

          order.items.forEach(item => {

            itemsHTML += `
              <div>
                ${item.name}
                × ${item.quantity}
                = ${item.price * item.quantity}
              </div>
            `;

          });

          div.innerHTML = `
            <h2>📦 الطلب #${order.id}</h2>

            <div>
              <strong>👤 الاسم:</strong>
              ${order.customer.name}
            </div>

            <div>
              <strong>📱 الهاتف:</strong>
              ${order.customer.phone}
            </div>

            <div>
              <strong>📍 العنوان:</strong>
              ${order.customer.address}
            </div>

            <div class="items">
              <strong>🛒 المنتجات:</strong>
              ${itemsHTML}
            </div>

            <p><strong>📌 الحالة:</strong> ${order.status === "new" ? "🆕 جديد" : order.status}</p>
            <div class="status-buttons">
              <button onclick="updateOrderStatus(${order.id}, 'new')">🆕 جديد</button>
              <button onclick="updateOrderStatus(${order.id}, 'processing')">⚙️ قيد التجهيز</button>
              <button onclick="updateOrderStatus(${order.id}, 'shipped')">🚚 تم الشحن</button>
              <button onclick="updateOrderStatus(${order.id}, 'completed')">✅ مكتمل</button>
            </div>
            <p>
              <strong>💰 المجموع:</strong>
              ${order.total} دينار
            </p>

            <small>
              🕒 ${order.createdAt}
            </small>
          `;

          ordersBox.appendChild(div);

        });

      } catch (error) {

        status.textContent =
          "تعذر الاتصال بالسيرفر ❌";

        console.error(error);

      }

    }

    async function updateOrderStatus(orderId, newStatus) {
      try {
        const response = await fetch(`http://127.0.0.1:3000/orders/${orderId}/status`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر تحديث الحالة");
        }

        alert("تم تحديث حالة الطلب بنجاح ✅");
        loadOrders();
    loadProducts();
      } catch (error) {
        alert("تعذر تحديث حالة الطلب: " + error.message);
        console.error(error);
      }
    }
function filterProducts() {
  const searchText = document.getElementById("productSearch").value.toLowerCase().trim();
  const selectedCategory = document.getElementById("productCategory").value;

  const boxes = document.querySelectorAll("#productsList > div");

  boxes.forEach(box => {
    const productName =
      box.querySelector("strong")?.textContent.toLowerCase() || "";

    const productCategory = box.dataset.category || "";

    const matchesSearch = productName.includes(searchText);
    const matchesCategory =
      !selectedCategory || productCategory === selectedCategory;

    box.style.display =
      matchesSearch && matchesCategory ? "block" : "none";
  });
}
   
 async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(
    "http://127.0.0.1:3000/upload",
    {
      method: "POST",
      body: formData
    }
  );

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || "فشل رفع الصورة");
  }

  return data.image;
}

async function addProduct() {
      const name = document.getElementById("productName").value.trim();
      const price = Number(document.getElementById("productPrice").value);
      const description = document.getElementById("productDescription").value.trim();
      let image = document.getElementById("productImage").value.trim();
const imageFile = document.getElementById("productImageFile").files[0];
if (imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  const uploadResponse = await fetch("http://127.0.0.1:3000/upload", {
    method: "POST",
    body: formData
  });

  const uploadData = await uploadResponse.json();

  if (!uploadResponse.ok || !uploadData.success) {
    throw new Error(uploadData.message || "فشل رفع الصورة");
  }

  image = uploadData.image;
}
      const message = document.getElementById("productMessage");

      if (!name || !price) {
        message.textContent = "يرجى إدخال اسم المنتج والسعر";
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:3000/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
         body: JSON.stringify({
  name,
  price,
  category: document.getElementById("addProductCategory").value,
  description,
  image
})
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر إضافة المنتج");
        }

        message.textContent = "تمت إضافة المنتج بنجاح ✅";
        document.getElementById("productName").value = "";
        document.getElementById("productPrice").value = "";
        document.getElementById("productDescription").value = "";
        document.getElementById("productImage").value = "";
document.getElementById("productImageFile").value = "";

      } catch (error) {
        message.textContent = "تعذر إضافة المنتج: " + error.message;
        console.error(error);
      }
    }
    
async function updateDashboard() {
  try {
    const response = await fetch("http://127.0.0.1:3000/orders");
    const orders = await response.json();

    const totalOrders = orders.length;
    const newOrders = orders.filter(order => order.status === "new").length;
    const totalSales = orders.reduce((sum, order) => sum + Number(order.total || 0), 0);

    document.getElementById("dashboardStats").innerHTML = `
      <div style="display:flex; gap:10px; flex-wrap:wrap; margin:20px 0;">
        <div style="padding:15px; border:1px solid #ddd; border-radius:10px;">
          📦 الطلبات: <strong>${totalOrders}</strong>
        </div>
        <div style="padding:15px; border:1px solid #ddd; border-radius:10px;">
          🆕 الجديدة: <strong>${newOrders}</strong>
        </div>
        <div style="padding:15px; border:1px solid #ddd; border-radius:10px;">
          💰 المبيعات: <strong>${totalSales.toLocaleString()} د.ع</strong>
        </div>
      </div>
    `;
  } catch (error) {
    console.error("Dashboard error:", error);
  }
}

updateDashboard();
loadOrders();

  </script>

</body>
</html>

<script src="login.js"></script>
