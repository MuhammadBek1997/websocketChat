const Pusher = require('pusher');

const appId = process.env.PUSHER_APP_ID;
const key = process.env.PUSHER_KEY;
const secret = process.env.PUSHER_SECRET;
const cluster = process.env.PUSHER_CLUSTER;

let pusher;

if (!appId || !key || !secret || !cluster) {
  // Pusher to'liq sozlanmagan bo'lsa - dummy client
  console.warn('Pusher konfiguratsiyasi to‘liq emas. trigger() no-op rejimida ishlaydi.');
  pusher = {
    trigger: async () => {
      // Hech narsa qilmaydi, lekin promise qaytaradi
      return Promise.resolve();
    }
  };
} else {
  pusher = new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true
  });
}

module.exports = pusher;
