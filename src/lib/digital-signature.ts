/**
 * Gera hash SHA-256 do conteúdo de um prontuário para assinatura digital.
 * Usa Web Crypto API (disponível em todos os browsers modernos).
 */
export async function generateRecordHash(data: Record<string, unknown>): Promise<string> {
  const ordered = Object.keys(data)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      if (data[key] !== null && data[key] !== undefined && data[key] !== "") {
        acc[key] = data[key];
      }
      return acc;
    }, {});

  const payload = JSON.stringify(ordered);
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(payload));
  const hashArray = Array.from(new Uint8Array(buffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildSignaturePayload(record: {
  chief_complaint?: string;
  anamnesis?: string;
  physical_exam?: string;
  diagnosis?: string;
  cid_code?: string;
  treatment_plan?: string;
  prescriptions?: string;
  notes?: string;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  heart_rate?: number | null;
  temperature?: number | null;
  oxygen_saturation?: number | null;
  allergies?: string;
  current_medications?: string;
  medical_history?: string;
}): Record<string, unknown> {
  return {
    chief_complaint: record.chief_complaint,
    anamnesis: record.anamnesis,
    physical_exam: record.physical_exam,
    diagnosis: record.diagnosis,
    cid_code: record.cid_code,
    treatment_plan: record.treatment_plan,
    prescriptions: record.prescriptions,
    notes: record.notes,
    bp_sys: record.blood_pressure_systolic,
    bp_dia: record.blood_pressure_diastolic,
    hr: record.heart_rate,
    temp: record.temperature,
    spo2: record.oxygen_saturation,
    allergies: record.allergies,
    meds: record.current_medications,
    history: record.medical_history,
  };
}
