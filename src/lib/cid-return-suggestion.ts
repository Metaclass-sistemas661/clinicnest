/**
 * CID-based Return Suggestion System
 * Suggests follow-up appointment timing based on diagnosis codes
 */

// CID categories and their typical follow-up intervals (in days)
const CID_RETURN_INTERVALS: Record<string, { min: number; max: number; description: string }> = {
  // Infectious diseases (A00-B99)
  "A": { min: 7, max: 14, description: "Doenças infecciosas - acompanhamento próximo" },
  "B": { min: 7, max: 14, description: "Doenças infecciosas - acompanhamento próximo" },
  
  // Neoplasms (C00-D48)
  "C": { min: 14, max: 30, description: "Neoplasias - acompanhamento oncológico" },
  "D0": { min: 14, max: 30, description: "Neoplasias in situ" },
  "D1": { min: 14, max: 30, description: "Neoplasias benignas" },
  "D2": { min: 14, max: 30, description: "Neoplasias benignas" },
  "D3": { min: 30, max: 60, description: "Neoplasias benignas" },
  "D4": { min: 30, max: 60, description: "Neoplasias comportamento incerto" },
  
  // Blood diseases (D50-D89)
  "D5": { min: 30, max: 60, description: "Anemias - controle laboratorial" },
  "D6": { min: 30, max: 60, description: "Coagulopatias" },
  "D7": { min: 30, max: 90, description: "Doenças do sangue" },
  "D8": { min: 30, max: 90, description: "Imunodeficiências" },
  
  // Endocrine (E00-E90)
  "E0": { min: 30, max: 90, description: "Doenças da tireoide" },
  "E1": { min: 30, max: 90, description: "Diabetes mellitus - controle glicêmico" },
  "E2": { min: 60, max: 90, description: "Desnutrição" },
  "E6": { min: 30, max: 60, description: "Obesidade" },
  "E7": { min: 60, max: 90, description: "Distúrbios metabólicos" },
  
  // Mental disorders (F00-F99)
  "F0": { min: 30, max: 60, description: "Transtornos mentais orgânicos" },
  "F1": { min: 14, max: 30, description: "Transtornos por uso de substâncias" },
  "F2": { min: 14, max: 30, description: "Esquizofrenia - acompanhamento psiquiátrico" },
  "F3": { min: 14, max: 30, description: "Transtornos de humor" },
  "F4": { min: 14, max: 30, description: "Transtornos de ansiedade" },
  "F5": { min: 30, max: 60, description: "Transtornos alimentares/sono" },
  
  // Nervous system (G00-G99)
  "G": { min: 30, max: 90, description: "Doenças do sistema nervoso" },
  "G4": { min: 30, max: 60, description: "Epilepsia/enxaqueca" },
  
  // Eye (H00-H59)
  "H0": { min: 30, max: 90, description: "Doenças do olho" },
  "H1": { min: 30, max: 90, description: "Doenças do olho" },
  "H2": { min: 30, max: 90, description: "Doenças do olho" },
  "H4": { min: 60, max: 180, description: "Glaucoma - controle pressão" },
  
  // Ear (H60-H95)
  "H6": { min: 14, max: 30, description: "Otites" },
  "H7": { min: 14, max: 30, description: "Doenças do ouvido" },
  "H8": { min: 30, max: 60, description: "Doenças do ouvido interno" },
  "H9": { min: 30, max: 60, description: "Perda auditiva" },
  
  // Circulatory (I00-I99)
  "I1": { min: 30, max: 60, description: "Hipertensão - controle pressórico" },
  "I2": { min: 14, max: 30, description: "Cardiopatia isquêmica" },
  "I3": { min: 30, max: 60, description: "Doenças cardíacas" },
  "I4": { min: 14, max: 30, description: "Arritmias" },
  "I5": { min: 14, max: 30, description: "Insuficiência cardíaca" },
  "I6": { min: 14, max: 30, description: "AVC - reabilitação" },
  "I7": { min: 30, max: 60, description: "Doenças vasculares" },
  "I8": { min: 30, max: 90, description: "Varizes/hemorroidas" },
  
  // Respiratory (J00-J99)
  "J0": { min: 7, max: 14, description: "IVAS - verificar resolução" },
  "J1": { min: 7, max: 14, description: "Gripe/pneumonia" },
  "J2": { min: 7, max: 14, description: "Infecções respiratórias" },
  "J3": { min: 14, max: 30, description: "Doenças vias aéreas superiores" },
  "J4": { min: 30, max: 90, description: "Asma/DPOC - controle" },
  
  // Digestive (K00-K93)
  "K": { min: 30, max: 60, description: "Doenças digestivas" },
  "K2": { min: 14, max: 30, description: "Gastrite/úlcera" },
  "K5": { min: 30, max: 60, description: "Doenças intestinais" },
  "K7": { min: 30, max: 60, description: "Doenças hepáticas" },
  
  // Skin (L00-L99)
  "L": { min: 14, max: 30, description: "Doenças de pele" },
  "L2": { min: 14, max: 30, description: "Dermatites" },
  "L4": { min: 30, max: 60, description: "Psoríase/urticária" },
  
  // Musculoskeletal (M00-M99)
  "M": { min: 30, max: 60, description: "Doenças musculoesqueléticas" },
  "M1": { min: 30, max: 60, description: "Artrites" },
  "M5": { min: 14, max: 30, description: "Dorsalgias" },
  "M7": { min: 14, max: 30, description: "Tendinites/bursites" },
  
  // Genitourinary (N00-N99)
  "N": { min: 14, max: 30, description: "Doenças geniturinárias" },
  "N1": { min: 7, max: 14, description: "ITU - verificar cura" },
  "N3": { min: 14, max: 30, description: "Cistite" },
  "N4": { min: 30, max: 60, description: "Doenças próstata" },
  
  // Pregnancy (O00-O99)
  "O": { min: 14, max: 30, description: "Gestação - pré-natal" },
  
  // Perinatal (P00-P96)
  "P": { min: 7, max: 14, description: "Condições perinatais" },
  
  // Congenital (Q00-Q99)
  "Q": { min: 30, max: 90, description: "Malformações congênitas" },
  
  // Symptoms (R00-R99)
  "R": { min: 14, max: 30, description: "Sintomas - investigação" },
  
  // Injuries (S00-T98)
  "S": { min: 7, max: 14, description: "Traumatismos - acompanhamento" },
  "T": { min: 7, max: 14, description: "Traumatismos/intoxicações" },
  
  // External causes (V01-Y98)
  "V": { min: 14, max: 30, description: "Causas externas" },
  "W": { min: 14, max: 30, description: "Causas externas" },
  "X": { min: 14, max: 30, description: "Causas externas" },
  "Y": { min: 14, max: 30, description: "Causas externas" },
  
  // Health factors (Z00-Z99)
  "Z0": { min: 180, max: 365, description: "Exames de rotina" },
  "Z1": { min: 90, max: 180, description: "Fatores de risco" },
  "Z2": { min: 30, max: 90, description: "Procedimentos específicos" },
  "Z3": { min: 14, max: 30, description: "Acompanhamento gestacional" },
};

// Specific CID codes with custom intervals
const SPECIFIC_CID_INTERVALS: Record<string, { min: number; max: number; description: string }> = {
  // Diabetes
  "E10": { min: 30, max: 90, description: "DM tipo 1 - controle glicêmico" },
  "E11": { min: 30, max: 90, description: "DM tipo 2 - controle glicêmico" },
  "E13": { min: 30, max: 90, description: "Outros tipos de DM" },
  
  // Hypertension
  "I10": { min: 30, max: 60, description: "HAS essencial - controle PA" },
  "I11": { min: 30, max: 60, description: "Cardiopatia hipertensiva" },
  "I12": { min: 30, max: 60, description: "Nefropatia hipertensiva" },
  
  // Depression/Anxiety
  "F32": { min: 14, max: 30, description: "Episódio depressivo" },
  "F33": { min: 14, max: 30, description: "Transtorno depressivo recorrente" },
  "F41": { min: 14, max: 30, description: "Transtornos de ansiedade" },
  
  // Asthma
  "J45": { min: 30, max: 90, description: "Asma - controle" },
  "J46": { min: 7, max: 14, description: "Estado de mal asmático" },
  
  // COPD
  "J44": { min: 30, max: 60, description: "DPOC - controle" },
  
  // Heart failure
  "I50": { min: 14, max: 30, description: "Insuficiência cardíaca" },
  
  // Pregnancy routine
  "Z34": { min: 28, max: 35, description: "Supervisão gravidez normal" },
  "Z35": { min: 14, max: 21, description: "Supervisão gravidez alto risco" },
  
  // Post-operative
  "Z48": { min: 7, max: 14, description: "Pós-operatório" },
  
  // Chronic pain
  "R52": { min: 14, max: 30, description: "Dor crônica" },
  
  // UTI
  "N39.0": { min: 7, max: 10, description: "ITU - urocultura controle" },
};

export interface ReturnSuggestion {
  cid_code: string;
  suggested_days_min: number;
  suggested_days_max: number;
  suggested_date_min: Date;
  suggested_date_max: Date;
  reason: string;
  priority: "alta" | "media" | "baixa";
}

/**
 * Get return interval for a CID code
 */
function getIntervalForCid(cidCode: string): { min: number; max: number; description: string } {
  // Normalize CID code
  const code = cidCode.toUpperCase().replace(/[^A-Z0-9.]/g, "");
  
  // Check specific codes first (most specific match)
  if (SPECIFIC_CID_INTERVALS[code]) {
    return SPECIFIC_CID_INTERVALS[code];
  }
  
  // Check code without decimal
  const codeWithoutDecimal = code.split(".")[0];
  if (SPECIFIC_CID_INTERVALS[codeWithoutDecimal]) {
    return SPECIFIC_CID_INTERVALS[codeWithoutDecimal];
  }
  
  // Check first 2 characters
  const prefix2 = code.substring(0, 2);
  if (CID_RETURN_INTERVALS[prefix2]) {
    return CID_RETURN_INTERVALS[prefix2];
  }
  
  // Check first character (category)
  const prefix1 = code.substring(0, 1);
  if (CID_RETURN_INTERVALS[prefix1]) {
    return CID_RETURN_INTERVALS[prefix1];
  }
  
  // Default interval
  return { min: 30, max: 60, description: "Retorno padrão" };
}

/**
 * Suggest return appointment based on CID code
 */
export function suggestReturn(cidCode: string, appointmentDate?: Date): ReturnSuggestion {
  const baseDate = appointmentDate || new Date();
  const interval = getIntervalForCid(cidCode);
  
  const minDate = new Date(baseDate);
  minDate.setDate(minDate.getDate() + interval.min);
  
  const maxDate = new Date(baseDate);
  maxDate.setDate(maxDate.getDate() + interval.max);
  
  // Determine priority based on interval
  let priority: "alta" | "media" | "baixa";
  if (interval.min <= 14) {
    priority = "alta";
  } else if (interval.min <= 30) {
    priority = "media";
  } else {
    priority = "baixa";
  }
  
  return {
    cid_code: cidCode,
    suggested_days_min: interval.min,
    suggested_days_max: interval.max,
    suggested_date_min: minDate,
    suggested_date_max: maxDate,
    reason: interval.description,
    priority,
  };
}

/**
 * Suggest return for multiple CID codes (uses the shortest interval)
 */
export function suggestReturnMultiple(cidCodes: string[], appointmentDate?: Date): ReturnSuggestion {
  if (cidCodes.length === 0) {
    return suggestReturn("Z00", appointmentDate); // Default to routine exam
  }
  
  const suggestions = cidCodes.map((code) => suggestReturn(code, appointmentDate));
  
  // Return the suggestion with the shortest minimum interval (most urgent)
  return suggestions.reduce((prev, curr) =>
    curr.suggested_days_min < prev.suggested_days_min ? curr : prev
  );
}

/**
 * Format suggestion for display
 */
export function formatSuggestion(suggestion: ReturnSuggestion): string {
  const minDateStr = suggestion.suggested_date_min.toLocaleDateString("pt-BR");
  const maxDateStr = suggestion.suggested_date_max.toLocaleDateString("pt-BR");
  
  return `Retorno sugerido: ${suggestion.suggested_days_min}-${suggestion.suggested_days_max} dias (${minDateStr} a ${maxDateStr}). ${suggestion.reason}`;
}

export { CID_RETURN_INTERVALS, SPECIFIC_CID_INTERVALS };
