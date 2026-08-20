
    async function loadProducts() {
      const productsList = document.getElementById("productsList");

      productsList.innerHTML = "جاري تحميل المنتجات...";

      try {
        const response = await fetch(
          "http://127.0.0.1:3000/products"
        );

        const products = await response.json();

        if (products.length === 0) {
          productsList.innerHTML = "لا توجد منتجات حاليًا";
          return;
        }

        productsList.innerHTML = "";

        products.forEach(product => {
          const box = document.createElement("div");

          box.style.cssText =
            "border:1px solid #ddd; padding:12px; margin-bottom:10px; border-radius:8px;";

          box.innerHTML = `
            <strong>${product.name}</strong>
            <br>
            السعر: ${product.price}
            <br><br>

            <button onclick="editProduct(${product.id}, '${product.name.replace(/'/g, "\\'")}', ${product.price})">
              ✏️ تعديل
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
          "تعذر تحميل المنتجات ❌";
      }
    }

    async function editProduct(id, oldName, oldPrice) {
      const name = prompt("اسم المنتج:", oldName);

      if (name === null) return;

      const price = prompt("السعر:", oldPrice);

      if (price === null) return;

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
              price: Number(price)
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
    async function addProduct() {
      const name = document.getElementById("productName").value.trim();
      const price = Number(document.getElementById("productPrice").value);
      const message = document.getElementById("productMessage");

      if (!name || !price) {
        message.textContent = "يرجى إدخال اسم المنتج والسعر";
        return;
      }

      try {
        const response = await fetch("http://127.0.0.1:3000/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, price })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "تعذر إضافة المنتج");
        }

        message.textContent = "تمت إضافة المنتج بنجاح ✅";
        document.getElementById("productName").value = "";
        document.getElementById("productPrice").value = "";

      } catch (error) {
        message.textContent = "تعذر إضافة المنتج: " + error.message;
        console.error(error);
      }
    }
    loadOrders();

