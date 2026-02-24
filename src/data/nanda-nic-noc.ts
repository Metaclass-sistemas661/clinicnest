export interface NandaDiagnosis {
  code: string;
  label: string;
  domain: string;
}

export interface NicIntervention {
  code: string;
  label: string;
  class: string;
}

export interface NocOutcome {
  code: string;
  label: string;
  class: string;
}

export const NANDA_DIAGNOSES: NandaDiagnosis[] = [
  // Domínio 1 — Promoção da Saúde
  { code: "00097", label: "Atividade de recreação deficiente", domain: "Promoção da Saúde" },
  { code: "00168", label: "Estilo de vida sedentário", domain: "Promoção da Saúde" },
  { code: "00257", label: "Síndrome do idoso frágil", domain: "Promoção da Saúde" },
  // Domínio 2 — Nutrição
  { code: "00002", label: "Nutrição desequilibrada: menos que as necessidades corporais", domain: "Nutrição" },
  { code: "00001", label: "Nutrição desequilibrada: mais que as necessidades corporais", domain: "Nutrição" },
  { code: "00025", label: "Risco de volume de líquidos desequilibrado", domain: "Nutrição" },
  { code: "00026", label: "Volume de líquidos excessivo", domain: "Nutrição" },
  { code: "00027", label: "Volume de líquidos deficiente", domain: "Nutrição" },
  { code: "00179", label: "Risco de glicemia instável", domain: "Nutrição" },
  { code: "00195", label: "Risco de desequilíbrio eletrolítico", domain: "Nutrição" },
  // Domínio 3 — Eliminação e Troca
  { code: "00016", label: "Eliminação urinária prejudicada", domain: "Eliminação" },
  { code: "00013", label: "Diarreia", domain: "Eliminação" },
  { code: "00011", label: "Constipação", domain: "Eliminação" },
  { code: "00023", label: "Retenção urinária", domain: "Eliminação" },
  { code: "00030", label: "Troca de gases prejudicada", domain: "Eliminação" },
  // Domínio 4 — Atividade/Repouso
  { code: "00092", label: "Intolerância à atividade", domain: "Atividade/Repouso" },
  { code: "00095", label: "Padrão de sono perturbado", domain: "Atividade/Repouso" },
  { code: "00198", label: "Insônia", domain: "Atividade/Repouso" },
  { code: "00085", label: "Mobilidade física prejudicada", domain: "Atividade/Repouso" },
  { code: "00091", label: "Mobilidade no leito prejudicada", domain: "Atividade/Repouso" },
  { code: "00088", label: "Deambulação prejudicada", domain: "Atividade/Repouso" },
  { code: "00029", label: "Débito cardíaco diminuído", domain: "Atividade/Repouso" },
  { code: "00032", label: "Padrão respiratório ineficaz", domain: "Atividade/Repouso" },
  { code: "00204", label: "Perfusão tissular periférica ineficaz", domain: "Atividade/Repouso" },
  // Domínio 5 — Percepção/Cognição
  { code: "00128", label: "Confusão aguda", domain: "Percepção/Cognição" },
  { code: "00129", label: "Confusão crônica", domain: "Percepção/Cognição" },
  { code: "00051", label: "Comunicação verbal prejudicada", domain: "Percepção/Cognição" },
  // Domínio 6 — Autopercepção
  { code: "00118", label: "Distúrbio da imagem corporal", domain: "Autopercepção" },
  { code: "00119", label: "Baixa autoestima crônica", domain: "Autopercepção" },
  { code: "00120", label: "Baixa autoestima situacional", domain: "Autopercepção" },
  // Domínio 7 — Papéis e Relacionamentos
  { code: "00052", label: "Interação social prejudicada", domain: "Papéis e Relacionamentos" },
  { code: "00062", label: "Risco de tensão do papel de cuidador", domain: "Papéis e Relacionamentos" },
  // Domínio 9 — Enfrentamento/Tolerância ao Estresse
  { code: "00146", label: "Ansiedade", domain: "Enfrentamento" },
  { code: "00148", label: "Medo", domain: "Enfrentamento" },
  { code: "00069", label: "Enfrentamento ineficaz", domain: "Enfrentamento" },
  { code: "00136", label: "Pesar", domain: "Enfrentamento" },
  { code: "00147", label: "Ansiedade relacionada à morte", domain: "Enfrentamento" },
  // Domínio 11 — Segurança/Proteção
  { code: "00004", label: "Risco de infecção", domain: "Segurança/Proteção" },
  { code: "00046", label: "Integridade da pele prejudicada", domain: "Segurança/Proteção" },
  { code: "00047", label: "Risco de integridade da pele prejudicada", domain: "Segurança/Proteção" },
  { code: "00044", label: "Integridade tissular prejudicada", domain: "Segurança/Proteção" },
  { code: "00035", label: "Risco de lesão", domain: "Segurança/Proteção" },
  { code: "00155", label: "Risco de quedas", domain: "Segurança/Proteção" },
  { code: "00031", label: "Desobstrução ineficaz de vias aéreas", domain: "Segurança/Proteção" },
  { code: "00039", label: "Risco de aspiração", domain: "Segurança/Proteção" },
  { code: "00205", label: "Risco de choque", domain: "Segurança/Proteção" },
  { code: "00007", label: "Hipertermia", domain: "Segurança/Proteção" },
  { code: "00006", label: "Hipotermia", domain: "Segurança/Proteção" },
  { code: "00048", label: "Dentição prejudicada", domain: "Segurança/Proteção" },
  // Domínio 12 — Conforto
  { code: "00132", label: "Dor aguda", domain: "Conforto" },
  { code: "00133", label: "Dor crônica", domain: "Conforto" },
  { code: "00134", label: "Náusea", domain: "Conforto" },
  { code: "00214", label: "Conforto prejudicado", domain: "Conforto" },
];

export const NIC_INTERVENTIONS: NicIntervention[] = [
  // Fisiológico Básico
  { code: "1400", label: "Controle da dor", class: "Controle de Sintomas" },
  { code: "2210", label: "Administração de analgésicos", class: "Controle de Medicamentos" },
  { code: "2300", label: "Administração de medicamentos", class: "Controle de Medicamentos" },
  { code: "2314", label: "Administração de medicamentos: intravenosa", class: "Controle de Medicamentos" },
  { code: "2380", label: "Assistência no uso de medicamentos", class: "Controle de Medicamentos" },
  { code: "1100", label: "Controle da nutrição", class: "Suporte Nutricional" },
  { code: "1803", label: "Assistência no autocuidado: alimentação", class: "Facilitação Autocuidado" },
  { code: "1801", label: "Assistência no autocuidado: banho/higiene", class: "Facilitação Autocuidado" },
  { code: "1802", label: "Assistência no autocuidado: vestir-se", class: "Facilitação Autocuidado" },
  { code: "1804", label: "Assistência no autocuidado: higiene íntima", class: "Facilitação Autocuidado" },
  { code: "0840", label: "Posicionamento", class: "Controle de Atividade" },
  { code: "0180", label: "Controle de energia", class: "Controle de Atividade" },
  { code: "0200", label: "Promoção de exercícios", class: "Controle de Atividade" },
  { code: "0580", label: "Cateterização vesical", class: "Eliminação" },
  { code: "0590", label: "Controle da eliminação urinária", class: "Eliminação" },
  { code: "0450", label: "Controle da constipação/impactação", class: "Eliminação" },
  { code: "1850", label: "Melhora do sono", class: "Controle de Atividade" },
  // Fisiológico Complexo
  { code: "3320", label: "Oxigenoterapia", class: "Controle Respiratório" },
  { code: "3140", label: "Controle de vias aéreas", class: "Controle Respiratório" },
  { code: "3160", label: "Aspiração de vias aéreas", class: "Controle Respiratório" },
  { code: "3350", label: "Monitorização respiratória", class: "Controle Respiratório" },
  { code: "4040", label: "Cuidados cardíacos", class: "Controle Cardiovascular" },
  { code: "4120", label: "Controle de líquidos", class: "Equilíbrio Hidroeletrolítico" },
  { code: "4200", label: "Terapia intravenosa", class: "Equilíbrio Hidroeletrolítico" },
  { code: "3590", label: "Vigilância da pele", class: "Controle Tegumentar" },
  { code: "3660", label: "Cuidados com lesões", class: "Controle Tegumentar" },
  { code: "3440", label: "Cuidados com local de incisão", class: "Controle Tegumentar" },
  { code: "6540", label: "Controle de infecção", class: "Controle de Riscos" },
  { code: "6550", label: "Proteção contra infecção", class: "Controle de Riscos" },
  { code: "6490", label: "Prevenção de quedas", class: "Controle de Riscos" },
  { code: "3900", label: "Regulação da temperatura", class: "Termorregulação" },
  // Comportamental
  { code: "5820", label: "Redução da ansiedade", class: "Assistência Emocional" },
  { code: "5880", label: "Técnica para acalmar", class: "Assistência Emocional" },
  { code: "5270", label: "Apoio emocional", class: "Assistência Emocional" },
  { code: "5230", label: "Aumento do enfrentamento", class: "Assistência Emocional" },
  { code: "5602", label: "Ensino: processo de doença", class: "Educação" },
  { code: "5616", label: "Ensino: medicamentos prescritos", class: "Educação" },
];

export const NOC_OUTCOMES: NocOutcome[] = [
  // Saúde Funcional
  { code: "0200", label: "Deambulação", class: "Mobilidade" },
  { code: "0208", label: "Mobilidade", class: "Mobilidade" },
  { code: "0005", label: "Tolerância à atividade", class: "Mobilidade" },
  { code: "0300", label: "Autocuidado: atividades da vida diária", class: "Autocuidado" },
  { code: "0301", label: "Autocuidado: banho", class: "Autocuidado" },
  { code: "0303", label: "Autocuidado: alimentação", class: "Autocuidado" },
  { code: "0305", label: "Autocuidado: higiene", class: "Autocuidado" },
  // Saúde Fisiológica
  { code: "2102", label: "Nível de dor", class: "Sintomas" },
  { code: "1605", label: "Controle da dor", class: "Sintomas" },
  { code: "2107", label: "Gravidade da náusea e vômito", class: "Sintomas" },
  { code: "0004", label: "Sono", class: "Sintomas" },
  { code: "0802", label: "Sinais vitais", class: "Regulação Fisiológica" },
  { code: "0600", label: "Equilíbrio eletrolítico e ácido-base", class: "Regulação Fisiológica" },
  { code: "0601", label: "Equilíbrio hídrico", class: "Regulação Fisiológica" },
  { code: "0800", label: "Termorregulação", class: "Regulação Fisiológica" },
  { code: "0410", label: "Estado respiratório: permeabilidade de vias aéreas", class: "Cardiopulmonar" },
  { code: "0402", label: "Estado respiratório: troca gasosa", class: "Cardiopulmonar" },
  { code: "0400", label: "Estado respiratório: ventilação", class: "Cardiopulmonar" },
  { code: "0401", label: "Estado circulatório", class: "Cardiopulmonar" },
  { code: "0405", label: "Perfusão tissular: periférica", class: "Cardiopulmonar" },
  { code: "1101", label: "Integridade tissular: pele e mucosas", class: "Integridade Tissular" },
  { code: "1102", label: "Cicatrização de feridas: primeira intenção", class: "Integridade Tissular" },
  { code: "1103", label: "Cicatrização de feridas: segunda intenção", class: "Integridade Tissular" },
  { code: "1004", label: "Estado nutricional", class: "Nutrição" },
  { code: "1008", label: "Estado nutricional: ingestão alimentar", class: "Nutrição" },
  { code: "0500", label: "Continência urinária", class: "Eliminação" },
  { code: "0501", label: "Eliminação intestinal", class: "Eliminação" },
  // Saúde Psicossocial
  { code: "1211", label: "Nível de ansiedade", class: "Bem-Estar Psicossocial" },
  { code: "1210", label: "Nível de medo", class: "Bem-Estar Psicossocial" },
  { code: "1302", label: "Enfrentamento", class: "Bem-Estar Psicossocial" },
  { code: "1205", label: "Autoestima", class: "Bem-Estar Psicossocial" },
  { code: "1902", label: "Controle de riscos", class: "Segurança" },
  { code: "1908", label: "Detecção de riscos", class: "Segurança" },
];
