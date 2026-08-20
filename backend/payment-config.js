const fs = require('fs');

const config = {
  clientId: '',
  clientSecret: '',
  merchantId: '',
  redirectUrl: ''
};

try {
  const lines = fs.readFileSync('.env', 'utf8').split(/\r?\n/);

  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    const value = rest.join('=').trim();

    if (key === 'ZAINCASH_CLIENT_ID') config.clientId = value;
    if (key === 'ZAINCASH_CLIENT_SECRET') config.clientSecret = value;
    if (key === 'ZAINCASH_MERCHANT_ID') config.merchantId = value;
    if (key === 'ZAINCASH_REDIRECT_URL') config.redirectUrl = value;
  }
} catch (error) {
  console.error('تعذر قراءة ملف إعدادات الدفع');
}

module.exports = config;
