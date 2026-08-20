    document.getElementById("status").textContent = "بدأ JavaScript ✅";


    let products = [];

    let cart = [];

    async function loadProducts() {

      try {

        const response = await fetch("http://192.168.1.101:3000/products");

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        products = await response.json();

        const container = document.getElementById("products");

        container.innerHTML = "";

        products.forEach(product => {

          const card = document.createElement("div");

          card.className = "product";

          card.innerHTML = `
            <h3>${product.name}</h3>
            <div class="price">السعر: ${product.price}</div>
            <button onclick="addToCart('${product.id}')">
              🛒 إضافة إلى السلة
            </button>
          `;

          container.appendChild(card);

        });

        document.getElementById("status").textContent =
          "المنتجات المتاحة";

      } catch (error) {

        document.getElementById("status").textContent =
          "تعذر تحميل المنتجات: " + error.message;

        console.error(error);

      }

    }


    function addToCart(productId) {

      const product = products.find(p => String(p.id) === String(productId));

      if (!product) return;

      cart.push(product);

      document.getElementById("cartCount").textContent = cart.length;

      updateCart();

      alert("تمت إضافة المنتج إلى السلة 🛒");
    }

    function updateCart() {

      const cartItems = document.getElementById("cartItems");
      const cartTotal = document.getElementById("cartTotal");

      if (cart.length === 0) {
        cartItems.innerHTML = "السلة فارغة";
        cartTotal.textContent = "المجموع: 0";
        return;
      }

      cartItems.innerHTML = "";

      let total = 0;

      const grouped = {};

      cart.forEach(product => {
        if (!grouped[product.id]) {
          grouped[product.id] = { product: product, quantity: 0 };
        }
        grouped[product.id].quantity++;
      });

      Object.values(grouped).forEach(itemData => {

        const product = itemData.product;
        const quantity = itemData.quantity;
        const price = Number(product.price) || 0;
        const subtotal = price * quantity;

        total += subtotal;

        const item = document.createElement("div");

        item.innerHTML = `
          <div style="padding:10px 0; border-bottom:1px solid #ddd;">
            <strong>${product.name}</strong><br>
            السعر: ${price} × الكمية: ${quantity} = ${subtotal}<br>
            <button onclick="decreaseQuantity('${product.id}')">➖</button>
            <span style="margin:0 10px;">${quantity}</span>
            <button onclick="increaseQuantity('${product.id}')">➕</button>
            <button onclick="removeFromCart('${product.id}')" style="margin-right:10px;">🗑️ حذف</button>

          </div>
        `;

        cartItems.appendChild(item);

      });

      cartTotal.textContent = "المجموع: " + total;
      }

    function increaseQuantity(productId) {
      cart.push(products.find(p => String(p.id) === String(productId)));
      document.getElementById("cartCount").textContent = cart.length;
      updateCart();
    }

    function decreaseQuantity(productId) {
      const index = cart.findIndex(p => String(p.id) === String(productId));
      if (index !== -1) {
        cart.splice(index, 1);
      }
      document.getElementById("cartCount").textContent = cart.length;
        updateCart();

      }

    function removeFromCart(productId) {
      cart = cart.filter(p => String(p.id) !== String(productId));
      document.getElementById("cartCount").textContent = cart.length;
      updateCart();
    }


    async function submitOrder() {
      const name = document.getElementById("customerName").value.trim();
      const phone = document.getElementById("customerPhone").value.trim();
      const address = document.getElementById("customerAddress").value.trim();

      if (cart.length === 0) {
        alert("السلة فارغة 🛒");
        return;
      }

      if (!name || !phone || !address) {
        alert("يرجى ملء جميع بيانات الطلب");
        return;
      }

      const grouped = {};

      cart.forEach(product => {
        if (!grouped[product.id]) {
          grouped[product.id] = {
            id: product.id,
            name: product.name,
            price: Number(product.price) || 0,
            quantity: 0
          };
        }
        grouped[product.id].quantity++;
      });

      const items = Object.values(grouped);

      let total = 0;
      items.forEach(item => {
        total += item.price * item.quantity;
      });

      try {
        const response = await fetch("http://192.168.1.101:3000/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: name,
            phone: phone,
            address: address,
            items: items,
            total: total
          })
        });

        const data = await response.json();

        if (!data.success) {
          throw new Error(data.message || "تعذر إنشاء الطلب");
        }

        alert("تم إنشاء الطلب بنجاح ✅\nرقم الطلب: #" + data.order.id);

        cart = [];
        document.getElementById("cartCount").textContent = "0";
        updateCart();

        document.getElementById("customerName").value = "";
        document.getElementById("customerPhone").value = "";
        document.getElementById("customerAddress").value = "";

      } catch (error) {
        alert("تعذر إرسال الطلب: " + error.message);
        console.error(error);
      }
    }

    loadProducts();

