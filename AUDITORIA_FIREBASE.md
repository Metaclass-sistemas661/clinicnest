# AUDITORIA FIREBASE — ClinicNest/ClinicaFlow

**Data**: 16 de março de 2026  
**Modo**: Somente Leitura (nenhum arquivo alterado)  
**Escopo**: Varredura exaustiva de todo o workspace

---

## 1. Mapeamento de Arquivos

### Arquivos com código Firebase ATIVO (8 + 4 edge functions + 1 migration)

| # | Arquivo | Papel |
|---|---------|-------|
| 1 | `src/lib/firebase.ts` | **Módulo central** — inicialização `initializeApp`, `getMessaging`, `getToken`, `onMessage`, `isSupported` |
| 2 | `public/firebase-messaging-sw.js` | **Service Worker** — recebe push em background, exibe notificação nativa, trata cliques |
| 3 | `src/hooks/usePushNotifications.ts` | **Hook staff** — solicita permissão, salva `fcm_token` em `push_subscriptions`, escuta foreground |
| 4 | `src/hooks/usePatientPushNotifications.ts` | **Hook paciente** — mesma lógica, para portal do paciente |
| 5 | `src/components/settings/NotificationSettings.tsx` | **UI staff** — toggle ativar/desativar push, botão testar |
| 6 | `src/pages/paciente/PatientSettings.tsx` | **UI paciente** — preferências push granulares (certificados, receitas, exames, consultas) |
| 7 | `supabase/functions/notify-patient-events/index.ts` | **Backend** — envia push via FCM Legacy HTTP API |
| 8 | `supabase/functions/notify-patient-appointment/index.ts` | **Backend** — lembrete de consulta via FCM |
| 9 | `supabase/functions/notify-patient-message/index.ts` | **Backend** — notifica nova mensagem via FCM |
| 10 | `supabase/functions/notify-patient-invoice-due/index.ts` | **Backend** — notifica fatura vencendo via FCM |
| 11 | `supabase/migrations/20260324300000_push_notifications_v1.sql` | **SQL** — tabelas `push_subscriptions` (`fcm_token`), `push_notifications_log`, RPCs `get_user_fcm_tokens()`, `get_tenant_fcm_tokens()` |

### Referências indiretas (config/docs)

| Arquivo | Linha | Contexto |
|---------|-------|----------|
| `vite.config.ts` | L53 | Chunk splitting: `"vendor-firebase": ["firebase/app", "firebase/messaging"]` |
| `.env.example` | L27-32 | Template das variáveis Firebase |
| `roadmap.md` | L788, L2042, L3099 | Documentação do uso FCM |

---

## 2. Funcionalidades Ativas

O Firebase é usado **EXCLUSIVAMENTE para Push Notifications (FCM)**. O fluxo completo:

### Fluxo Cliente → Token

1. Usuário abre `NotificationSettings.tsx` (staff) ou `PatientSettings.tsx` (paciente)
2. Clica "Ativar Notificações"
3. Hook (`usePushNotifications` / `usePatientPushNotifications`) invoca `requestNotificationPermission()` de `firebase.ts`
4. Registra o `firebase-messaging-sw.js` como Service Worker
5. `getToken()` obtém FCM token usando a `VAPID_KEY`
6. Token é salvo na tabela `push_subscriptions` no Supabase

### Fluxo Backend → Push

1. Evento ocorre (consulta agendada, mensagem, fatura, etc.)
2. Edge function busca tokens FCM do usuário na tabela `push_subscriptions`
3. Envia push via `POST https://fcm.googleapis.com/fcm/send` com `FCM_SERVER_KEY`
4. Service Worker recebe em background → exibe notificação nativa do OS

### Fluxo Foreground

1. App aberto → `onForegroundMessage()` escuta mensagens
2. Exibe toast ou notificação local dentro do app

### O que NÃO é usado do Firebase

| Serviço Firebase | Status |
|-----------------|--------|
| Authentication | **NÃO** — 100% Supabase Auth |
| Firestore | **NÃO** — 100% PostgreSQL via Supabase |
| Realtime Database | **NÃO** — Supabase Realtime |
| Storage | **NÃO** — Supabase Storage |
| Analytics | **NÃO** — Google Analytics (gtag) separado |
| Functions | **NÃO** — Supabase Edge Functions (Deno) |
| Hosting | **NÃO** — Vercel |
| Performance Monitoring | **NÃO** |
| Remote Config | **NÃO** |
| Crashlytics | **NÃO** |

---

## 3. Dependências (package.json)

| Pacote | Versão | Tipo |
|--------|--------|------|
| `firebase` | `^12.9.0` | `dependencies` |

Nenhum `firebase-admin`, `@firebase/*` direto, ou `firebase-tools` no `package.json`. Os sub-pacotes vêm como dependências transitivas.

---

## 4. Variáveis de Ambiente

### Frontend (Vercel)

| Variável | Onde é lida | Propósito |
|----------|------------|-----------|
| `VITE_FIREBASE_API_KEY` | `src/lib/firebase.ts` L8 | API Key do projeto Firebase |
| `VITE_FIREBASE_PROJECT_ID` | `src/lib/firebase.ts` L9-11 | Project ID (usado tb para `authDomain` e `storageBucket`) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | `src/lib/firebase.ts` L12 | Sender ID para Cloud Messaging |
| `VITE_FIREBASE_APP_ID` | `src/lib/firebase.ts` L13 | App ID da web app Firebase |
| `VITE_FIREBASE_VAPID_KEY` | `src/lib/firebase.ts` L16 | Chave VAPID para Web Push |

### Backend (Supabase Edge Functions Secrets)

| Variável | Onde é lida | Propósito |
|----------|------------|-----------|
| `FCM_SERVER_KEY` | 4 edge functions (`notify-patient-*`) | Server Key da Legacy HTTP API para enviar push |

**Total: 6 variáveis** (5 frontend + 1 backend)

---

## 5. Project ID do Firebase

**Não é possível identificar o Project ID diretamente pelo código.** A configuração lê tudo de variáveis de ambiente em runtime:

```ts
projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
```

Nenhum valor hardcoded. Para descobrir o Project ID atual, consulte:

1. **Vercel** → Settings → Environment Variables → `VITE_FIREBASE_PROJECT_ID`
2. **Supabase** → Edge Function Secrets → `FCM_SERVER_KEY` (identifica indiretamente)
3. **Firebase Console** → console.firebase.google.com → seus projetos

O Service Worker (`firebase-messaging-sw.js` L9-14) também não tem valores hardcoded — usa fallbacks vazios (`''`) e tenta ler do IndexedDB (`clinicnest-config`).

---

## 6. Detalhamento Técnico por Arquivo

### `src/lib/firebase.ts` (Módulo Central)

| Linha | Função/Export | Descrição |
|-------|---------------|-----------|
| L7-14 | `firebaseConfig` | Objeto de configuração lendo 4 env vars |
| L16 | `VAPID_KEY` | Chave VAPID para Web Push |
| L22-30 | `getFirebaseApp()` | Singleton `initializeApp(firebaseConfig)` |
| L32-47 | `getFirebaseMessaging()` | Verifica `isSupported()`, retorna `getMessaging()` |
| L50-84 | `requestNotificationPermission()` | Registra SW, obtém token FCM via `getToken()` |
| L87-95 | `onForegroundMessage()` | Wrapper para `onMessage()` |
| L97-122 | Helpers | `isNotificationEnabled()`, `canRequestNotification()`, `showLocalNotification()` |
| L130+ | Tipos | `NotificationType`, `PushNotificationPayload`, `createNotificationPayload()` |

### `public/firebase-messaging-sw.js` (Service Worker)

| Linha | Funcionalidade |
|-------|----------------|
| L4-5 | `importScripts` do Firebase compat SDK v10.7.0 |
| L8-15 | `firebaseConfig` fallback com variáveis `self.FIREBASE_*` |
| L18-36 | `getFirebaseConfig()` — tenta ler config do IndexedDB (`clinicnest-config`) |
| L42-44 | `firebase.initializeApp(config)` + `firebase.messaging()` |
| L47-62 | `messaging.onBackgroundMessage()` — exibe notificação nativa |
| L66-86 | `getNotificationActions()` — ações por tipo de notificação |
| L89-120 | `notificationclick` handler — navegação por tipo/ação |
| L122+ | `notificationclose` handler + cache PWA offline |

### `src/hooks/usePushNotifications.ts` (Hook Staff)

| Linha | Funcionalidade |
|-------|----------------|
| L5-12 | Importa de `@/lib/firebase` |
| L26 | `usePushNotifications()` — hook principal |
| L32 | Estado `fcmToken` |
| L80-95 | Salva token na tabela `push_subscriptions` via Supabase |
| L119-126 | Desativa token atualizando `is_active = false` |

### `src/hooks/usePatientPushNotifications.ts` (Hook Paciente)

| Linha | Funcionalidade |
|-------|----------------|
| L7-13 | Importa de `@/lib/firebase` |
| L17 | `usePatientPushNotifications()` — hook portal paciente |
| L70-86 | Salva token em `push_subscriptions` com `tenant_id: null` |
| L108-117 | Desativa token |

### Edge Functions Backend (FCM Legacy API)

Todas usam o mesmo padrão:

```ts
const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
await fetch("https://fcm.googleapis.com/fcm/send", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `key=${fcmServerKey}`,
  },
  body: JSON.stringify({ to: token, notification: {...}, data: {...} }),
});
```

| Edge Function | Eventos que dispara push |
|---------------|--------------------------|
| `notify-patient-events` | Chegada de paciente, novo agendamento, cancelamento, waitlist |
| `notify-patient-appointment` | Lembretes de consulta (24h, 2h antes) |
| `notify-patient-message` | Nova mensagem de chat |
| `notify-patient-invoice-due` | Fatura vencendo/vencida |

### Migration SQL (`20260324300000_push_notifications_v1.sql`)

| Objeto | Tipo | Descrição |
|--------|------|-----------|
| `push_subscriptions` | Tabela | `user_id`, `tenant_id`, `fcm_token`, `platform`, `device_name`, `is_active` |
| `push_notifications_log` | Tabela | Log de notificações enviadas |
| `get_user_fcm_tokens()` | RPC | Retorna tokens FCM ativos de um usuário |
| `get_tenant_fcm_tokens()` | RPC | Retorna tokens FCM de todo o tenant |
| Constraint | UNIQUE | `(user_id, fcm_token)` |
| RLS | Policy | Usuário gerencia apenas suas subscriptions |

---

## 7. Verificações Negativas (NÃO encontrado)

| Item | Status |
|------|--------|
| Firebase Auth (`firebase/auth`, `getAuth`) | **Não usado** |
| Firebase Firestore (`firebase/firestore`) | **Não usado** |
| Firebase Storage (`firebase/storage`) | **Não usado** |
| Firebase Analytics (`firebase/analytics`, `getAnalytics`) | **Não usado** |
| Firebase Database (`firebase/database`) | **Não usado** |
| Firebase Functions (`firebase/functions`) | **Não usado** |
| Firebase Performance (`firebase/performance`) | **Não usado** |
| Firebase Remote Config | **Não usado** |
| `firebase-admin` | **Não instalado** |
| `firebase-tools` no package.json | **Não presente** (só global) |
| Firebase script tags em `index.html` | **Nenhum** |
| `gcm_sender_id` em `manifest.json` | **Não presente** |
| Firebase refs em `vercel.json` | **Nenhum** |
| Arquivo `.env` ou `.env.local` no workspace | **Não existe** (apenas `.env.example`) |

---

## 8. Alertas Técnicos

| Alerta | Severidade | Detalhe |
|--------|-----------|---------|
| **FCM Legacy API depreciada** | **ALTA** | As 4 edge functions usam `https://fcm.googleapis.com/fcm/send` com Server Key. O Google depreciou essa API — a migração para FCM v1 (HTTP v1 API com OAuth2) é necessária. |
| **SDK version mismatch** | MÉDIA | App usa SDK `^12.9.0`, Service Worker usa compat `10.7.0` — funciona mas são versões diferentes. |
| **manifest.json sem gcm_sender_id** | BAIXA | Não tem `gcm_sender_id` no manifest — funciona porque o SW registra diretamente, mas é uma boa prática incluir. |

---

## 9. Resumo Executivo

**Firebase = somente FCM Push Notifications.**

| Dimensão | Valor |
|----------|-------|
| Serviços Firebase usados | 1 (Cloud Messaging) |
| Arquivos com código Firebase | 11 (6 frontend + 4 backend + 1 SQL) |
| Refs em config/docs | 3 (vite.config.ts, .env.example, roadmap.md) |
| Pacotes npm | 1 (`firebase ^12.9.0`) |
| Variáveis de ambiente | 6 (5 `VITE_FIREBASE_*` + 1 `FCM_SERVER_KEY`) |
| Project ID | Não hardcoded — consultar Vercel env vars |
| API usada no backend | FCM Legacy HTTP (⚠️ depreciada) |
