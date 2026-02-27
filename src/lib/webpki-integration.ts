/**
 * WebPKI Integration for ICP-Brasil A3 Certificates (Token/Smart Card)
 * 
 * WebPKI is a browser extension by Lacuna Software that enables
 * access to hardware-based certificates (A3) from web applications.
 * 
 * Documentation: https://docs.lacunasoftware.com/en-us/articles/web-pki/
 */

import { logger } from "@/lib/logger";

export interface WebPkiCertificate {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  pkiBrazil?: {
    cpf?: string;
    cnpj?: string;
    responsavel?: string;
    dateOfBirth?: string;
    companyName?: string;
    oabUF?: string;
    oabNumero?: string;
    rgNumero?: string;
    rgEmissor?: string;
    rgEmissorUF?: string;
  };
}

export interface WebPkiSignatureResult {
  signature: string;
  certificate: WebPkiCertificate;
  signedAt: Date;
}

export type WebPkiStatus = "not_installed" | "outdated" | "ready" | "checking";

declare global {
  interface Window {
    LacunaWebPKI?: {
      new (): LacunaWebPKIInstance;
    };
  }
}

interface WebPkiRawCertificate {
  thumbprint: string;
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  validityStart: string;
  validityEnd: string;
  pkiBrazil?: {
    cpf?: string;
    cnpj?: string;
    responsavel?: string;
    dateOfBirth?: string;
    companyName?: string;
    oabUF?: string;
    oabNumero?: string;
    rgNumero?: string;
    rgEmissor?: string;
    rgEmissorUF?: string;
  };
}

interface LacunaWebPKIInstance {
  init(args: {
    ready: () => void;
    notInstalled?: (status: number, message: string) => void;
    defaultFail?: (ex: { message: string; error: string }) => void;
    license?: string;
  }): void;
  listCertificates(args?: { selectId?: string; selectOptionFormatter?: (cert: WebPkiRawCertificate) => string }): Promise<WebPkiRawCertificate[]>;
  readCertificate(thumbprint: string): Promise<WebPkiRawCertificate>;
  signHash(args: {
    thumbprint: string;
    hash: string;
    digestAlgorithm: string;
  }): Promise<string>;
  signData(args: {
    thumbprint: string;
    data: string;
    digestAlgorithm: string;
  }): Promise<string>;
  preauthorizeSignatures(args: {
    certificateThumbprint: string;
    signatureCount: number;
  }): Promise<void>;
}

let webPkiInstance: LacunaWebPKIInstance | null = null;
let webPkiStatus: WebPkiStatus = "checking";
let initPromise: Promise<void> | null = null;

const WEBPKI_SCRIPT_URL = "https://cdn.lacunasoftware.com/libs/web-pki/lacuna-web-pki-2.16.1.min.js";

async function loadWebPkiScript(): Promise<void> {
  if (window.LacunaWebPKI) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = WEBPKI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load WebPKI script"));
    document.head.appendChild(script);
  });
}

export async function initWebPki(license?: string): Promise<WebPkiStatus> {
  if (initPromise) {
    await initPromise;
    return webPkiStatus;
  }

  initPromise = new Promise(async (resolve) => {
    try {
      await loadWebPkiScript();

      if (!window.LacunaWebPKI) {
        webPkiStatus = "not_installed";
        resolve();
        return;
      }

      webPkiInstance = new window.LacunaWebPKI();

      webPkiInstance.init({
        ready: () => {
          webPkiStatus = "ready";
          resolve();
        },
        notInstalled: (status, message) => {
          console.warn("WebPKI not installed:", message);
          webPkiStatus = status === 2 ? "outdated" : "not_installed";
          resolve();
        },
        defaultFail: (ex) => {
          logger.error("WebPKI init failed:", ex);
          webPkiStatus = "not_installed";
          resolve();
        },
        license: license,
      });
    } catch (error) {
      logger.error("WebPKI load error:", error);
      webPkiStatus = "not_installed";
      resolve();
    }
  });

  await initPromise;
  return webPkiStatus;
}

export function getWebPkiStatus(): WebPkiStatus {
  return webPkiStatus;
}

export function isWebPkiReady(): boolean {
  return webPkiStatus === "ready" && webPkiInstance !== null;
}

export async function listA3Certificates(): Promise<WebPkiCertificate[]> {
  if (!isWebPkiReady() || !webPkiInstance) {
    throw new Error("WebPKI não está disponível. Verifique se a extensão está instalada.");
  }

  const certs = await webPkiInstance.listCertificates();
  
  return certs.map((cert) => ({
    thumbprint: cert.thumbprint,
    subjectName: cert.subjectName,
    issuerName: cert.issuerName,
    serialNumber: cert.serialNumber,
    validFrom: new Date(cert.validityStart),
    validTo: new Date(cert.validityEnd),
    pkiBrazil: cert.pkiBrazil ? {
      cpf: cert.pkiBrazil.cpf,
      cnpj: cert.pkiBrazil.cnpj,
      responsavel: cert.pkiBrazil.responsavel,
      dateOfBirth: cert.pkiBrazil.dateOfBirth,
      companyName: cert.pkiBrazil.companyName,
      oabUF: cert.pkiBrazil.oabUF,
      oabNumero: cert.pkiBrazil.oabNumero,
      rgNumero: cert.pkiBrazil.rgNumero,
      rgEmissor: cert.pkiBrazil.rgEmissor,
      rgEmissorUF: cert.pkiBrazil.rgEmissorUF,
    } : undefined,
  }));
}

export async function getCertificateDetails(thumbprint: string): Promise<WebPkiCertificate> {
  if (!isWebPkiReady() || !webPkiInstance) {
    throw new Error("WebPKI não está disponível.");
  }

  const cert = await webPkiInstance.readCertificate(thumbprint);
  
  return {
    thumbprint: cert.thumbprint,
    subjectName: cert.subjectName,
    issuerName: cert.issuerName,
    serialNumber: cert.serialNumber,
    validFrom: new Date(cert.validityStart),
    validTo: new Date(cert.validityEnd),
    pkiBrazil: cert.pkiBrazil ? {
      cpf: cert.pkiBrazil.cpf,
      cnpj: cert.pkiBrazil.cnpj,
      responsavel: cert.pkiBrazil.responsavel,
      dateOfBirth: cert.pkiBrazil.dateOfBirth,
      companyName: cert.pkiBrazil.companyName,
    } : undefined,
  };
}

export async function signWithA3Certificate(
  thumbprint: string,
  data: string
): Promise<WebPkiSignatureResult> {
  if (!isWebPkiReady() || !webPkiInstance) {
    throw new Error("WebPKI não está disponível.");
  }

  const signature = await webPkiInstance.signData({
    thumbprint,
    data: btoa(data),
    digestAlgorithm: "SHA-256",
  });

  const cert = await getCertificateDetails(thumbprint);

  return {
    signature,
    certificate: cert,
    signedAt: new Date(),
  };
}

export async function signHashWithA3Certificate(
  thumbprint: string,
  hash: string
): Promise<WebPkiSignatureResult> {
  if (!isWebPkiReady() || !webPkiInstance) {
    throw new Error("WebPKI não está disponível.");
  }

  const signature = await webPkiInstance.signHash({
    thumbprint,
    hash,
    digestAlgorithm: "SHA-256",
  });

  const cert = await getCertificateDetails(thumbprint);

  return {
    signature,
    certificate: cert,
    signedAt: new Date(),
  };
}

export async function preauthorizeSignatures(
  thumbprint: string,
  count: number = 10
): Promise<void> {
  if (!isWebPkiReady() || !webPkiInstance) {
    throw new Error("WebPKI não está disponível.");
  }

  await webPkiInstance.preauthorizeSignatures({
    certificateThumbprint: thumbprint,
    signatureCount: count,
  });
}

export function getWebPkiInstallUrl(): string {
  return "https://get.webpkiplugin.com/";
}

export function formatCertificateName(cert: WebPkiCertificate): string {
  const name = cert.subjectName.split(",")[0].replace("CN=", "");
  const cpf = cert.pkiBrazil?.cpf;
  
  if (cpf) {
    const maskedCpf = `***.***.${cpf.slice(6, 9)}-**`;
    return `${name} (${maskedCpf})`;
  }
  
  return name;
}

export function isCertificateValid(cert: WebPkiCertificate): boolean {
  const now = new Date();
  return now >= cert.validFrom && now <= cert.validTo;
}

export function isCertificateExpiringSoon(cert: WebPkiCertificate, daysThreshold: number = 30): boolean {
  const now = new Date();
  const threshold = new Date(now.getTime() + daysThreshold * 24 * 60 * 60 * 1000);
  return cert.validTo <= threshold && cert.validTo > now;
}
