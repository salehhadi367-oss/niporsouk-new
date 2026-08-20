async function backendLogin() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value;
  const loginMessage = document.getElementById("loginMessage");

  if (!username || !password) {
    loginMessage.textContent = "❌ أدخل اسم المستخدم وكلمة المرور";
    return;
  }

  loginMessage.textContent = "جاري تسجيل الدخول...";

  try {
    const response = await fetch("http://127.0.0.1:3000/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username: username,
        password: password
      })
    });

    const data = await response.json();

    if (data.success) {
      localStorage.setItem("adminLoggedIn", "true");
      document.getElementById("loginScreen").style.display = "none";
      loginMessage.textContent = "";
    } else {
      loginMessage.textContent = "❌ " + (data.message || "بيانات الدخول غير صحيحة");
    }

  } catch (error) {
    console.error(error);
    loginMessage.textContent = "❌ تعذر الاتصال بالسيرفر";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const loggedIn = localStorage.getItem("adminLoggedIn");

  if (loggedIn === "true") {
    const screen = document.getElementById("loginScreen");

    if (screen) {
      screen.style.display = "none";
    }
  }
});

function logoutAdmin() {
  localStorage.removeItem("adminLoggedIn");
  location.reload();
}
