// Firebase Configuration e Push Notifications
import { initializeApp, getApps } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { logger } from '@/lib/logger';

// Configuração via variáveis de ambiente
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Inicializar Firebase (singleton)
let app: ReturnType<typeof initializeApp> | null = null;
let messaging: ReturnType<typeof getMessaging> | null = null;

export function getFirebaseApp() {
  if (!app && getApps().length === 0) {
    if (!firebaseConfig.apiKey) {
      logger.warn('Firebase: Credenciais não configuradas');
      return null;
    }
    app = initializeApp(firebaseConfig);
  }
  return app || getApps()[0];
}

export async function getFirebaseMessaging() {
  if (messaging) return messaging;
  
  const supported = await isSupported();
  if (!supported) {
    logger.warn('Firebase Messaging não suportado neste navegador');
    return null;
  }

  const firebaseApp = getFirebaseApp();
  if (!firebaseApp) return null;

  messaging = getMessaging(firebaseApp);
  return messaging;
}

// Solicitar permissão e obter token FCM
export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Verificar se navegador suporta
    if (!('Notification' in window)) {
      logger.warn('Este navegador não suporta notificações');
      return null;
    }

    // Solicitar permissão
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      logger.info('Permissão de notificação negada');
      return null;
    }

    // Obter messaging
    const fcmMessaging = await getFirebaseMessaging();
    if (!fcmMessaging) return null;

    // Registrar service worker
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    
    // Obter token FCM
    const token = await getToken(fcmMessaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    logger.info('FCM Token obtido:', token.substring(0, 20) + '...');
    return token;

  } catch (error) {
    logger.error('Erro ao obter token FCM:', error);
    return null;
  }
}

// Listener para mensagens em foreground
export function onForegroundMessage(callback: (payload: any) => void) {
  getFirebaseMessaging().then(fcmMessaging => {
    if (!fcmMessaging) return;
    
    onMessage(fcmMessaging, (payload) => {
      logger.info('Mensagem recebida em foreground:', payload);
      callback(payload);
    });
  });
}

// Verificar se notificações estão habilitadas
export function isNotificationEnabled(): boolean {
  return 'Notification' in window && Notification.permission === 'granted';
}

// Verificar se pode solicitar permissão
export function canRequestNotification(): boolean {
  return 'Notification' in window && Notification.permission === 'default';
}

// Mostrar notificação local (quando app está em foreground)
export function showLocalNotification(title: string, options?: NotificationOptions) {
  if (!isNotificationEnabled()) return;
  
  const notification = new Notification(title, {
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    ...options,
  });

  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

// Tipos de notificação do sistema
export type NotificationType = 
  | 'novo_agendamento'
  | 'agendamento_confirmado'
  | 'agendamento_cancelado'
  | 'paciente_chegou'
  | 'triagem_concluida'
  | 'nova_mensagem'
  | 'lembrete_consulta';

export interface PushNotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  icon?: string;
  clickAction?: string;
}

// Criar payload de notificação
export function createNotificationPayload(
  type: NotificationType,
  data: Record<string, any>
): PushNotificationPayload {
  const payloads: Record<NotificationType, () => PushNotificationPayload> = {
    novo_agendamento: () => ({
      type: 'novo_agendamento',
      title: 'Novo Agendamento',
      body: `${data.paciente} agendou para ${data.data} às ${data.hora}`,
      data: { appointmentId: data.id },
      clickAction: '/agenda',
    }),
    agendamento_confirmado: () => ({
      type: 'agendamento_confirmado',
      title: 'Agendamento Confirmado',
      body: `${data.paciente} confirmou presença para ${data.data}`,
      data: { appointmentId: data.id },
      clickAction: '/agenda',
    }),
    agendamento_cancelado: () => ({
      type: 'agendamento_cancelado',
      title: 'Agendamento Cancelado',
      body: `${data.paciente} cancelou o agendamento de ${data.data}`,
      data: { appointmentId: data.id },
      clickAction: '/agenda',
    }),
    paciente_chegou: () => ({
      type: 'paciente_chegou',
      title: 'Paciente Chegou',
      body: `${data.paciente} fez check-in e está aguardando`,
      data: { appointmentId: data.id },
      clickAction: '/triagem',
    }),
    triagem_concluida: () => ({
      type: 'triagem_concluida',
      title: 'Triagem Concluída',
      body: `${data.paciente} está pronto para atendimento`,
      data: { appointmentId: data.id },
      clickAction: '/agenda',
    }),
    nova_mensagem: () => ({
      type: 'nova_mensagem',
      title: 'Nova Mensagem',
      body: `${data.remetente}: ${data.preview}`,
      data: { chatId: data.chatId },
      clickAction: '/chat',
    }),
    lembrete_consulta: () => ({
      type: 'lembrete_consulta',
      title: 'Lembrete de Consulta',
      body: `Você tem consulta em ${data.minutos} minutos com ${data.paciente}`,
      data: { appointmentId: data.id },
      clickAction: '/agenda',
    }),
  };

  return payloads[type]();
}
