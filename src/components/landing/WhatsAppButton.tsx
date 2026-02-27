import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

// Altere para o número oficial da clínica (com DDI, sem +)
const WHATSAPP_NUMBER = "5500000000000";
const WHATSAPP_TEXT = encodeURIComponent(
  "Olá! Vim pelo site do ClinicNest e gostaria de saber mais sobre o sistema. 😊"
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_TEXT}`;

export function WhatsAppButton() {
  const [show, setShow] = useState(false);

  // Show after a small delay for smooth entrance
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 2000);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center justify-center",
        "w-14 h-14 rounded-full shadow-xl transition-all duration-300",
        "bg-[#25D366] hover:bg-[#20BD5A] hover:scale-105 active:scale-95",
        "animate-in fade-in slide-in-from-bottom-3 duration-500",
      )}
      aria-label="Falar pelo WhatsApp"
      title="Fale conosco no WhatsApp"
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white">
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.128 6.744 3.046 9.378L1.054 31.28l6.118-1.958A15.923 15.923 0 0016.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.32 22.608c-.39 1.1-2.272 2.104-3.132 2.178-.788.066-1.748.094-2.82-.178-.65-.166-1.484-.388-2.554-.76-4.49-1.562-7.42-6.112-7.646-6.396-.224-.284-1.834-2.44-1.834-4.654 0-2.214 1.16-3.304 1.572-3.754.39-.426 .876-.534 1.168-.534.282 0 .564.002.81.016.26.012.608-.098.95.724.39.936 1.236 3.024 1.344 3.244.112.22.186.478.038.762-.148.284-.222.462-.438.712-.216.25-.456.558-.65.748-.216.214-.442.446-.19.876.252.43 1.122 1.852 2.41 3 1.658 1.478 3.056 1.936 3.488 2.152.432.216.684.18.936-.108.252-.29 1.082-1.26 1.37-1.694.288-.432.576-.358.972-.214.396.144 2.508 1.184 2.94 1.398.432.214.718.324.824.5.108.178.108 1.028-.282 2.128z" />
      </svg>
    </a>
  );
}
