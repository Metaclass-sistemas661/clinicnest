/**
 * Assinatura digital ICP-Brasil A1 (certificado .pfx / .p12)
 *
 * Usa node-forge para:
 *  1. Parsing real do PKCS#12 (extrai CN, CPF/CNPJ, validade, issuer, serial)
 *  2. Assinatura SHA-256 com a chave privada RSA do certificado
 *  3. Verificação de validade do certificado
 *  4. Helpers para UI (upload, validação, status)
 */

import * as forge from "node-forge";

export interface ICPCertificateInfo {
  commonName: string;
  cpfCnpj: string;
  issuer: string;
  notBefore: Date;
  notAfter: Date;
  serialNumber: string;
  isValid: boolean;
  daysUntilExpiry: number;
}

export interface ICPSignatureResult {
  signature: string;
  certificate: ICPCertificateInfo;
  signedAt: string;
  algorithm: string;
  dataHash: string;
}

interface ParsedPfx {
  certInfo: ICPCertificateInfo;
  privateKey: forge.pki.rsa.PrivateKey;
  certificate: forge.pki.Certificate;
}

function extractCpfCnpjFromText(text: string): string {
  const cpf = text.match(/(\d{3}\.?\d{3}\.?\d{3}-?\d{2})/);
  if (cpf) return cpf[1];
  const cnpj = text.match(/(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2})/);
  if (cnpj) return cnpj[1];
  const digits = text.match(/:(\d{11,14})/);
  if (digits) return digits[1];
  return "";
}

function getSubjectField(cert: forge.pki.Certificate, shortName: string): string {
  const attr = cert.subject.getField(shortName);
  return attr ? String(attr.value) : "";
}

function getIssuerField(cert: forge.pki.Certificate, shortName: string): string {
  const attr = cert.issuer.getField(shortName);
  return attr ? String(attr.value) : "";
}

function extractCpfCnpjFromCertificate(cert: forge.pki.Certificate): string {
  const cn = getSubjectField(cert, "CN");
  const cpfFromCn = extractCpfCnpjFromText(cn);
  if (cpfFromCn) return cpfFromCn;

  // ICP-Brasil stores CPF in otherName (OID 2.16.76.1.3.1) inside SAN
  const sanExt = cert.getExtension("subjectAltName") as
    | { altNames?: Array<{ type: number; value?: string; ip?: string }> }
    | null;
  if (sanExt?.altNames) {
    for (const alt of sanExt.altNames) {
      if (alt.value) {
        const found = extractCpfCnpjFromText(alt.value);
        if (found) return found;
      }
    }
  }

  // Fallback: search all subject attributes
  for (const attr of cert.subject.attributes) {
    const found = extractCpfCnpjFromText(String(attr.value));
    if (found) return found;
  }

  return "";
}

function parsePfxInternal(pfxBytes: Uint8Array, password: string): ParsedPfx {
  const derString = forge.util.binary.raw.encode(pfxBytes);
  const asn1 = forge.asn1.fromDer(derString);

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Invalid password") || msg.includes("PKCS#12 MAC")) {
      throw new Error("Senha do certificado incorreta");
    }
    throw new Error(`Erro ao abrir o certificado: ${msg}`);
  }

  // Extract certificate
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBagList = certBags[forge.pki.oids.certBag];
  if (!certBagList || certBagList.length === 0) {
    throw new Error("Nenhum certificado encontrado no arquivo PFX");
  }

  let certificate: forge.pki.Certificate | null = null;
  for (const bag of certBagList) {
    if (bag.cert) {
      certificate = bag.cert;
      break;
    }
  }
  if (!certificate) {
    throw new Error("Certificado X.509 não encontrado no arquivo PFX");
  }

  // Extract private key
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBagList = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag];
  let privateKey: forge.pki.rsa.PrivateKey | null = null;

  if (keyBagList && keyBagList.length > 0 && keyBagList[0].key) {
    privateKey = keyBagList[0].key as forge.pki.rsa.PrivateKey;
  }

  if (!privateKey) {
    const keyBags2 = p12.getBags({ bagType: forge.pki.oids.keyBag });
    const keyBagList2 = keyBags2[forge.pki.oids.keyBag];
    if (keyBagList2 && keyBagList2.length > 0 && keyBagList2[0].key) {
      privateKey = keyBagList2[0].key as forge.pki.rsa.PrivateKey;
    }
  }

  if (!privateKey) {
    throw new Error("Chave privada não encontrada no arquivo PFX");
  }

  const now = new Date();
  const notBefore = certificate.validity.notBefore;
  const notAfter = certificate.validity.notAfter;
  const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const commonName = getSubjectField(certificate, "CN") || "Certificado ICP-Brasil";
  const issuerOrg = getIssuerField(certificate, "O");
  const issuerCn = getIssuerField(certificate, "CN");
  const issuer = issuerOrg || issuerCn || "ICP-Brasil";
  const serialNumber = certificate.serialNumber.toUpperCase();
  const cpfCnpj = extractCpfCnpjFromCertificate(certificate);

  const certInfo: ICPCertificateInfo = {
    commonName,
    cpfCnpj,
    issuer,
    notBefore,
    notAfter,
    serialNumber,
    isValid: now >= notBefore && now <= notAfter,
    daysUntilExpiry,
  };

  return { certInfo, privateKey, certificate };
}

/**
 * Parses certificate info from a PFX/P12 file buffer using node-forge.
 */
export function parsePfxCertificateInfo(pfxBytes: Uint8Array, password: string): ICPCertificateInfo {
  return parsePfxInternal(pfxBytes, password).certInfo;
}

/**
 * Signs data using the real RSA private key extracted from the PFX certificate.
 * Uses RSASSA-PKCS1-v1_5 with SHA-256 (standard for ICP-Brasil).
 */
export async function signWithCertificate(
  data: string,
  pfxBytes: Uint8Array,
  password: string
): Promise<ICPSignatureResult> {
  const { certInfo, privateKey } = parsePfxInternal(pfxBytes, password);

  if (!certInfo.isValid) {
    throw new Error("Certificado expirado ou ainda não válido");
  }

  const md = forge.md.sha256.create();
  md.update(data, "utf8");
  const dataHash = md.digest().toHex();

  const signature = privateKey.sign(md);
  const signatureHex = forge.util.bytesToHex(signature);

  return {
    signature: signatureHex,
    certificate: certInfo,
    signedAt: new Date().toISOString(),
    algorithm: "SHA256withRSA",
    dataHash,
  };
}

/**
 * Verifies a signature against the certificate's public key.
 */
export function verifySignature(
  data: string,
  signatureHex: string,
  pfxBytes: Uint8Array,
  password: string
): boolean {
  const { certificate } = parsePfxInternal(pfxBytes, password);
  const publicKey = certificate.publicKey as forge.pki.rsa.PublicKey;

  const md = forge.md.sha256.create();
  md.update(data, "utf8");

  const signatureBytes = forge.util.hexToBytes(signatureHex);

  try {
    return publicKey.verify(md.digest().bytes(), signatureBytes);
  } catch {
    return false;
  }
}

/**
 * Reads a PFX file from a File input.
 */
export function readPfxFile(file: File): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Erro ao ler arquivo"));
      }
    };
    reader.onerror = () => reject(new Error("Erro ao ler arquivo PFX"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Validates the certificate is suitable for ICP-Brasil medical signing.
 */
export function validateICPCertificate(info: ICPCertificateInfo): string[] {
  const errors: string[] = [];
  if (!info.isValid) errors.push("Certificado expirado ou fora do período de validade");
  if (info.daysUntilExpiry < 30) errors.push(`Certificado expira em ${info.daysUntilExpiry} dias`);
  if (!info.cpfCnpj) errors.push("CPF/CNPJ não encontrado no certificado");
  if (!info.commonName || info.commonName.length < 3) errors.push("Nome do titular não identificado");
  return errors;
}
