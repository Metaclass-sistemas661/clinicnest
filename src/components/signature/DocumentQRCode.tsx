import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { logger } from "@/lib/logger";

interface DocumentQRCodeProps {
  hash: string;
  size?: number;
  className?: string;
}

export function getVerificationUrl(hash: string): string {
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : "https://clinicnest.com.br";
  return `${baseUrl}/verificar/${hash}`;
}

export function DocumentQRCode({ hash, size = 100, className = "" }: DocumentQRCodeProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hash) return;

    const url = getVerificationUrl(hash);
    
    QRCode.toDataURL(url, {
      width: size,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
      errorCorrectionLevel: "M",
    })
      .then(setQrDataUrl)
      .catch((err) => {
        logger.error("Error generating QR code:", err);
        setError("Erro ao gerar QR Code");
      });
  }, [hash, size]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded ${className}`} style={{ width: size, height: size }}>
        <span className="text-xs text-muted-foreground">QR</span>
      </div>
    );
  }

  if (!qrDataUrl) {
    return (
      <div className={`flex items-center justify-center bg-muted rounded animate-pulse ${className}`} style={{ width: size, height: size }} />
    );
  }

  return (
    <img
      src={qrDataUrl}
      alt="QR Code de verificação"
      width={size}
      height={size}
      className={`rounded ${className}`}
    />
  );
}

export async function generateQRCodeDataUrl(hash: string, size: number = 100): Promise<string> {
  const url = getVerificationUrl(hash);
  return QRCode.toDataURL(url, {
    width: size,
    margin: 1,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
    errorCorrectionLevel: "M",
  });
}

export async function generateQRCodeBase64(hash: string, size: number = 100): Promise<string> {
  const dataUrl = await generateQRCodeDataUrl(hash, size);
  return dataUrl.replace(/^data:image\/png;base64,/, "");
}
