/**
 * Utilitário de criptografia AES-256-GCM usando Web Crypto API.
 * Usado para criptografar credenciais sensíveis (SNGPC, integrações)
 * antes de armazená-las no banco de dados.
 *
 * A chave de criptografia é derivada de VITE_ENCRYPTION_KEY via PBKDF2.
 * Se a env var não estiver definida, usa o tenant_id como seed (fallback).
 */

import { logger } from "@/lib/logger";

const ALGORITHM = "AES-GCM";
const IV_LENGTH = 12; // 96 bits para AES-GCM
const SALT = new TextEncoder().encode("clinicnest-sngpc-v1");

/**
 * Deriva uma chave AES-256 a partir de uma senha usando PBKDF2.
 */
async function deriveKey(password: string): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SALT, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function getEncryptionSeed(tenantId?: string): string {
  return import.meta.env.VITE_ENCRYPTION_KEY || tenantId || "clinicnest-default";
}

/**
 * Criptografa um texto plano usando AES-256-GCM.
 * Retorna uma string base64 contendo IV + ciphertext.
 */
export async function encrypt(plaintext: string, tenantId?: string): Promise<string> {
  try {
    const key = await deriveKey(getEncryptionSeed(tenantId));
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encoded = new TextEncoder().encode(plaintext);

    const ciphertext = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encoded
    );

    // Concatena IV + ciphertext e converte para base64
    const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);

    return btoa(String.fromCharCode(...combined));
  } catch (err) {
    logger.error("Erro ao criptografar:", err);
    throw new Error("Falha na criptografia");
  }
}

/**
 * Descriptografa uma string base64 (IV + ciphertext) usando AES-256-GCM.
 * Retorna o texto plano original.
 */
export async function decrypt(encryptedBase64: string, tenantId?: string): Promise<string> {
  try {
    const key = await deriveKey(getEncryptionSeed(tenantId));
    const combined = Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0));

    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);

    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    logger.error("Erro ao descriptografar:", err);
    throw new Error("Falha na descriptografia");
  }
}
