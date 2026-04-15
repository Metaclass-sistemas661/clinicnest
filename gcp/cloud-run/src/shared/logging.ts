/**
 * Logging — Structured JSON logger for Cloud Logging + PII masking
 * 
 * Outputs JSON when in production (Cloud Logging auto-parses severity fields).
 * Outputs readable format in development.
 */

const SENSITIVE = process.env.LOG_SENSITIVE === 'true';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

function maskValue(value: string): string {
  // CPF: show last 4
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value) || /^\d{11}$/.test(value)) {
    return `***${value.slice(-4)}`;
  }
  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return '***@***.***';
  // UUID-like tokens
  if (/^[a-f0-9-]{36}$/i.test(value)) return '***token***';
  return value;
}

function maskObject(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (SENSITIVE) return obj;

  const masked: any = Array.isArray(obj) ? [] : {};
  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();
    if (lk.includes('password') || lk.includes('secret') || lk.includes('token') || lk.includes('key')) {
      masked[key] = '***';
    } else if (typeof value === 'string') {
      masked[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskObject(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// Correlation ID (set per-request via middleware)
let _correlationId: string | undefined;

export function setCorrelationId(id: string) {
  _correlationId = id;
}

export function getCorrelationId(): string | undefined {
  return _correlationId;
}

type Severity = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

function emit(severity: Severity, prefix: string, message: string, data?: Record<string, unknown>) {
  const safeData = data ? maskObject(data) : undefined;

  if (IS_PRODUCTION) {
    // Structured JSON for Cloud Logging
    const entry: Record<string, any> = {
      severity,
      message: `[${prefix}] ${message}`,
      component: prefix,
      ...(safeData ? { data: safeData } : {}),
      ...(_correlationId ? { 'logging.googleapis.com/trace': _correlationId } : {}),
      timestamp: new Date().toISOString(),
    };
    console.log(JSON.stringify(entry));
  } else {
    const timestamp = new Date().toISOString();
    const corrId = _correlationId ? ` [${_correlationId.slice(0, 8)}]` : '';
    console.log(`[${timestamp}] [${severity}] [${prefix}]${corrId} ${message}`, safeData ? JSON.stringify(safeData) : '');
  }
}

export function createLogger(prefix: string) {
  const fn = (message: string, data?: Record<string, unknown>) => emit('INFO', prefix, message, data);
  fn.debug = (message: string, data?: Record<string, unknown>) => emit('DEBUG', prefix, message, data);
  fn.info = (message: string, data?: Record<string, unknown>) => emit('INFO', prefix, message, data);
  fn.warn = (message: string, data?: Record<string, unknown>) => emit('WARNING', prefix, message, data);
  fn.error = (message: string, data?: Record<string, unknown>) => emit('ERROR', prefix, message, data);
  fn.critical = (message: string, data?: Record<string, unknown>) => emit('CRITICAL', prefix, message, data);
  return fn;
}

// Default log function (backward compat — calls info)
export function log(prefix: string) {
  return (message: string, data?: Record<string, unknown>) => emit('INFO', prefix, message, data);
}
