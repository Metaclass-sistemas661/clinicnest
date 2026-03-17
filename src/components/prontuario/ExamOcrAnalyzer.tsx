import { Spinner } from "@/components/ui/spinner";
import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Camera,
  Upload,
  Loader2,
  FileText,
  AlertTriangle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  CheckCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ExamParameter {
  name: string;
  value: string;
  unit: string;
  reference: string;
  flag: "normal" | "high" | "low" | "critical";
}

interface OcrResult {
  exam_name: string;
  date: string | null;
  laboratory: string | null;
  patient_name: string | null;
  parameters: ExamParameter[];
  notes: string | null;
  raw_text: string;
  error?: string;
}

const FLAG_CONFIG = {
  normal: { label: "Normal", color: "bg-green-100 text-green-700", icon: CheckCircle },
  high: { label: "Alto", color: "bg-amber-100 text-amber-700", icon: ArrowUp },
  low: { label: "Baixo", color: "bg-blue-100 text-blue-700", icon: ArrowDown },
  critical: { label: "Crítico", color: "bg-red-100 text-red-700 font-bold", icon: AlertTriangle },
} as const;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function ExamOcrAnalyzer({ patientId }: { patientId?: string }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<OcrResult | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Use JPEG, PNG, WebP ou PDF.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 10MB.");
      return;
    }

    // Show preview
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    setAnalyzing(true);
    setResult(null);

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada.");
        return;
      }

      const resp = await supabase.functions.invoke("ai-ocr-exam", {
        body: { image_base64: base64, mime_type: file.type },
      });

      if (resp.error) throw resp.error;

      const data = resp.data as { results: OcrResult };
      if (data.results?.error) {
        toast.error(data.results.error);
        setResult(null);
      } else {
        setResult(data.results);
        toast.success("Exame analisado com sucesso!");
      }
    } catch (err) {
      console.error("OCR error:", err);
      toast.error("Erro ao analisar exame.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleCopyResults = async () => {
    if (!result) return;
    const text = result.parameters
      .map((p) => `${p.name}: ${p.value} ${p.unit} (ref: ${p.reference || "-"}) [${p.flag}]`)
      .join("\n");
    const full = `${result.exam_name}${result.date ? ` — ${result.date}` : ""}\n\n${text}${result.notes ? `\n\nObs: ${result.notes}` : ""}`;
    await navigator.clipboard.writeText(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Resultados copiados!");
  };

  const handleClear = () => {
    setResult(null);
    setPreview(null);
  };

  const abnormalCount = result?.parameters?.filter((p) => p.flag !== "normal").length || 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-teal-600" />
          OCR de Exames — IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        {!result && !analyzing && (
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files[0];
              if (file) processFile(file);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-medium">Arraste uma imagem ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP ou PDF — máx 10MB</p>
            <Input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="flex gap-2 justify-center mt-3">
              <Button size="sm" variant="outline" className="gap-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                <Upload className="h-3.5 w-3.5" /> Selecionar Arquivo
              </Button>
            </div>
          </div>
        )}

        {/* Loading */}
        {analyzing && (
          <div className="flex flex-col items-center gap-3 py-8">
            {preview && (
              <img src={preview} alt="Preview" className="h-32 rounded-lg object-contain opacity-50" />
            )}
            <Spinner size="lg" className="text-teal-600" />
            <p className="text-sm text-muted-foreground">Analisando exame com IA...</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-base">{result.exam_name}</h3>
                <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                  {result.date && <span>Data: {result.date}</span>}
                  {result.laboratory && <span>• {result.laboratory}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCopyResults}>
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleClear}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Summary badges */}
            {abnormalCount > 0 && (
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">
                  {abnormalCount} parâmetro{abnormalCount > 1 ? "s" : ""} fora da faixa
                </span>
              </div>
            )}

            {/* Parameters table */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-0 text-xs">
                <div className="font-medium p-2 bg-muted/50">Parâmetro</div>
                <div className="font-medium p-2 bg-muted/50 text-right">Valor</div>
                <div className="font-medium p-2 bg-muted/50 text-right">Referência</div>
                <div className="font-medium p-2 bg-muted/50 text-center">Status</div>

                {result.parameters?.map((param, idx) => {
                  const config = FLAG_CONFIG[param.flag] || FLAG_CONFIG.normal;
                  const Icon = config.icon;
                  return (
                    <div key={idx} className="contents">
                      <div className={cn("p-2 border-t", param.flag === "critical" && "font-semibold")}>
                        {param.name}
                      </div>
                      <div className={cn("p-2 border-t text-right font-mono", param.flag === "critical" && "text-red-700 font-bold")}>
                        {param.value} {param.unit}
                      </div>
                      <div className="p-2 border-t text-right text-muted-foreground">
                        {param.reference || "-"}
                      </div>
                      <div className="p-2 border-t flex justify-center">
                        <Badge variant="outline" className={cn("text-[10px] gap-0.5 px-1.5", config.color)}>
                          <Icon className="h-2.5 w-2.5" />
                          {config.label}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            {result.notes && (
              <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground">
                <strong>Observações:</strong> {result.notes}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
