async function backendLogin() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const loginMessage = document.getElementById("loginMessage");

  try {
    const response = await fetch("https://9f4bb1a3-7eb2-4d9e-8ff5-1501ef6b780e-00-huzse5o9n4p7.sisko.replit.dev/login", {
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
