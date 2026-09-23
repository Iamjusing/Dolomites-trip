/* 柏林馬拉松與多洛米蒂之旅 — 離線快取 Service Worker
   改版時把 CACHE 的版本號 +1，使用者下次連網開啟就會自動更新。 */
const CACHE = 'dolomites-trip-v23';

const ASSETS = [
  './',
  'index.html',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'icon-512-maskable.png',
  '三尖峰.png',
  '魔多之塔.png',
  '布萊埃斯湖.png',
  '斯佩奇山.jpg',
  'Lago di Misurina 米蘇里納湖.jpg',
  '五塔山.png',
  '索拉皮斯湖.png',
  'Seceda 刀鋒稜線.png',
  '休斯高原.png',
  '富內斯孤獨教堂.png'
];

// 安裝：把所有資源抓下來存起來（單檔失敗不影響其他檔）
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(
        ASSETS.map(url => cache.add(url).catch(err => console.warn('[SW] skip', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

// 啟用：清掉舊版本快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== CACHE + '-img').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 取用：快取優先（開得快、離線也能開），背景再默默更新
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // 外站圖片（Wikimedia 景點照）：快取優先，第一次連網看過之後離線也看得到
  if (url.origin !== self.location.origin) {
    if (req.destination === 'image') {
      event.respondWith(
        caches.match(req).then(cached => cached || fetch(req).then(res => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE + '-img').then(c => c.put(req, copy));
          }
          return res;
        }).catch(() => cached || new Response('', { status: 504 })))
      );
    }
    return; // 其他外部連結（Google Maps 等）不攔
  }

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => null);

      if (cached) { network; return cached; }

      return network.then(res => {
        if (res) return res;
        // 離線且沒快取到：導覽請求一律回主頁
        if (req.mode === 'navigate') return caches.match('index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
