async function backendLogin() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const loginMessage = document.getElementById("loginMessage");

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
      document.getElementById("loginScreen").style.display = "none";
    } else {
      loginMessage.textContent = "❌ " + data.message;
    }
  } catch (error) {
    loginMessage.textContent = "❌ تعذر الاتصال بالسيرفر";
  }
}
