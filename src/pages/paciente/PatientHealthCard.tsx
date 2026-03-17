import { useState, useEffect, useRef, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CreditCard,
  Download,
  QrCode,
  Heart,
  Droplet,
  AlertTriangle,
  Pill,
  Shield,
  User,
  Phone,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface HealthCardData {
  name: string;
  cpf: string | null;
  date_of_birth: string | null;
  blood_type: string | null;
  allergies: string | null;
  phone: string | null;
  insurance_plan_name: string | null;
  insurance_card_number: string | null;
  emergency_conditions: string[];
  current_medications: string[];
  tenant_name: string | null;
}

function maskCpf(cpf: string | null): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.*${digits.slice(8, 9)}*-${digits.slice(9)}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return "—";
  }
}

export default function PatientHealthCard() {
  const [data, setData] = useState<HealthCardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabasePatient
        .from("patient_profiles" as never)
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!profile) return;
      const pp = profile as { client_id: string; tenant_id: string };

      // Fetch patient + tenant in parallel
      const [patientRes, tenantRes] = await Promise.all([
        supabasePatient
          .from("patients" as never)
          .select("name, cpf, date_of_birth, blood_type, allergies, phone, insurance_plan_id, insurance_card_number")
          .eq("id", pp.client_id)
          .single(),
        supabasePatient
          .from("tenants" as never)
          .select("name")
          .eq("id", pp.tenant_id)
          .single(),
      ]);

      const p = patientRes.data as {
        name: string; cpf: string | null; date_of_birth: string | null;
        blood_type: string | null; allergies: string | null; phone: string | null;
        insurance_plan_id: string | null; insurance_card_number: string | null;
      } | null;

      if (!p) return;

      // Fetch insurance plan name if exists
      let insuranceName: string | null = null;
      if (p.insurance_plan_id) {
        const { data: plan } = await supabasePatient
          .from("insurance_plans" as never)
          .select("name")
          .eq("id", p.insurance_plan_id)
          .single();
        insuranceName = (plan as { name: string } | null)?.name || null;
      }

      // Fetch recent prescriptions for current medications
      const { data: recentRx } = await supabasePatient
        .from("prescriptions" as never)
        .select("medications")
        .eq("patient_id", pp.client_id)
        .order("created_at", { ascending: false })
        .limit(1);

      const meds: string[] = [];
      if (recentRx?.[0]) {
        const rx = recentRx[0] as { medications: string | null };
        if (rx.medications) {
          rx.medications.split(/[;\n]/).forEach((m: string) => {
            const t = m.trim();
            if (t) meds.push(t);
          });
        }
      }

      const tenantName = (tenantRes.data as { name: string } | null)?.name || null;

      const cardData: HealthCardData = {
        name: p.name,
        cpf: p.cpf,
        date_of_birth: p.date_of_birth,
        blood_type: p.blood_type,
        allergies: p.allergies,
        phone: p.phone,
        insurance_plan_name: insuranceName,
        insurance_card_number: p.insurance_card_number,
        emergency_conditions: [],
        current_medications: meds.slice(0, 5),
        tenant_name: tenantName,
      };

      setData(cardData);

      // Generate QR code with essential emergency data
      const qrPayload = JSON.stringify({
        n: p.name,
        bt: p.blood_type || "?",
        al: p.allergies || "Nenhuma",
        ph: p.phone || "",
        ins: insuranceName || "",
      });
      const url = await QRCode.toDataURL(qrPayload, {
        width: 200,
        margin: 1,
        color: { dark: "#0D9488", light: "#FFFFFF" },
      });
      setQrDataUrl(url);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const { default: html2canvas } = await import("html2canvas");
      const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true });
      const link = document.createElement("a");
      link.download = "cartao-saude.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch {
      // Fallback: print
      window.print();
    }
  };

  if (isLoading) {
    return (
      <PatientLayout title="Cartão Virtual de Saúde">
        <div className="max-w-md mx-auto">
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      </PatientLayout>
    );
  }

  if (!data) {
    return (
      <PatientLayout title="Cartão Virtual de Saúde">
        <p className="text-center text-muted-foreground">Dados não disponíveis.</p>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Cartão Virtual de Saúde" subtitle="Apresente em emergências ou consultas externas">
      <div className="max-w-md mx-auto space-y-4">
        {/* Card */}
        <div
          ref={cardRef}
          className="rounded-2xl overflow-hidden shadow-xl bg-gradient-to-br from-teal-600 to-teal-800 text-white p-6 space-y-4"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-6 w-6" />
              <div>
                <p className="text-xs opacity-80">Cartão de Saúde</p>
                <p className="font-bold text-lg leading-tight">{data.name}</p>
              </div>
            </div>
            {qrDataUrl && (
              <img src={qrDataUrl} alt="QR Code" className="h-16 w-16 rounded" />
            )}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs opacity-70">CPF</p>
              <p className="font-medium">{maskCpf(data.cpf)}</p>
            </div>
            <div>
              <p className="text-xs opacity-70">Nascimento</p>
              <p className="font-medium">{formatDate(data.date_of_birth)}</p>
            </div>
            {data.blood_type && (
              <div className="flex items-center gap-1">
                <Droplet className="h-4 w-4 text-red-300" />
                <div>
                  <p className="text-xs opacity-70">Tipo Sanguíneo</p>
                  <p className="font-bold text-lg">{data.blood_type}</p>
                </div>
              </div>
            )}
            {data.phone && (
              <div className="flex items-center gap-1">
                <Phone className="h-4 w-4 opacity-70" />
                <div>
                  <p className="text-xs opacity-70">Telefone</p>
                  <p className="font-medium">{data.phone}</p>
                </div>
              </div>
            )}
          </div>

          {/* Allergies */}
          {data.allergies && (
            <div className="bg-red-500/20 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-red-300 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-200">ALERGIAS</p>
                <p className="text-sm">{data.allergies}</p>
              </div>
            </div>
          )}

          {/* Medications */}
          {data.current_medications.length > 0 && (
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs font-medium opacity-80 flex items-center gap-1 mb-1">
                <Pill className="h-3 w-3" /> MEDICAMENTOS EM USO
              </p>
              <ul className="text-xs space-y-0.5">
                {data.current_medications.map((m, i) => (
                  <li key={i} className="truncate">• {m}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Insurance */}
          {data.insurance_plan_name && (
            <div className="flex items-center gap-2 bg-white/10 rounded-lg p-2 text-sm">
              <Shield className="h-4 w-4 opacity-80" />
              <div>
                <p className="text-xs opacity-70">Convênio</p>
                <p className="font-medium">{data.insurance_plan_name}</p>
                {data.insurance_card_number && (
                  <p className="text-xs opacity-80">Carteira: {data.insurance_card_number}</p>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="pt-2 border-t border-white/20 flex items-center justify-between text-xs opacity-60">
            <span>{data.tenant_name || "ClinicNest"}</span>
            <span>Válido: {new Date().toLocaleDateString("pt-BR")}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={downloadCard} className="flex-1 gap-2" variant="outline">
            <Download className="h-4 w-4" />
            Salvar Imagem
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Apresente o QR Code em situações de emergência. O profissional de saúde poderá
          escanear para ver suas informações essenciais (alergias, tipo sanguíneo, medicamentos).
        </p>
      </div>
    </PatientLayout>
  );
}
