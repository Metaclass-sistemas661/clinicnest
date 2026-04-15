import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  Check,
  AlertTriangle,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ---------- Types ----------
type Step = "upload" | "mapping" | "preview" | "importing" | "result";

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  dbField: string | "__skip__";
}

interface ImportResult {
  total: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

// ---------- Constants ----------
const DB_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "name", label: "Nome *", required: true },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "cpf", label: "CPF" },
  { key: "date_of_birth", label: "Data de Nascimento" },
  { key: "gender", label: "Sexo" },
  { key: "notes", label: "Observações" },
  { key: "zip_code", label: "CEP" },
  { key: "street", label: "Rua" },
  { key: "street_number", label: "Número" },
  { key: "complement", label: "Complemento" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "allergies", label: "Alergias" },
  { key: "occupation", label: "Profissão" },
  { key: "emergency_name", label: "Contato Emergência - Nome" },
  { key: "emergency_phone", label: "Contato Emergência - Telefone" },
];

const AUTO_MAP: Record<string, string> = {
  nome: "name",
  name: "name",
  "nome completo": "name",
  full_name: "name",
  telefone: "phone",
  phone: "phone",
  celular: "phone",
  email: "email",
  "e-mail": "email",
  cpf: "cpf",
  "data de nascimento": "date_of_birth",
  "data nascimento": "date_of_birth",
  nascimento: "date_of_birth",
  birth_date: "date_of_birth",
  date_of_birth: "date_of_birth",
  sexo: "gender",
  gender: "gender",
  observacoes: "notes",
  observações: "notes",
  notes: "notes",
  cep: "zip_code",
  zip: "zip_code",
  rua: "street",
  street: "street",
  endereco: "street",
  endereço: "street",
  numero: "street_number",
  número: "street_number",
  complemento: "complement",
  bairro: "neighborhood",
  cidade: "city",
  city: "city",
  estado: "state",
  uf: "state",
  state: "state",
  alergias: "allergies",
  allergies: "allergies",
  profissao: "occupation",
  profissão: "occupation",
  occupation: "occupation",
};

const MAX_ROWS = 5000;
const BATCH_SIZE = 100;

// ---------- CSV Parsing ----------
function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect delimiter
  const firstLine = lines[0];
  const delimiter = firstLine.includes(";") ? ";" : ",";

  const parseRow = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseRow(lines[0]);
  const rows: CsvRow[] = [];

  for (let i = 1; i < Math.min(lines.length, MAX_ROWS + 1); i++) {
    const values = parseRow(lines[i]);
    if (values.every((v) => !v)) continue; // skip empty rows
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function normalizeKey(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function autoMapColumns(headers: string[]): ColumnMapping[] {
  const usedFields = new Set<string>();
  return headers.map((h) => {
    const norm = normalizeKey(h);
    const mapped = AUTO_MAP[norm];
    if (mapped && !usedFields.has(mapped)) {
      usedFields.add(mapped);
      return { csvColumn: h, dbField: mapped };
    }
    return { csvColumn: h, dbField: "__skip__" };
  });
}

function normalizeCpf(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

function normalizeDate(raw: string): string | null {
  // DD/MM/YYYY or DD-MM-YYYY
  const match = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

// ---------- Component ----------
interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  currentPatientCount: number;
  patientLimit: number;
}

export function CsvImportDialog({
  open,
  onOpenChange,
  onSuccess,
  currentPatientCount,
  patientLimit,
}: CsvImportDialogProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMappings([]);
    setResult(null);
  }, []);

  const handleClose = useCallback(
    (v: boolean) => {
      if (!v) reset();
      onOpenChange(v);
    },
    [onOpenChange, reset]
  );

  // Step 1: File Upload
  const handleFile = useCallback(
    (file: File) => {
      if (!file.name.match(/\.(csv|txt)$/i)) {
        toast.error("Formato inválido. Envie um arquivo .csv");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo 10 MB.");
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers: h, rows: r } = parseCsv(text);
        if (h.length === 0 || r.length === 0) {
          toast.error("Arquivo vazio ou sem dados válidos.");
          return;
        }
        setHeaders(h);
        setRows(r);
        setMappings(autoMapColumns(h));
        setStep("mapping");
      };
      reader.readAsText(file, "utf-8");
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Step 2: Column Mapping
  const updateMapping = useCallback((csvColumn: string, dbField: string) => {
    setMappings((prev) =>
      prev.map((m) => (m.csvColumn === csvColumn ? { ...m, dbField } : m))
    );
  }, []);

  const hasNameMapping = mappings.some((m) => m.dbField === "name");

  // Step 3: Preview
  const previewRows = rows.slice(0, 5);
  const activeMappings = mappings.filter((m) => m.dbField !== "__skip__");

  // Step 4: Import
  const handleImport = useCallback(async () => {
    if (!profile?.tenant_id) return;

    setStep("importing");
    const importResult: ImportResult = { total: rows.length, inserted: 0, skipped: 0, errors: [] };

    // Check limit
    const available =
      patientLimit === -1 ? Infinity : patientLimit - currentPatientCount;
    const toImport = rows.slice(0, available === Infinity ? rows.length : available);
    if (toImport.length < rows.length) {
      importResult.skipped += rows.length - toImport.length;
      importResult.errors.push(
        `${rows.length - toImport.length} pacientes pulados: limite do plano atingido`
      );
    }

    // Build field map
    const fieldMap = new Map<string, string>();
    mappings.forEach((m) => {
      if (m.dbField !== "__skip__") {
        fieldMap.set(m.dbField, m.csvColumn);
      }
    });

    // Fetch existing CPFs for dedup
    const cpfField = fieldMap.get("cpf");
    let existingCpfs = new Set<string>();
    if (cpfField) {
      const { data } = await api
        .from("patients")
        .select("cpf")
        .eq("tenant_id", profile.tenant_id)
        .not("cpf", "is", null);
      if (data) {
        existingCpfs = new Set(data.map((r) => r.cpf!).filter(Boolean));
      }
    }

    // Process in batches
    for (let i = 0; i < toImport.length; i += BATCH_SIZE) {
      const batch = toImport.slice(i, i + BATCH_SIZE);
      const records: Record<string, unknown>[] = [];

      for (const row of batch) {
        const name = row[fieldMap.get("name") ?? ""]?.trim();
        if (!name) {
          importResult.skipped++;
          continue;
        }

        // CPF dedup
        const rawCpf = cpfField ? row[cpfField] : "";
        const cpf = rawCpf ? normalizeCpf(rawCpf) : null;
        if (cpf && existingCpfs.has(cpf)) {
          importResult.skipped++;
          importResult.errors.push(`CPF duplicado: ${rawCpf} (${name})`);
          continue;
        }

        const record: Record<string, unknown> = {
          tenant_id: profile.tenant_id,
          name,
        };

        if (cpf) {
          record.cpf = cpf;
          existingCpfs.add(cpf);
        }

        const phoneCol = fieldMap.get("phone");
        if (phoneCol && row[phoneCol]) {
          record.phone = normalizePhone(row[phoneCol]);
        }

        const emailCol = fieldMap.get("email");
        if (emailCol && row[emailCol]) {
          const email = row[emailCol].trim().toLowerCase();
          if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            record.email = email;
          }
        }

        const dobCol = fieldMap.get("date_of_birth");
        if (dobCol && row[dobCol]) {
          const dob = normalizeDate(row[dobCol]);
          if (dob) record.date_of_birth = dob;
        }

        const genderCol = fieldMap.get("gender");
        if (genderCol && row[genderCol]) {
          const g = row[genderCol].trim().toLowerCase();
          if (g === "m" || g === "masculino") record.gender = "male";
          else if (g === "f" || g === "feminino") record.gender = "female";
          else record.gender = g;
        }

        // Simple text fields
        const textFields = [
          "notes", "zip_code", "street", "street_number", "complement",
          "neighborhood", "city", "state", "allergies", "occupation",
          "emergency_name", "emergency_phone",
        ];
        for (const f of textFields) {
          const col = fieldMap.get(f);
          if (col && row[col]?.trim()) {
            record[f] = row[col].trim();
          }
        }

        records.push(record);
      }

      if (records.length > 0) {
        const { error, data } = await api
          .from("patients")
          .insert(records as never[])
          .select("id");

        if (error) {
          importResult.errors.push(`Erro no lote ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
          importResult.skipped += records.length;
        } else {
          importResult.inserted += data?.length ?? records.length;
        }
      }
    }

    setResult(importResult);
    setStep("result");

    if (importResult.inserted > 0) {
      toast.success(`${importResult.inserted} pacientes importados com sucesso!`);
      onSuccess();
    }
  }, [rows, mappings, profile, patientLimit, currentPatientCount, onSuccess]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            Importar Pacientes via CSV
          </DialogTitle>
          <DialogDescription>
            {step === "upload" && "Envie um arquivo CSV com os dados dos seus pacientes."}
            {step === "mapping" && "Associe as colunas do CSV aos campos do sistema."}
            {step === "preview" && "Verifique os dados antes de importar."}
            {step === "importing" && "Importando pacientes..."}
            {step === "result" && "Resultado da importação."}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-4">
          {(["upload", "mapping", "preview", "result"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold",
                  step === s || (step === "importing" && s === "result")
                    ? "bg-teal-600 text-white"
                    : (["upload", "mapping", "preview", "result"].indexOf(step) > i ||
                        (step === "importing" && i < 3))
                    ? "bg-teal-100 text-teal-700"
                    : "bg-gray-100 text-gray-400"
                )}
              >
                {["upload", "mapping", "preview", "result"].indexOf(step) > i ||
                (step === "importing" && i < 3) ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 3 && <div className="w-8 h-px bg-gray-200" />}
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div
            role="button"
            tabIndex={0}
            className="border-2 border-dashed border-teal-200 rounded-xl p-10 text-center hover:border-teal-400 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInputRef.current?.click(); } }}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="h-12 w-12 text-teal-400 mx-auto mb-4" />
            <p className="text-lg font-medium mb-1">Arraste o arquivo CSV aqui</p>
            <p className="text-sm text-muted-foreground mb-4">
              ou clique para selecionar • Máx. 10 MB, até {MAX_ROWS.toLocaleString()} linhas
            </p>
            <Button variant="outline" className="gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Selecionar Arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Step 2: Column Mapping */}
        {step === "mapping" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {rows.length.toLocaleString()} linhas detectadas • {headers.length} colunas
              </p>
              {!hasNameMapping && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" /> Mapeie a coluna "Nome"
                </Badge>
              )}
            </div>

            <ScrollArea className="h-[360px]">
              <div className="space-y-3">
                {mappings.map((m) => (
                  <div key={m.csvColumn} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{m.csvColumn}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        ex: {rows[0]?.[m.csvColumn] || "—"}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={m.dbField}
                      onValueChange={(v) => updateMapping(m.csvColumn, v)}
                    >
                      <SelectTrigger className="w-56">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__skip__">
                          <span className="text-muted-foreground">— Ignorar —</span>
                        </SelectItem>
                        {DB_FIELDS.map((f) => (
                          <SelectItem
                            key={f.key}
                            value={f.key}
                            disabled={
                              mappings.some(
                                (om) =>
                                  om.dbField === f.key && om.csvColumn !== m.csvColumn
                              )
                            }
                          >
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Voltar
              </Button>
              <Button
                disabled={!hasNameMapping}
                onClick={() => setStep("preview")}
                className="gap-2"
              >
                Próximo
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Pré-visualização dos primeiros 5 registros
              </p>
              <Badge variant="secondary">
                {rows.length.toLocaleString()} total
              </Badge>
            </div>

            <ScrollArea className="max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    {activeMappings.map((m) => (
                      <TableHead key={m.dbField} className="text-xs whitespace-nowrap">
                        {DB_FIELDS.find((f) => f.key === m.dbField)?.label ?? m.dbField}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.map((row, i) => (
                    <TableRow key={i}>
                      {activeMappings.map((m) => (
                        <TableCell key={m.dbField} className="text-xs max-w-[200px] truncate">
                          {row[m.csvColumn] || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {patientLimit !== -1 && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 inline mr-2" />
                Limite do plano: {patientLimit} pacientes. Atualmente: {currentPatientCount}.
                Máximo a importar: {Math.max(0, patientLimit - currentPatientCount)}.
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Voltar
              </Button>
              <Button onClick={handleImport} className="gap-2">
                <Upload className="h-4 w-4" />
                Importar {rows.length.toLocaleString()} pacientes
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-10 w-10 text-teal-600 animate-spin" />
            <p className="text-lg font-medium">Importando pacientes...</p>
            <p className="text-sm text-muted-foreground">Não feche esta janela.</p>
          </div>
        )}

        {/* Step 5: Result */}
        {step === "result" && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-gray-50 border p-4 text-center">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-xs text-muted-foreground">Total no arquivo</p>
              </div>
              <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
                <p className="text-xs text-muted-foreground">Importados</p>
              </div>
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                <XCircle className="h-5 w-5 text-amber-600 mx-auto mb-1" />
                <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
                <p className="text-xs text-muted-foreground">Pulados</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <ScrollArea className="max-h-[160px] rounded-lg border bg-gray-50 p-3">
                <div className="space-y-1">
                  {result.errors.slice(0, 50).map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0 mt-0.5" />
                      {err}
                    </p>
                  ))}
                  {result.errors.length > 50 && (
                    <p className="text-xs text-muted-foreground italic">
                      ...e mais {result.errors.length - 50} avisos
                    </p>
                  )}
                </div>
              </ScrollArea>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
