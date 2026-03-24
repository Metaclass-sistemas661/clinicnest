import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  IdCard,
  AlertTriangle,
  Pencil,
  X,
  Loader2,
  Save,
  ShieldCheck,
  Heart,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PatientData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  cpf: string | null;
  date_of_birth: string | null;
  marital_status: string | null;
  zip_code: string | null;
  street: string | null;
  street_number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  allergies: string | null;
}

const MARITAL_OPTIONS = [
  { value: "", label: "Não informado" },
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União Estável" },
];

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

function InfoRow({
  icon: Icon,
  label,
  value,
  badge,
}: {
  icon: React.ElementType;
  label: string;
  value: string | null | undefined;
  badge?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 flex-shrink-0 mt-0.5">
        <Icon className="h-4 w-4 text-teal-600 dark:text-teal-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {badge && value ? (
          <Badge variant="destructive" className="gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            {value}
          </Badge>
        ) : (
          <p className="text-sm font-medium text-foreground">
            {value || "Não informado"}
          </p>
        )}
      </div>
    </div>
  );
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9)
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export default function PatientProfile() {
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editZipCode, setEditZipCode] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editStreetNumber, setEditStreetNumber] = useState("");
  const [editComplement, setEditComplement] = useState("");
  const [editNeighborhood, setEditNeighborhood] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editState, setEditState] = useState("");

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabasePatient.auth.getUser();
      if (!user) return;

      // Usa RPC SECURITY DEFINER — sem depender de RLS direta na tabela patients
      const { data, error } = await (supabasePatient as any).rpc("get_patient_profile");

      if (error) {
        console.error("[PatientProfile] Erro no RPC get_patient_profile:", error);
        throw error;
      }

      // RPC retorna jsonb com os dados ou { error: "..." }
      if (data && !data.error) {
        setPatient({
          id: data.id,
          name: data.name || user.user_metadata?.full_name || "Paciente",
          email: data.email ?? user.email ?? null,
          phone: data.phone ?? null,
          cpf: data.cpf ?? null,
          date_of_birth: data.date_of_birth ?? null,
          marital_status: data.marital_status ?? null,
          zip_code: data.zip_code ?? null,
          street: data.street ?? null,
          street_number: data.street_number ?? null,
          complement: data.complement ?? null,
          neighborhood: data.neighborhood ?? null,
          city: data.city ?? null,
          state: data.state ?? null,
          allergies: data.allergies ?? null,
        });
      } else {
        // Sem link ativo — fallback para dados do auth
        console.warn("[PatientProfile] No patient link found, using auth metadata");
        setPatient({
          id: user.id,
          name: user.user_metadata?.full_name ?? "Paciente",
          email: user.email ?? null,
          phone: user.user_metadata?.phone ?? null,
          cpf: null,
          date_of_birth: null,
          marital_status: null,
          zip_code: null,
          street: null,
          street_number: null,
          complement: null,
          neighborhood: null,
          city: null,
          state: null,
          allergies: null,
        });
      }
    } catch {
      toast.error("Erro ao carregar perfil");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const startEditing = () => {
    if (!patient) return;
    setEditPhone(patient.phone ?? "");
    setEditEmail(patient.email ?? "");
    setEditZipCode(patient.zip_code ?? "");
    setEditStreet(patient.street ?? "");
    setEditStreetNumber(patient.street_number ?? "");
    setEditComplement(patient.complement ?? "");
    setEditNeighborhood(patient.neighborhood ?? "");
    setEditCity(patient.city ?? "");
    setEditState(patient.state ?? "");
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!patient) return;
    setIsSaving(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("update_patient_contact", {
        p_phone: editPhone.replace(/\D/g, "") || null,
        p_email: editEmail.trim() || null,
        p_zip_code: editZipCode.replace(/\D/g, "") || null,
        p_street: editStreet.trim() || null,
        p_street_number: editStreetNumber.trim() || null,
        p_complement: editComplement.trim() || null,
        p_neighborhood: editNeighborhood.trim() || null,
        p_city: editCity.trim() || null,
        p_state: editState.trim().toUpperCase() || null,
      });

      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "UPDATE_FAILED");

      toast.success("Dados atualizados com sucesso!");
      setIsEditing(false);
      fetchProfile();
    } catch (err) {
      console.error("[PatientProfile] Erro ao salvar:", err);
      toast.error("Erro ao salvar", { description: normalizeError(err, "Tente novamente ou entre em contato com a clínica.") });
    } finally {
      setIsSaving(false);
    }
  };

  const formattedBirth = patient?.date_of_birth
    ? (() => {
        try {
          return format(parseISO(patient.date_of_birth), "dd 'de' MMMM 'de' yyyy", {
            locale: ptBR,
          });
        } catch {
          return patient.date_of_birth;
        }
      })()
    : null;

  const formattedAddress = patient
    ? [
        patient.street,
        patient.street_number,
        patient.complement,
        patient.neighborhood,
        patient.city && patient.state
          ? `${patient.city} - ${patient.state}`
          : patient.city || patient.state,
        patient.zip_code
          ? `CEP ${patient.zip_code.replace(/^(\d{5})(\d{3})$/, "$1-$2")}`
          : null,
      ]
        .filter(Boolean)
        .join(", ") || null
    : null;

  const maritalLabel =
    MARITAL_OPTIONS.find((o) => o.value === patient?.marital_status)?.label ??
    patient?.marital_status;

  return (
    <PatientLayout title="Meu Perfil" subtitle="Seus dados pessoais e informações clínicas">
      <div className="w-full space-y-6">
        {/* Avatar + name header */}
        <Card>
          <CardContent className="py-6 px-5">
            {isLoading ? (
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-2xl" />
                <div className="space-y-2">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900 flex-shrink-0">
                  <User className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-foreground truncate">
                    {patient?.name ?? "Paciente"}
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="outline"
                      className="gap-1 text-xs text-teal-600 border-teal-200 dark:text-teal-400 dark:border-teal-800"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Paciente verificado
                    </Badge>
                  </div>
                </div>
                {!isEditing && !isLoading && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs flex-shrink-0"
                    onClick={startEditing}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Editar contato
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Edit form — full width */}
        {isEditing && (
          <Card className="border-teal-200 dark:border-teal-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Pencil className="h-4 w-4 text-teal-600" />
                  Editar Dados de Contato
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={cancelEditing}
                    disabled={isSaving}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    className="gap-1 text-xs bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Spinner size="sm" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    Salvar alterações
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Contato */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Contato
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Telefone</Label>
                    <Input
                      value={formatPhone(editPhone)}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="(11) 99999-9999"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">E-mail</Label>
                    <Input
                      type="email"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="h-10"
                    />
                  </div>
                </div>
              </div>

              {/* Endereço */}
              <div className="border-t pt-5">
                <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
                  Endereço
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">CEP</Label>
                    <Input
                      value={formatZipCode(editZipCode)}
                      onChange={(e) => setEditZipCode(e.target.value)}
                      placeholder="00000-000"
                      maxLength={9}
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-1 lg:col-span-3">
                    <Label className="text-xs font-medium">Rua / Logradouro</Label>
                    <Input
                      value={editStreet}
                      onChange={(e) => setEditStreet(e.target.value)}
                      placeholder="Nome da rua"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Número</Label>
                    <Input
                      value={editStreetNumber}
                      onChange={(e) => setEditStreetNumber(e.target.value)}
                      placeholder="123"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Complemento</Label>
                    <Input
                      value={editComplement}
                      onChange={(e) => setEditComplement(e.target.value)}
                      placeholder="Apto 12"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Bairro</Label>
                    <Input
                      value={editNeighborhood}
                      onChange={(e) => setEditNeighborhood(e.target.value)}
                      placeholder="Bairro"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Cidade</Label>
                    <Input
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      placeholder="Cidade"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Estado</Label>
                    <Select value={editState.toUpperCase()} onValueChange={setEditState}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {BRAZILIAN_STATES.map((uf) => (
                          <SelectItem key={uf} value={uf}>
                            {uf}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Info note */}
              <p className="text-xs text-muted-foreground border-t pt-4">
                Você pode alterar telefone, e-mail e endereço. CPF, data de nascimento e dados
                clínicos só podem ser alterados pela equipe da clínica.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Dados pessoais — read only view */}
        {!isEditing && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Dados Pessoais</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : (
                <div>
                  <InfoRow icon={IdCard} label="CPF" value={patient?.cpf ? formatCpf(patient.cpf) : null} />
                  <InfoRow icon={Phone} label="Telefone" value={patient?.phone ? formatPhone(patient.phone) : null} />
                  <InfoRow icon={Mail} label="E-mail" value={patient?.email} />
                  <InfoRow icon={Calendar} label="Data de Nascimento" value={formattedBirth} />
                  <InfoRow icon={Heart} label="Estado Civil" value={maritalLabel} />
                  <InfoRow icon={MapPin} label="Endereço" value={formattedAddress} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Informações clínicas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Informações Clínicas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-14 w-full" />
            ) : (
              <InfoRow
                icon={AlertTriangle}
                label="Alergias"
                value={patient?.allergies}
                badge={!!patient?.allergies}
              />
            )}
            <p className="text-xs text-muted-foreground mt-3">
              Informações clínicas são gerenciadas pela equipe da clínica. Entre em contato caso precise atualizar.
            </p>
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
