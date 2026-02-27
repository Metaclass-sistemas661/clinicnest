/**
 * BirdID Integration for Cloud-based ICP-Brasil Certificates
 * 
 * BirdID is a cloud certificate service by Soluti that allows
 * digital signatures without physical tokens or smart cards.
 * 
 * Documentation: https://developers.birdid.com.br/
 */

export interface BirdIdConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment: "sandbox" | "production";
}

export interface BirdIdUser {
  id: string;
  name: string;
  email: string;
  cpf: string;
  certificates: BirdIdCertificate[];
}

export interface BirdIdCertificate {
  id: string;
  alias: string;
  subjectName: string;
  issuerName: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  cpf?: string;
  cnpj?: string;
}

export interface BirdIdSignatureResult {
  signature: string;
  certificate: BirdIdCertificate;
  signedAt: Date;
  transactionId: string;
}

export interface BirdIdAuthResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: BirdIdUser;
}

interface BirdIdRawCertificate {
  id: string;
  alias: string;
  subject_name: string;
  issuer_name: string;
  serial_number: string;
  valid_from: string;
  valid_to: string;
  cpf?: string;
  cnpj?: string;
}

interface BirdIdTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface BirdIdUserResponse {
  id: string;
  name: string;
  email: string;
  cpf: string;
  certificates?: BirdIdRawCertificate[];
}

interface BirdIdCertificatesResponse {
  certificates?: BirdIdRawCertificate[];
}

interface BirdIdSignResponse {
  signature: string;
  transaction_id: string;
}

interface BirdIdErrorResponse {
  error_description?: string;
  message?: string;
}

const BIRDID_URLS = {
  sandbox: {
    auth: "https://hom-birdid.soluti.com.br/oauth",
    api: "https://hom-birdid.soluti.com.br/api/v1",
  },
  production: {
    auth: "https://birdid.soluti.com.br/oauth",
    api: "https://birdid.soluti.com.br/api/v1",
  },
};

let config: BirdIdConfig | null = null;
let currentAuth: BirdIdAuthResult | null = null;

export function initBirdId(birdIdConfig: BirdIdConfig): void {
  config = birdIdConfig;
}

export function getBirdIdConfig(): BirdIdConfig | null {
  return config;
}

export function getAuthorizationUrl(state?: string): string {
  if (!config) {
    throw new Error("BirdID não configurado. Chame initBirdId() primeiro.");
  }

  const baseUrl = BIRDID_URLS[config.environment].auth;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: "signature_session single_signature",
    state: state || crypto.randomUUID(),
  });

  return `${baseUrl}/authorize?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<BirdIdAuthResult> {
  if (!config) {
    throw new Error("BirdID não configurado.");
  }

  const baseUrl = BIRDID_URLS[config.environment].auth;
  
  const response = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error: BirdIdErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.error_description || "Falha na autenticação BirdID");
  }

  const tokenData: BirdIdTokenResponse = await response.json();
  
  const userResponse = await fetch(`${BIRDID_URLS[config.environment].api}/user`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  });

  if (!userResponse.ok) {
    throw new Error("Falha ao obter dados do usuário BirdID");
  }

  const userData: BirdIdUserResponse = await userResponse.json();

  currentAuth = {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    tokenType: tokenData.token_type,
    user: {
      id: userData.id,
      name: userData.name,
      email: userData.email,
      cpf: userData.cpf,
      certificates: (userData.certificates || []).map((cert: BirdIdRawCertificate) => ({
        id: cert.id,
        alias: cert.alias,
        subjectName: cert.subject_name,
        issuerName: cert.issuer_name,
        serialNumber: cert.serial_number,
        validFrom: new Date(cert.valid_from),
        validTo: new Date(cert.valid_to),
        cpf: cert.cpf,
        cnpj: cert.cnpj,
      })),
    },
  };

  return currentAuth;
}

export async function refreshAccessToken(): Promise<BirdIdAuthResult> {
  if (!config || !currentAuth?.refreshToken) {
    throw new Error("Sessão BirdID não encontrada. Faça login novamente.");
  }

  const baseUrl = BIRDID_URLS[config.environment].auth;
  
  const response = await fetch(`${baseUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${config.clientId}:${config.clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: currentAuth.refreshToken,
    }),
  });

  if (!response.ok) {
    currentAuth = null;
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  const tokenData: BirdIdTokenResponse = await response.json();
  
  currentAuth = {
    ...currentAuth,
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token || currentAuth.refreshToken,
    expiresIn: tokenData.expires_in,
  };

  return currentAuth;
}

export function getCurrentAuth(): BirdIdAuthResult | null {
  return currentAuth;
}

export function isAuthenticated(): boolean {
  return currentAuth !== null;
}

export function logout(): void {
  currentAuth = null;
}

export async function listCloudCertificates(): Promise<BirdIdCertificate[]> {
  if (!config || !currentAuth) {
    throw new Error("Não autenticado no BirdID.");
  }

  const response = await fetch(`${BIRDID_URLS[config.environment].api}/certificates`, {
    headers: {
      Authorization: `Bearer ${currentAuth.accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      await refreshAccessToken();
      return listCloudCertificates();
    }
    throw new Error("Falha ao listar certificados BirdID");
  }

  const data: BirdIdCertificatesResponse = await response.json();
  
  return (data.certificates || []).map((cert: BirdIdRawCertificate) => ({
    id: cert.id,
    alias: cert.alias,
    subjectName: cert.subject_name,
    issuerName: cert.issuer_name,
    serialNumber: cert.serial_number,
    validFrom: new Date(cert.valid_from),
    validTo: new Date(cert.valid_to),
    cpf: cert.cpf,
    cnpj: cert.cnpj,
  }));
}

export async function signWithCloudCertificate(
  certificateId: string,
  data: string,
  pin?: string
): Promise<BirdIdSignatureResult> {
  if (!config || !currentAuth) {
    throw new Error("Não autenticado no BirdID.");
  }

  const hash = await generateSHA256Hash(data);

  const response = await fetch(`${BIRDID_URLS[config.environment].api}/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentAuth.accessToken}`,
    },
    body: JSON.stringify({
      certificate_id: certificateId,
      hash,
      hash_algorithm: "SHA-256",
      pin,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await refreshAccessToken();
      return signWithCloudCertificate(certificateId, data, pin);
    }
    const error: BirdIdErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.message || "Falha na assinatura BirdID");
  }

  const result: BirdIdSignResponse = await response.json();
  
  const certificate = currentAuth.user.certificates.find(c => c.id === certificateId);
  
  return {
    signature: result.signature,
    certificate: certificate || {
      id: certificateId,
      alias: "Certificado BirdID",
      subjectName: currentAuth.user.name,
      issuerName: "BirdID",
      serialNumber: "",
      validFrom: new Date(),
      validTo: new Date(),
      cpf: currentAuth.user.cpf,
    },
    signedAt: new Date(),
    transactionId: result.transaction_id,
  };
}

export async function signHashWithCloudCertificate(
  certificateId: string,
  hash: string,
  pin?: string
): Promise<BirdIdSignatureResult> {
  if (!config || !currentAuth) {
    throw new Error("Não autenticado no BirdID.");
  }

  const response = await fetch(`${BIRDID_URLS[config.environment].api}/sign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${currentAuth.accessToken}`,
    },
    body: JSON.stringify({
      certificate_id: certificateId,
      hash,
      hash_algorithm: "SHA-256",
      pin,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      await refreshAccessToken();
      return signHashWithCloudCertificate(certificateId, hash, pin);
    }
    const error: BirdIdErrorResponse = await response.json().catch(() => ({}));
    throw new Error(error.message || "Falha na assinatura BirdID");
  }

  const result: BirdIdSignResponse = await response.json();
  
  const certificate = currentAuth.user.certificates.find(c => c.id === certificateId);
  
  return {
    signature: result.signature,
    certificate: certificate || {
      id: certificateId,
      alias: "Certificado BirdID",
      subjectName: currentAuth.user.name,
      issuerName: "BirdID",
      serialNumber: "",
      validFrom: new Date(),
      validTo: new Date(),
      cpf: currentAuth.user.cpf,
    },
    signedAt: new Date(),
    transactionId: result.transaction_id,
  };
}

async function generateSHA256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export function formatBirdIdCertificateName(cert: BirdIdCertificate): string {
  const name = cert.subjectName.split(",")[0].replace("CN=", "");
  const cpf = cert.cpf;
  
  if (cpf) {
    const maskedCpf = `***.***.${cpf.slice(6, 9)}-**`;
    return `${name} (${maskedCpf}) - Nuvem`;
  }
  
  return `${name} - Nuvem`;
}

export function isBirdIdCertificateValid(cert: BirdIdCertificate): boolean {
  const now = new Date();
  return now >= cert.validFrom && now <= cert.validTo;
}

export function getBirdIdOAuthCallbackHandler() {
  return async (searchParams: URLSearchParams): Promise<BirdIdAuthResult | null> => {
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error) {
      throw new Error(errorDescription || `Erro BirdID: ${error}`);
    }

    if (!code) {
      return null;
    }

    return exchangeCodeForToken(code);
  };
}
