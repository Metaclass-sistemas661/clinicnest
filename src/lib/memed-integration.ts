/**
 * Memed Prescrição Eletrônica - Módulo de Integração
 *
 * A integração real com o Memed requer:
 * 1. Contrato/cadastro em https://memed.com.br
 * 2. API Key fornecida pelo Memed
 * 3. Token do profissional (médico cadastrado no Memed)
 *
 * Este módulo fornece a estrutura para carregar o SDK e iniciar prescrições.
 * Para ativar, adicione VITE_MEMED_API_KEY no .env e habilite nas configurações.
 */

const MEMED_SDK_URL = "https://memed.com.br/modulos/plataforma.sinapse-prescricao/build/sinapse-prescricao.min.js";

let sdkLoaded = false;

export function isMemedConfigured(): boolean {
  return !!import.meta.env.VITE_MEMED_API_KEY;
}

export function loadMemedSdk(): Promise<void> {
  if (sdkLoaded) return Promise.resolve();
  if (!isMemedConfigured()) return Promise.reject(new Error("Memed API Key não configurada"));

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = MEMED_SDK_URL;
    script.dataset.color = "#1e88e5";
    script.dataset.token = import.meta.env.VITE_MEMED_API_KEY;
    script.onload = () => {
      sdkLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Falha ao carregar SDK Memed"));
    document.head.appendChild(script);
  });
}

export interface MemedPrescription {
  id: string;
  patient: { name: string; cpf?: string };
  medications: Array<{
    name: string;
    dosage: string;
    quantity: string;
    instructions: string;
  }>;
  createdAt: string;
}

export function openMemedPrescription(
  patientName: string,
  patientCpf?: string,
): void {
  const MdSin498 = (window as any).MdSin498;
  if (!MdSin498) {
    throw new Error("SDK Memed não carregado. Chame loadMemedSdk() antes.");
  }

  MdSinapsePrescricao.event.add("core:moduleInit", (module: any) => {
    if (module.name === "plataforma.prescricao") {
      MdSinapsePrescricao.event.add("prescricaoSalva", (prescriptionData: any) => {
        window.dispatchEvent(
          new CustomEvent("memed:prescription-saved", { detail: prescriptionData })
        );
      });
    }
  });

  MdSinapsePrescricao.command.send("plataforma.prescricao", "setPaciente", {
    nome: patientName,
    cpf: patientCpf || "",
  });
}
