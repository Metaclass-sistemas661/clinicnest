/**
 * Integrações Odontológicas — Fase 25I
 * Laboratórios de prótese, radiologia digital (DICOM), scanner intraoral (STL)
 */
import { logger } from "@/lib/logger";
// ─── 25I.1: Integração com Laboratórios de Prótese ──────────────────────────

export interface PedidoLaboratorio {
  id?: string;
  tenant_id: string;
  client_id: string;
  professional_id: string;
  treatment_plan_id?: string;
  laboratorio: LaboratorioInfo;
  tipo_trabalho: TipoTrabalhoProtese;
  dentes: number[];
  cor?: string;
  material?: string;
  observacoes?: string;
  prazo_entrega?: string;
  valor_estimado?: number;
  status: StatusPedidoLab;
  created_at?: string;
  updated_at?: string;
}

export interface LaboratorioInfo {
  nome: string;
  cnpj?: string;
  telefone?: string;
  email?: string;
  endereco?: string;
  contato?: string;
}

export type TipoTrabalhoProtese =
  | "coroa_unitaria"
  | "ponte_fixa"
  | "protese_total"
  | "protese_parcial_removivel"
  | "faceta"
  | "inlay_onlay"
  | "nucleo_metalico"
  | "provisorio"
  | "aparelho_ortodontico"
  | "placa_miorrelaxante"
  | "guia_cirurgico"
  | "modelo_estudo"
  | "clareamento_caseiro"
  | "outro";

export type StatusPedidoLab =
  | "rascunho"
  | "enviado"
  | "em_producao"
  | "pronto"
  | "entregue"
  | "instalado"
  | "cancelado";

export const TIPOS_TRABALHO_PROTESE: Record<TipoTrabalhoProtese, string> = {
  coroa_unitaria: "Coroa Unitária",
  ponte_fixa: "Ponte Fixa",
  protese_total: "Prótese Total",
  protese_parcial_removivel: "Prótese Parcial Removível",
  faceta: "Faceta",
  inlay_onlay: "Inlay/Onlay",
  nucleo_metalico: "Núcleo Metálico",
  provisorio: "Provisório",
  aparelho_ortodontico: "Aparelho Ortodôntico",
  placa_miorrelaxante: "Placa Miorrelaxante",
  guia_cirurgico: "Guia Cirúrgico",
  modelo_estudo: "Modelo de Estudo",
  clareamento_caseiro: "Moldeira Clareamento",
  outro: "Outro",
};

export const STATUS_PEDIDO_LAB: Record<StatusPedidoLab, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-500" },
  enviado: { label: "Enviado", color: "bg-blue-500" },
  em_producao: { label: "Em Produção", color: "bg-amber-500" },
  pronto: { label: "Pronto", color: "bg-green-500" },
  entregue: { label: "Entregue", color: "bg-emerald-600" },
  instalado: { label: "Instalado", color: "bg-violet-500" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
};

export const MATERIAIS_PROTESE = [
  "Zircônia",
  "Dissilicato de Lítio (e.max)",
  "Metalocerâmica",
  "Resina",
  "Metal",
  "Cerâmica Feldspática",
  "PMMA",
  "Peek",
  "Cromo-Cobalto",
  "Titânio",
];

export const ESCALA_CORES_VITA = [
  "A1", "A2", "A3", "A3.5", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D2", "D3", "D4",
  "BL1", "BL2", "BL3", "BL4",
];

export function gerarTextoPedidoLaboratorio(pedido: PedidoLaboratorio, pacienteNome: string, profissionalNome: string): string {
  const tipoLabel = TIPOS_TRABALHO_PROTESE[pedido.tipo_trabalho] || pedido.tipo_trabalho;
  const dentesStr = pedido.dentes.length > 0 ? pedido.dentes.join(", ") : "—";
  
  let texto = `PEDIDO DE LABORATÓRIO\n\n`;
  texto += `Data: ${new Date().toLocaleDateString("pt-BR")}\n`;
  texto += `Laboratório: ${pedido.laboratorio.nome}\n\n`;
  texto += `PACIENTE: ${pacienteNome}\n`;
  texto += `PROFISSIONAL: ${profissionalNome}\n\n`;
  texto += `TRABALHO SOLICITADO:\n`;
  texto += `Tipo: ${tipoLabel}\n`;
  texto += `Dente(s): ${dentesStr}\n`;
  if (pedido.cor) texto += `Cor: ${pedido.cor}\n`;
  if (pedido.material) texto += `Material: ${pedido.material}\n`;
  if (pedido.prazo_entrega) texto += `Prazo: ${new Date(pedido.prazo_entrega).toLocaleDateString("pt-BR")}\n`;
  if (pedido.observacoes) texto += `\nOBSERVAÇÕES:\n${pedido.observacoes}\n`;
  
  return texto;
}

// ─── 25I.2: Integração com Radiologia Digital (DICOM) ───────────────────────

export interface DicomStudy {
  studyInstanceUID: string;
  studyDate?: string;
  studyDescription?: string;
  patientName?: string;
  patientID?: string;
  modality?: string;
  numberOfSeries?: number;
  numberOfInstances?: number;
  accessionNumber?: string;
}

export interface DicomSeries {
  seriesInstanceUID: string;
  seriesNumber?: number;
  seriesDescription?: string;
  modality?: string;
  numberOfInstances?: number;
}

export interface DicomImage {
  sopInstanceUID: string;
  instanceNumber?: number;
  imageType?: string;
  rows?: number;
  columns?: number;
  bitsAllocated?: number;
  photometricInterpretation?: string;
}

export interface DicomServerConfig {
  name: string;
  host: string;
  port: number;
  aet: string;
  protocol: "DIMSE" | "WADO-RS" | "STOW-RS";
  username?: string;
  password?: string;
}

export const MODALIDADES_DICOM_ODONTO = {
  IO: "Intraoral",
  PX: "Panorâmica",
  CT: "Tomografia",
  DX: "Radiografia Digital",
  CR: "Radiografia Computadorizada",
  OT: "Outros",
};

/**
 * Parser básico de tags DICOM (para arquivos .dcm)
 * Em produção, usar biblioteca como cornerstone.js ou dicom-parser
 */
export function parseDicomBasicTags(arrayBuffer: ArrayBuffer): Partial<DicomStudy> | null {
  try {
    const dataView = new DataView(arrayBuffer);
    
    // Verificar magic number DICM no offset 128
    if (arrayBuffer.byteLength < 132) return null;
    const magic = String.fromCharCode(
      dataView.getUint8(128),
      dataView.getUint8(129),
      dataView.getUint8(130),
      dataView.getUint8(131)
    );
    
    if (magic !== "DICM") {
      console.warn("Arquivo não é DICOM válido (magic number ausente)");
      return null;
    }
    
    // Retornar estrutura básica - parsing completo requer biblioteca especializada
    return {
      studyInstanceUID: `imported_${Date.now()}`,
      studyDescription: "Imagem importada",
      modality: "OT",
    };
  } catch (err) {
    logger.error("Erro ao parsear DICOM:", err);
    return null;
  }
}

/**
 * Gera URL para visualização WADO-RS
 */
export function buildWadoUrl(
  server: DicomServerConfig,
  studyUID: string,
  seriesUID?: string,
  instanceUID?: string
): string {
  let url = `${server.protocol === "WADO-RS" ? "https" : "http"}://${server.host}:${server.port}`;
  url += `/dicomweb/studies/${studyUID}`;
  if (seriesUID) url += `/series/${seriesUID}`;
  if (instanceUID) url += `/instances/${instanceUID}`;
  return url;
}

// ─── 25I.3: Integração com Scanner Intraoral (STL) ──────────────────────────

export interface ModeloIntraoral {
  id?: string;
  tenant_id: string;
  client_id: string;
  professional_id: string;
  scanner_tipo: TipoScannerIntraoral;
  data_escaneamento: string;
  tipo_modelo: TipoModeloSTL;
  arcada: "superior" | "inferior" | "ambas";
  arquivo_stl_url?: string;
  arquivo_ply_url?: string;
  arquivo_obj_url?: string;
  thumbnail_url?: string;
  tamanho_bytes?: number;
  observacoes?: string;
  created_at?: string;
}

export type TipoScannerIntraoral =
  | "itero"
  | "cerec"
  | "trios"
  | "medit"
  | "carestream"
  | "planmeca"
  | "outro";

export type TipoModeloSTL =
  | "impressao_digital"
  | "preparo_coroa"
  | "preparo_faceta"
  | "alinhador"
  | "guia_cirurgico"
  | "modelo_estudo"
  | "planejamento_implante"
  | "outro";

export const SCANNERS_INTRAORAIS: Record<TipoScannerIntraoral, { nome: string; fabricante: string }> = {
  itero: { nome: "iTero Element", fabricante: "Align Technology" },
  cerec: { nome: "CEREC Primescan", fabricante: "Dentsply Sirona" },
  trios: { nome: "TRIOS", fabricante: "3Shape" },
  medit: { nome: "Medit i700", fabricante: "Medit" },
  carestream: { nome: "CS 3600", fabricante: "Carestream" },
  planmeca: { nome: "Emerald", fabricante: "Planmeca" },
  outro: { nome: "Outro", fabricante: "—" },
};

export const TIPOS_MODELO_STL: Record<TipoModeloSTL, string> = {
  impressao_digital: "Impressão Digital",
  preparo_coroa: "Preparo para Coroa",
  preparo_faceta: "Preparo para Faceta",
  alinhador: "Alinhador/Ortodontia",
  guia_cirurgico: "Guia Cirúrgico",
  modelo_estudo: "Modelo de Estudo",
  planejamento_implante: "Planejamento de Implante",
  outro: "Outro",
};

/**
 * Valida arquivo STL (verifica header)
 */
export function validateSTLFile(arrayBuffer: ArrayBuffer): { valid: boolean; type: "ascii" | "binary" | null; error?: string } {
  if (arrayBuffer.byteLength < 84) {
    return { valid: false, type: null, error: "Arquivo muito pequeno para ser STL válido" };
  }
  
  // Verificar se é ASCII (começa com "solid")
  const header = new Uint8Array(arrayBuffer, 0, 5);
  const headerStr = String.fromCharCode(...header);
  
  if (headerStr === "solid") {
    // Pode ser ASCII, mas precisa verificar se não é binário com header "solid"
    const fullHeader = new Uint8Array(arrayBuffer, 0, 80);
    const fullHeaderStr = String.fromCharCode(...fullHeader);
    
    // Se contém "facet" logo após, é ASCII
    if (fullHeaderStr.includes("facet")) {
      return { valid: true, type: "ascii" };
    }
  }
  
  // Verificar se é binário (80 bytes header + 4 bytes num triangles)
  const dataView = new DataView(arrayBuffer);
  const numTriangles = dataView.getUint32(80, true); // little-endian
  const expectedSize = 84 + (numTriangles * 50); // header + triangles
  
  // Tolerância de alguns bytes
  if (Math.abs(arrayBuffer.byteLength - expectedSize) < 100) {
    return { valid: true, type: "binary" };
  }
  
  return { valid: false, type: null, error: "Formato STL não reconhecido" };
}

/**
 * Extrai informações básicas de arquivo STL binário
 */
export function parseSTLBinaryInfo(arrayBuffer: ArrayBuffer): { triangles: number; header: string } | null {
  try {
    if (arrayBuffer.byteLength < 84) return null;
    
    const headerBytes = new Uint8Array(arrayBuffer, 0, 80);
    const header = String.fromCharCode(...headerBytes).replace(/\0/g, "").trim();
    
    const dataView = new DataView(arrayBuffer);
    const triangles = dataView.getUint32(80, true);
    
    return { triangles, header };
  } catch {
    return null;
  }
}

/**
 * Gera thumbnail placeholder para modelo 3D
 * Em produção, usar Three.js para renderizar preview real
 */
export function generateSTLThumbnailPlaceholder(tipo: TipoModeloSTL, arcada: string): string {
  // Retorna SVG placeholder
  const label = TIPOS_MODELO_STL[tipo] || "Modelo 3D";
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f3f4f6"/>
      <text x="100" y="90" text-anchor="middle" font-family="system-ui" font-size="14" fill="#6b7280">
        ${label}
      </text>
      <text x="100" y="115" text-anchor="middle" font-family="system-ui" font-size="12" fill="#9ca3af">
        Arcada ${arcada}
      </text>
      <path d="M70 140 L100 160 L130 140 L100 120 Z" fill="#3b82f6" opacity="0.5"/>
      <path d="M70 140 L100 120 L100 160 Z" fill="#2563eb" opacity="0.7"/>
      <path d="M130 140 L100 120 L100 160 Z" fill="#1d4ed8" opacity="0.6"/>
    </svg>
  `)}`;
}

// ─── Utilitários de Upload ──────────────────────────────────────────────────

export const ACCEPTED_DICOM_EXTENSIONS = [".dcm", ".dicom", ".dic"];
export const ACCEPTED_3D_EXTENSIONS = [".stl", ".ply", ".obj"];

export function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf(".")).toLowerCase();
}

export function isValidDicomFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ACCEPTED_DICOM_EXTENSIONS.includes(ext);
}

export function isValid3DFile(filename: string): boolean {
  const ext = getFileExtension(filename);
  return ACCEPTED_3D_EXTENSIONS.includes(ext);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
