// Firebase Messaging Service Worker
// Este arquivo deve ficar na raiz do public/

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuração hardcoded (Service Worker não tem acesso a import.meta.env)
const firebaseConfig = {
  apiKey: 'AIzaSyDJTFvPVfdqn2Rn8EJ5Z4iZdpB68S2w284',
  authDomain: 'sistema-de-gestao-16e15.firebaseapp.com',
  projectId: 'sistema-de-gestao-16e15',
  storageBucket: 'sistema-de-gestao-16e15.firebasestorage.app',
  messagingSenderId: '294286835536',
  appId: '1:294286835536:web:43d8d44cae7b8330f8b655',
};

// Tentar ler config do IndexedDB (salvo pelo app)
async function getFirebaseConfig() {
  return new Promise((resolve) => {
    const request = indexedDB.open('clinicnest-config', 1);
    request.onsuccess = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('firebase')) {
        resolve(firebaseConfig);
        return;
      }
      const tx = db.transaction('firebase', 'readonly');
      const store = tx.objectStore('firebase');
      const getRequest = store.get('config');
      getRequest.onsuccess = () => {
        resolve(getRequest.result || firebaseConfig);
      };
      getRequest.onerror = () => resolve(firebaseConfig);
    };
    request.onerror = () => resolve(firebaseConfig);
  });
}

// Inicializar Firebase
let messaging = null;

getFirebaseConfig().then((config) => {
  if (config.apiKey) {
    firebase.initializeApp(config);
    messaging = firebase.messaging();

    // Handler para mensagens em background
    messaging.onBackgroundMessage((payload) => {

      const notificationTitle = payload.notification?.title || payload.data?.title || 'ClinicNest';
      const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || '',
        icon: payload.notification?.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        tag: payload.data?.type || 'default',
        data: payload.data,
        actions: getNotificationActions(payload.data?.type),
        vibrate: [200, 100, 200],
        requireInteraction: payload.data?.type === 'paciente_chegou',
      };

      return self.registration.showNotification(notificationTitle, notificationOptions);
    });
  }
});

// Ações baseadas no tipo de notificação
function getNotificationActions(type) {
  const actions = {
    novo_agendamento: [
      { action: 'view', title: 'Ver Agenda' },
      { action: 'dismiss', title: 'Dispensar' },
    ],
    paciente_chegou: [
      { action: 'triagem', title: 'Iniciar Triagem' },
      { action: 'view', title: 'Ver Detalhes' },
    ],
    nova_mensagem: [
      { action: 'reply', title: 'Responder' },
      { action: 'view', title: 'Ver Chat' },
    ],
    default: [
      { action: 'view', title: 'Abrir' },
    ],
  };
  return actions[type] || actions.default;
}

// Handler para clique na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/';

  // Determinar URL baseado no tipo ou ação
  if (event.action === 'triagem') {
    url = '/triagem';
  } else if (event.action === 'reply' || event.action === 'view') {
    url = data.clickAction || '/';
  } else if (data.clickAction) {
    url = data.clickAction;
  }

  // Abrir ou focar na janela
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Tentar focar em janela existente
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Abrir nova janela
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handler para fechar notificação
self.addEventListener('notificationclose', () => {
  // tracking de notificações fechadas pode ser adicionado aqui
});

// Cache para modo offline (PWA)
// Incrementar esta versão a cada deploy para forçar atualização
const CACHE_VERSION = '2.0.0';
const CACHE_NAME = `clinicnest-v${CACHE_VERSION}`;
const OFFLINE_URLS = [
  '/offline.html',
];

// Instalar service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
  self.skipWaiting();
});

// Ativar service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Interceptar requests (estratégia network-first)
self.addEventListener('fetch', (event) => {
  // Ignorar requests não-GET e de outras origens
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Ignorar requests de API (sempre buscar da rede)
  if (event.request.url.includes('/api/')) {
    return;
  }

  // Navegação (HTML) → sempre rede, nunca cachear index.html
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('/offline.html').then((r) => r || new Response('Offline', { status: 503 }));
      })
    );
    return;
  }

  // Assets estáticos (JS/CSS/imagens) → network-first com cache fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

console.log('[SW] ClinicNest Firebase Messaging Service Worker carregado');
