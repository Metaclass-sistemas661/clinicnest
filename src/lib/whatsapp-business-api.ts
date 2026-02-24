/**
 * WhatsApp Business API — Integração Oficial Meta
 * 
 * Cliente para a API oficial do WhatsApp Business (Cloud API).
 * Mais confiável e com recursos avançados comparado a soluções não-oficiais.
 * 
 * Referência: https://developers.facebook.com/docs/whatsapp/cloud-api
 */

// ─── Configuração ─────────────────────────────────────────────────────────────

export interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken?: string;
  apiVersion?: string;
}

const API_BASE = 'https://graph.facebook.com';
const DEFAULT_VERSION = 'v18.0';

// ─── Tipos de Mensagem ────────────────────────────────────────────────────────

export type MessageType = 'text' | 'template' | 'image' | 'document' | 'audio' | 'video' | 'location' | 'contacts' | 'interactive';

export interface TextMessage {
  type: 'text';
  text: { body: string; preview_url?: boolean };
}

export interface TemplateMessage {
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components?: TemplateComponent[];
  };
}

export interface TemplateComponent {
  type: 'header' | 'body' | 'button';
  parameters?: TemplateParameter[];
  sub_type?: 'quick_reply' | 'url';
  index?: number;
}

export interface TemplateParameter {
  type: 'text' | 'currency' | 'date_time' | 'image' | 'document' | 'video';
  text?: string;
  currency?: { fallback_value: string; code: string; amount_1000: number };
  date_time?: { fallback_value: string };
  image?: { link: string };
  document?: { link: string; filename?: string };
  video?: { link: string };
}

export interface ImageMessage {
  type: 'image';
  image: { link?: string; id?: string; caption?: string };
}

export interface DocumentMessage {
  type: 'document';
  document: { link?: string; id?: string; filename?: string; caption?: string };
}

export interface LocationMessage {
  type: 'location';
  location: { latitude: number; longitude: number; name?: string; address?: string };
}

export interface InteractiveMessage {
  type: 'interactive';
  interactive: InteractiveContent;
}

export interface InteractiveContent {
  type: 'button' | 'list' | 'product' | 'product_list';
  header?: { type: 'text' | 'image' | 'video' | 'document'; text?: string; image?: { link: string }; video?: { link: string }; document?: { link: string } };
  body: { text: string };
  footer?: { text: string };
  action: InteractiveAction;
}

export interface InteractiveAction {
  buttons?: Array<{ type: 'reply'; reply: { id: string; title: string } }>;
  button?: string;
  sections?: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>;
}

export type WhatsAppMessage = TextMessage | TemplateMessage | ImageMessage | DocumentMessage | LocationMessage | InteractiveMessage;

// ─── Respostas da API ─────────────────────────────────────────────────────────

export interface SendMessageResponse {
  messaging_product: 'whatsapp';
  contacts: Array<{ input: string; wa_id: string }>;
  messages: Array<{ id: string }>;
}

export interface MessageStatus {
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
  recipient_id: string;
  errors?: Array<{ code: number; title: string; message: string; error_data?: { details: string } }>;
}

export interface WebhookPayload {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<IncomingMessage>;
        statuses?: Array<MessageStatus>;
      };
      field: 'messages';
    }>;
  }>;
}

export interface IncomingMessage {
  from: string;
  id: string;
  timestamp: string;
  type: MessageType;
  text?: { body: string };
  image?: { id: string; mime_type: string; sha256: string; caption?: string };
  document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
  audio?: { id: string; mime_type: string };
  video?: { id: string; mime_type: string };
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  button?: { text: string; payload: string };
  interactive?: { type: string; button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string; description?: string } };
  context?: { from: string; id: string };
}

// ─── Cliente WhatsApp Business API ────────────────────────────────────────────

export class WhatsAppBusinessClient {
  private config: WhatsAppConfig;
  private baseUrl: string;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl = `${API_BASE}/${config.apiVersion || DEFAULT_VERSION}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new WhatsAppAPIError(response.status, error);
    }

    return response.json();
  }

  async sendMessage(to: string, message: WhatsAppMessage): Promise<SendMessageResponse> {
    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: formatPhoneNumber(to),
      ...message,
    };

    return this.request<SendMessageResponse>(`/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async sendText(to: string, text: string, previewUrl = false): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'text',
      text: { body: text, preview_url: previewUrl },
    });
  }

  async sendTemplate(to: string, templateName: string, languageCode: string, components?: TemplateComponent[]): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
        components,
      },
    });
  }

  async sendImage(to: string, imageUrl: string, caption?: string): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'image',
      image: { link: imageUrl, caption },
    });
  }

  async sendDocument(to: string, documentUrl: string, filename: string, caption?: string): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'document',
      document: { link: documentUrl, filename, caption },
    });
  }

  async sendLocation(to: string, latitude: number, longitude: number, name?: string, address?: string): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'location',
      location: { latitude, longitude, name, address },
    });
  }

  async sendButtons(to: string, bodyText: string, buttons: Array<{ id: string; title: string }>, headerText?: string, footerText?: string): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map(b => ({
            type: 'reply' as const,
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }

  async sendList(to: string, bodyText: string, buttonText: string, sections: Array<{ title?: string; rows: Array<{ id: string; title: string; description?: string }> }>, headerText?: string, footerText?: string): Promise<SendMessageResponse> {
    return this.sendMessage(to, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: headerText ? { type: 'text', text: headerText } : undefined,
        body: { text: bodyText },
        footer: footerText ? { text: footerText } : undefined,
        action: { button: buttonText, sections },
      },
    });
  }

  async markAsRead(messageId: string): Promise<{ success: boolean }> {
    return this.request(`/${this.config.phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }

  async getMediaUrl(mediaId: string): Promise<{ url: string; mime_type: string; sha256: string; file_size: number }> {
    return this.request(`/${mediaId}`);
  }

  async downloadMedia(mediaUrl: string): Promise<ArrayBuffer> {
    const response = await fetch(mediaUrl, {
      headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
    });
    if (!response.ok) throw new Error('Failed to download media');
    return response.arrayBuffer();
  }

  async uploadMedia(file: Blob, filename: string): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('file', file, filename);
    formData.append('messaging_product', 'whatsapp');

    const response = await fetch(`${this.baseUrl}/${this.config.phoneNumberId}/media`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.config.accessToken}` },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new WhatsAppAPIError(response.status, error);
    }

    return response.json();
  }

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === this.config.webhookVerifyToken) {
      return challenge;
    }
    return null;
  }

  parseWebhook(payload: WebhookPayload): { messages: IncomingMessage[]; statuses: MessageStatus[] } {
    const messages: IncomingMessage[] = [];
    const statuses: MessageStatus[] = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        if (change.value.messages) {
          messages.push(...change.value.messages);
        }
        if (change.value.statuses) {
          statuses.push(...change.value.statuses);
        }
      }
    }

    return { messages, statuses };
  }
}

// ─── Erro da API ──────────────────────────────────────────────────────────────

export class WhatsAppAPIError extends Error {
  constructor(public statusCode: number, public response: unknown) {
    super(`WhatsApp API Error: ${statusCode}`);
    this.name = 'WhatsAppAPIError';
  }
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  return cleaned;
}

// ─── Templates Pré-definidos para Clínicas ────────────────────────────────────

export const CLINIC_TEMPLATES = {
  APPOINTMENT_CONFIRMATION: {
    name: 'appointment_confirmation',
    language: 'pt_BR',
    description: 'Confirmação de agendamento',
    variables: ['patient_name', 'date', 'time', 'doctor_name', 'clinic_name'],
  },
  APPOINTMENT_REMINDER: {
    name: 'appointment_reminder',
    language: 'pt_BR',
    description: 'Lembrete de consulta (24h antes)',
    variables: ['patient_name', 'date', 'time', 'doctor_name'],
  },
  APPOINTMENT_CANCELLED: {
    name: 'appointment_cancelled',
    language: 'pt_BR',
    description: 'Cancelamento de consulta',
    variables: ['patient_name', 'date', 'time'],
  },
  EXAM_READY: {
    name: 'exam_ready',
    language: 'pt_BR',
    description: 'Exame disponível para retirada',
    variables: ['patient_name', 'exam_name'],
  },
  PRESCRIPTION_SENT: {
    name: 'prescription_sent',
    language: 'pt_BR',
    description: 'Receita enviada',
    variables: ['patient_name', 'doctor_name'],
  },
  PAYMENT_REMINDER: {
    name: 'payment_reminder',
    language: 'pt_BR',
    description: 'Lembrete de pagamento',
    variables: ['patient_name', 'amount', 'due_date'],
  },
  BIRTHDAY_GREETING: {
    name: 'birthday_greeting',
    language: 'pt_BR',
    description: 'Felicitação de aniversário',
    variables: ['patient_name', 'clinic_name'],
  },
} as const;

export function buildTemplateComponents(templateKey: keyof typeof CLINIC_TEMPLATES, values: Record<string, string>): TemplateComponent[] {
  const template = CLINIC_TEMPLATES[templateKey];
  const parameters: TemplateParameter[] = template.variables.map(v => ({
    type: 'text' as const,
    text: values[v] || '',
  }));

  return [{ type: 'body', parameters }];
}
