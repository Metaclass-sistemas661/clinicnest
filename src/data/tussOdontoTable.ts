/**
 * F13: Tabela TUSS odontológica padrão (offline/fallback)
 * 
 * Mapeamento condição → código TUSS + preço referência.
 * Usado como fallback quando a tabela personalizada do tenant não está disponível.
 * 
 * Preços são valores de referência e NÃO devem ser usados como valores finais.
 */

export interface TussEntry {
  code: string;
  description: string;
  defaultPrice: number;
  category: string;
}

/**
 * Tabela TUSS odontológica completa
 * 
 * Baseada no Rol de Procedimentos e Eventos em Saúde (ANS) e na
 * Terminologia Unificada da Saúde Suplementar para Odontologia.
 * 
 * Categorias cobertas:
 * - Consulta / Urgência
 * - Diagnóstico por Imagem (Radiologia)
 * - Prevenção
 * - Dentística (Restaurações)
 * - Endodontia
 * - Periodontia
 * - Cirurgia
 * - Prótese Dentária
 * - Ortodontia
 * - Implantodontia
 * - Estética
 * - Odontopediatria
 * - DTM / Oclusão
 * - Estomatologia / Patologia Oral
 * - Odontologia do Trabalho / Medicina Oral
 * - Prótese Sobre Implante
 * - Laserterapia
 * 
 * Preços são valores de referência e NÃO devem ser usados como valores finais.
 * Cada clínica deve ajustar seus preços no painel administrativo.
 */
export const TUSS_ODONTO_DEFAULT: TussEntry[] = [
  // ══════════════════════════════════════════════════════════════
  // CONSULTA / URGÊNCIA
  // ══════════════════════════════════════════════════════════════
  { code: "81000065", description: "Consulta odontológica inicial", defaultPrice: 150, category: "Consulta" },
  { code: "81000073", description: "Consulta odontológica de retorno", defaultPrice: 100, category: "Consulta" },
  { code: "81000081", description: "Consulta odontológica para fins de perícia", defaultPrice: 200, category: "Consulta" },
  { code: "81000090", description: "Consulta odontológica de urgência", defaultPrice: 200, category: "Urgência" },
  { code: "81000103", description: "Consulta odontológica para avaliação técnica de procedimento", defaultPrice: 120, category: "Consulta" },
  { code: "81000111", description: "Consulta odontológica de acompanhamento", defaultPrice: 100, category: "Consulta" },
  { code: "81000120", description: "Consulta odontológica domiciliar", defaultPrice: 250, category: "Consulta" },

  // ══════════════════════════════════════════════════════════════
  // DIAGNÓSTICO POR IMAGEM (RADIOLOGIA ODONTOLÓGICA)
  // ══════════════════════════════════════════════════════════════
  { code: "81000200", description: "Radiografia periapical completa (14 filmes)", defaultPrice: 180, category: "Radiologia" },
  { code: "81000219", description: "Radiografia periapical (por filme)", defaultPrice: 40, category: "Radiologia" },
  { code: "81000227", description: "Radiografia panorâmica (ortopantomografia)", defaultPrice: 120, category: "Radiologia" },
  { code: "81000235", description: "Radiografia interproximal (bite-wing)", defaultPrice: 40, category: "Radiologia" },
  { code: "81000243", description: "Radiografia oclusal", defaultPrice: 50, category: "Radiologia" },
  { code: "81000251", description: "Telerradiografia lateral", defaultPrice: 100, category: "Radiologia" },
  { code: "81000260", description: "Telerradiografia frontal (PA)", defaultPrice: 100, category: "Radiologia" },
  { code: "81000278", description: "Tomografia computadorizada de feixe cônico (cone beam) - por arcada", defaultPrice: 350, category: "Radiologia" },
  { code: "81000286", description: "Tomografia computadorizada de feixe cônico (cone beam) - face total", defaultPrice: 500, category: "Radiologia" },
  { code: "81000294", description: "Radiografia da ATM (bilateral)", defaultPrice: 150, category: "Radiologia" },
  { code: "81000308", description: "Documentação ortodôntica completa", defaultPrice: 350, category: "Radiologia" },
  { code: "81000316", description: "Fotografia intraoral (registro digital)", defaultPrice: 50, category: "Radiologia" },
  { code: "81000324", description: "Modelo de estudo (gesso)", defaultPrice: 80, category: "Radiologia" },
  { code: "81000332", description: "Cefalometria (traçado cefalométrico)", defaultPrice: 100, category: "Radiologia" },
  { code: "81000340", description: "Escaneamento intraoral digital", defaultPrice: 200, category: "Radiologia" },

  // ══════════════════════════════════════════════════════════════
  // PREVENÇÃO EM SAÚDE BUCAL
  // ══════════════════════════════════════════════════════════════
  { code: "81100013", description: "Profilaxia / limpeza dental (por arcada)", defaultPrice: 150, category: "Prevenção" },
  { code: "81100021", description: "Aplicação tópica de flúor (por arcada)", defaultPrice: 60, category: "Prevenção" },
  { code: "81100030", description: "Aplicação de selante de fissura (por dente)", defaultPrice: 80, category: "Prevenção" },
  { code: "81100048", description: "Controle de placa bacteriana", defaultPrice: 60, category: "Prevenção" },
  { code: "81100056", description: "Orientação de higiene bucal", defaultPrice: 50, category: "Prevenção" },
  { code: "81100064", description: "Evidenciação de placa bacteriana", defaultPrice: 40, category: "Prevenção" },
  { code: "81100072", description: "Condicionamento em odontologia", defaultPrice: 80, category: "Prevenção" },
  { code: "81100080", description: "Polimento coronário", defaultPrice: 100, category: "Prevenção" },
  { code: "81100099", description: "Aplicação de cariostático (por dente)", defaultPrice: 30, category: "Prevenção" },
  { code: "81100102", description: "Moldeira individual para flúor", defaultPrice: 100, category: "Prevenção" },

  // ══════════════════════════════════════════════════════════════
  // DENTÍSTICA / RESTAURAÇÕES
  // ══════════════════════════════════════════════════════════════
  { code: "82000018", description: "Restauração em ionômero de vidro - 1 face", defaultPrice: 100, category: "Dentística" },
  { code: "82000026", description: "Restauração em ionômero de vidro - 2 ou mais faces", defaultPrice: 150, category: "Dentística" },
  { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180, category: "Dentística" },
  { code: "82000042", description: "Restauração direta em resina composta - 2 faces", defaultPrice: 250, category: "Dentística" },
  { code: "82000050", description: "Restauração direta em resina composta - 3 faces", defaultPrice: 320, category: "Dentística" },
  { code: "82000069", description: "Restauração direta em resina composta - 4 ou mais faces", defaultPrice: 380, category: "Dentística" },
  { code: "82000077", description: "Restauração direta em amálgama - 1 face", defaultPrice: 120, category: "Dentística" },
  { code: "82000085", description: "Restauração direta em amálgama - 2 faces", defaultPrice: 160, category: "Dentística" },
  { code: "82000093", description: "Restauração direta em amálgama - 3 ou mais faces", defaultPrice: 200, category: "Dentística" },
  { code: "82000107", description: "Cimentação de restauração indireta (inlay)", defaultPrice: 250, category: "Dentística" },
  { code: "82000115", description: "Restauração indireta inlay / onlay - cerâmica", defaultPrice: 800, category: "Dentística" },
  { code: "82000123", description: "Restauração indireta inlay / onlay - resina", defaultPrice: 600, category: "Dentística" },
  { code: "82000131", description: "Restauração de dente decíduo com coroa de aço", defaultPrice: 250, category: "Dentística" },
  { code: "82000140", description: "Restauração de dente decíduo com resina - 1 face", defaultPrice: 120, category: "Dentística" },
  { code: "82000158", description: "Restauração de dente decíduo com resina - 2 faces", defaultPrice: 160, category: "Dentística" },
  { code: "82000166", description: "Restauração de dente decíduo com ionômero de vidro", defaultPrice: 100, category: "Dentística" },
  { code: "82000174", description: "Tratamento restaurador atraumático (ART)", defaultPrice: 120, category: "Dentística" },
  { code: "82000182", description: "Núcleo de preenchimento em resina composta", defaultPrice: 200, category: "Dentística" },
  { code: "82000190", description: "Núcleo metálico fundido", defaultPrice: 350, category: "Dentística" },
  { code: "82000204", description: "Pino intrarradicular pré-fabricado", defaultPrice: 200, category: "Dentística" },
  { code: "82000212", description: "Pino de fibra de vidro", defaultPrice: 300, category: "Dentística" },
  { code: "82000220", description: "Ajuste oclusal por desgaste seletivo", defaultPrice: 100, category: "Dentística" },
  { code: "82000239", description: "Colagem de fragmento dental", defaultPrice: 200, category: "Dentística" },
  { code: "82000247", description: "Restauração provisória / temporária", defaultPrice: 80, category: "Dentística" },
  { code: "82000255", description: "Remoção de restauração em amálgama (protocolo de segurança)", defaultPrice: 200, category: "Dentística" },

  // ══════════════════════════════════════════════════════════════
  // ENDODONTIA
  // ══════════════════════════════════════════════════════════════
  { code: "83000014", description: "Tratamento de canal unirradicular (endodontia)", defaultPrice: 600, category: "Endodontia" },
  { code: "83000022", description: "Tratamento de canal birradicular", defaultPrice: 800, category: "Endodontia" },
  { code: "83000030", description: "Tratamento de canal multirradicular (3 ou mais canais)", defaultPrice: 1000, category: "Endodontia" },
  { code: "83000049", description: "Retratamento endodôntico unirradicular", defaultPrice: 700, category: "Endodontia" },
  { code: "83000057", description: "Retratamento endodôntico birradicular", defaultPrice: 900, category: "Endodontia" },
  { code: "83000065", description: "Retratamento endodôntico multirradicular", defaultPrice: 1200, category: "Endodontia" },
  { code: "83000073", description: "Pulpotomia", defaultPrice: 200, category: "Endodontia" },
  { code: "83000081", description: "Pulpectomia (dente decíduo)", defaultPrice: 250, category: "Endodontia" },
  { code: "83000090", description: "Capeamento pulpar direto", defaultPrice: 120, category: "Endodontia" },
  { code: "83000103", description: "Capeamento pulpar indireto", defaultPrice: 100, category: "Endodontia" },
  { code: "83000111", description: "Remoção de corpo estranho do canal radicular", defaultPrice: 350, category: "Endodontia" },
  { code: "83000120", description: "Remoção de instrumento fraturado do canal", defaultPrice: 500, category: "Endodontia" },
  { code: "83000138", description: "Apicectomia unirradicular com obturação retrógrada", defaultPrice: 500, category: "Endodontia" },
  { code: "83000146", description: "Apicectomia birradicular com obturação retrógrada", defaultPrice: 700, category: "Endodontia" },
  { code: "83000154", description: "Apicectomia multirradicular com obturação retrógrada", defaultPrice: 900, category: "Endodontia" },
  { code: "83000162", description: "Apicificação / apicigênese (por sessão)", defaultPrice: 200, category: "Endodontia" },
  { code: "83000170", description: "Curativo de demora (medicação intracanal)", defaultPrice: 100, category: "Endodontia" },
  { code: "83000189", description: "Clareamento interno (dente desvitalizado - por sessão)", defaultPrice: 250, category: "Endodontia" },
  { code: "83000197", description: "Tratamento de perfuração radicular (MTA)", defaultPrice: 400, category: "Endodontia" },
  { code: "83000200", description: "Teste de vitalidade pulpar", defaultPrice: 40, category: "Endodontia" },
  { code: "83000219", description: "Remoção de pino intrarradicular", defaultPrice: 300, category: "Endodontia" },
  { code: "83000227", description: "Drenagem de abscesso dentoalveolar", defaultPrice: 180, category: "Endodontia" },
  { code: "83000235", description: "Tratamento endodôntico em dente com rizogênese incompleta", defaultPrice: 700, category: "Endodontia" },
  { code: "83000243", description: "Microscopia endodôntica (uso de microscópio clínico)", defaultPrice: 300, category: "Endodontia" },

  // ══════════════════════════════════════════════════════════════
  // PERIODONTIA
  // ══════════════════════════════════════════════════════════════
  { code: "84000010", description: "Raspagem supragengival (por hemiarcada)", defaultPrice: 200, category: "Periodontia" },
  { code: "84000028", description: "Raspagem subgengival / alisamento radicular (por hemiarcada)", defaultPrice: 250, category: "Periodontia" },
  { code: "84000036", description: "Raspagem supragengival e subgengival (boca toda)", defaultPrice: 500, category: "Periodontia" },
  { code: "84000044", description: "Cirurgia periodontal a retalho (por sextante)", defaultPrice: 500, category: "Periodontia" },
  { code: "84000052", description: "Gengivectomia (por sextante)", defaultPrice: 400, category: "Periodontia" },
  { code: "84000060", description: "Gengivoplastia (por sextante)", defaultPrice: 400, category: "Periodontia" },
  { code: "84000079", description: "Aumento de coroa clínica (por dente)", defaultPrice: 500, category: "Periodontia" },
  { code: "84000087", description: "Enxerto gengival livre", defaultPrice: 800, category: "Periodontia" },
  { code: "84000095", description: "Enxerto de tecido conjuntivo subepitelial", defaultPrice: 1000, category: "Periodontia" },
  { code: "84000109", description: "Recobrimento radicular (técnica de túnel)", defaultPrice: 900, category: "Periodontia" },
  { code: "84000117", description: "Regeneração tecidual guiada (RTG)", defaultPrice: 1200, category: "Periodontia" },
  { code: "84000125", description: "Enxerto ósseo periodontal", defaultPrice: 800, category: "Periodontia" },
  { code: "84000133", description: "Cunha distal", defaultPrice: 300, category: "Periodontia" },
  { code: "84000141", description: "Contenção periodontal (por arcada)", defaultPrice: 300, category: "Periodontia" },
  { code: "84000150", description: "Frenectomia labial", defaultPrice: 350, category: "Periodontia" },
  { code: "84000168", description: "Frenectomia lingual", defaultPrice: 350, category: "Periodontia" },
  { code: "84000176", description: "Tratamento de abscesso periodontal agudo", defaultPrice: 200, category: "Periodontia" },
  { code: "84000184", description: "Imobilização dental temporária (esplintagem)", defaultPrice: 250, category: "Periodontia" },
  { code: "84000192", description: "Manutenção periodontal (por sessão)", defaultPrice: 200, category: "Periodontia" },
  { code: "84000206", description: "Sondagem periodontal (periograma completo)", defaultPrice: 100, category: "Periodontia" },
  { code: "84000214", description: "Terapia fotodinâmica antimicrobiana periodontal", defaultPrice: 200, category: "Periodontia" },
  { code: "84000222", description: "Aplicação subgengival de antimicrobiano local", defaultPrice: 150, category: "Periodontia" },
  { code: "84000230", description: "Cirurgia de acesso para raspagem (campo aberto)", defaultPrice: 600, category: "Periodontia" },
  { code: "84000249", description: "Proteínas derivadas da matriz do esmalte (Emdogain) - por sextante", defaultPrice: 1500, category: "Periodontia" },

  // ══════════════════════════════════════════════════════════════
  // CIRURGIA BUCOMAXILOFACIAL
  // ══════════════════════════════════════════════════════════════
  { code: "85000016", description: "Exodontia simples (por dente permanente)", defaultPrice: 200, category: "Cirurgia" },
  { code: "85000024", description: "Exodontia simples de dente decíduo", defaultPrice: 120, category: "Cirurgia" },
  { code: "85000032", description: "Exodontia de dente incluso / impactado", defaultPrice: 500, category: "Cirurgia" },
  { code: "85000040", description: "Exodontia de dente semi-incluso", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000059", description: "Exodontia com odontosecção", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000067", description: "Exodontia de raiz residual (resto radicular)", defaultPrice: 250, category: "Cirurgia" },
  { code: "85000075", description: "Exodontia múltipla (por arcada)", defaultPrice: 500, category: "Cirurgia" },
  { code: "85000083", description: "Alveoloplastia (por arcada)", defaultPrice: 350, category: "Cirurgia" },
  { code: "85000091", description: "Remoção de dente supranumerário", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000105", description: "Ulectomia / ulotomia", defaultPrice: 200, category: "Cirurgia" },
  { code: "85000113", description: "Frenectomia (labial ou lingual) cirúrgica", defaultPrice: 350, category: "Cirurgia" },
  { code: "85000121", description: "Reimplante dental", defaultPrice: 350, category: "Cirurgia" },
  { code: "85000130", description: "Transplante dental (autógeno)", defaultPrice: 600, category: "Cirurgia" },
  { code: "85000148", description: "Sutura de ferida bucal (por região)", defaultPrice: 150, category: "Cirurgia" },
  { code: "85000156", description: "Remoção de cisto periapical / odontogênico", defaultPrice: 600, category: "Cirurgia" },
  { code: "85000164", description: "Marsupialização de cisto", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000172", description: "Curetagem periapical", defaultPrice: 300, category: "Cirurgia" },
  { code: "85000180", description: "Incisão e drenagem de abscesso bucal", defaultPrice: 200, category: "Cirurgia" },
  { code: "85000199", description: "Redução de fratura mandibular simples (sem fixação interna)", defaultPrice: 1500, category: "Cirurgia" },
  { code: "85000202", description: "Redução de fratura mandibular com fixação interna rígida", defaultPrice: 3000, category: "Cirurgia" },
  { code: "85000210", description: "Redução de fratura do côndilo mandibular", defaultPrice: 3000, category: "Cirurgia" },
  { code: "85000229", description: "Redução de fratura maxilar (Le Fort)", defaultPrice: 4000, category: "Cirurgia" },
  { code: "85000237", description: "Redução de fratura zigomática", defaultPrice: 2500, category: "Cirurgia" },
  { code: "85000245", description: "Redução de fratura nasal", defaultPrice: 1500, category: "Cirurgia" },
  { code: "85000253", description: "Redução de fratura alveolar", defaultPrice: 800, category: "Cirurgia" },
  { code: "85000261", description: "Remoção de torus palatino", defaultPrice: 600, category: "Cirurgia" },
  { code: "85000270", description: "Remoção de torus mandibular", defaultPrice: 600, category: "Cirurgia" },
  { code: "85000288", description: "Remoção de exostose", defaultPrice: 500, category: "Cirurgia" },
  { code: "85000296", description: "Biópsia de tecido mole da boca", defaultPrice: 300, category: "Cirurgia" },
  { code: "85000300", description: "Biópsia de tecido duro (osso)", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000318", description: "Regularização de rebordo alveolar", defaultPrice: 400, category: "Cirurgia" },
  { code: "85000326", description: "Remoção de mucocele", defaultPrice: 350, category: "Cirurgia" },
  { code: "85000334", description: "Remoção de rânula (sublingual)", defaultPrice: 500, category: "Cirurgia" },
  { code: "85000342", description: "Remoção de cálculo de glândula salivar (sialolitotomia)", defaultPrice: 600, category: "Cirurgia" },
  { code: "85000350", description: "Remoção de tumor odontogênico benigno", defaultPrice: 1000, category: "Cirurgia" },
  { code: "85000369", description: "Artrocentese de ATM", defaultPrice: 800, category: "Cirurgia" },
  { code: "85000377", description: "Artroscopia de ATM", defaultPrice: 2000, category: "Cirurgia" },
  { code: "85000385", description: "Cirurgia ortognática - osteotomia mandibular (sagital bilateral)", defaultPrice: 8000, category: "Cirurgia" },
  { code: "85000393", description: "Cirurgia ortognática - osteotomia maxilar (Le Fort I)", defaultPrice: 8000, category: "Cirurgia" },
  { code: "85000407", description: "Mentoplastia (genioplastia)", defaultPrice: 4000, category: "Cirurgia" },
  { code: "85000415", description: "Enxerto ósseo autógeno (área doadora intraoral)", defaultPrice: 1200, category: "Cirurgia" },
  { code: "85000423", description: "Enxerto ósseo autógeno (área doadora extraoral - crista ilíaca)", defaultPrice: 3000, category: "Cirurgia" },
  { code: "85000431", description: "Enxerto ósseo com biomaterial (substituto ósseo)", defaultPrice: 800, category: "Cirurgia" },
  { code: "85000440", description: "Levantamento de seio maxilar (sinus lift) - acesso lateral", defaultPrice: 2000, category: "Cirurgia" },
  { code: "85000458", description: "Levantamento de seio maxilar (sinus lift) - acesso crestal", defaultPrice: 1500, category: "Cirurgia" },
  { code: "85000466", description: "Expansão de rebordo alveolar", defaultPrice: 1000, category: "Cirurgia" },
  { code: "85000474", description: "Distração osteogênica alveolar", defaultPrice: 2500, category: "Cirurgia" },
  { code: "85000482", description: "Remoção de placa e parafusos de fixação", defaultPrice: 800, category: "Cirurgia" },
  { code: "85000490", description: "Plastia de comunicação buco-sinusal", defaultPrice: 800, category: "Cirurgia" },
  { code: "85000504", description: "Tracionamento de dente incluso (exposição cirúrgica para ortodontia)", defaultPrice: 500, category: "Cirurgia" },

  // ══════════════════════════════════════════════════════════════
  // PRÓTESE DENTÁRIA
  // ══════════════════════════════════════════════════════════════
  { code: "86000012", description: "Coroa total metalocerâmica", defaultPrice: 1200, category: "Prótese" },
  { code: "86000020", description: "Coroa total em cerâmica pura (metal-free)", defaultPrice: 1800, category: "Prótese" },
  { code: "86000039", description: "Coroa total metálica", defaultPrice: 800, category: "Prótese" },
  { code: "86000047", description: "Coroa total em resina acrílica (provisória de longa duração)", defaultPrice: 300, category: "Prótese" },
  { code: "86000055", description: "Coroa provisória em acrílico (por unidade)", defaultPrice: 150, category: "Prótese" },
  { code: "86000063", description: "Prótese parcial fixa metalocerâmica (por elemento)", defaultPrice: 1200, category: "Prótese" },
  { code: "86000071", description: "Prótese parcial fixa em cerâmica pura (por elemento)", defaultPrice: 1800, category: "Prótese" },
  { code: "86000080", description: "Prótese parcial removível com estrutura metálica (PPR)", defaultPrice: 1500, category: "Prótese" },
  { code: "86000098", description: "Prótese parcial removível provisória (PPR acrílica)", defaultPrice: 600, category: "Prótese" },
  { code: "86000101", description: "Prótese total superior (dentadura)", defaultPrice: 2000, category: "Prótese" },
  { code: "86000110", description: "Prótese total inferior (dentadura)", defaultPrice: 2000, category: "Prótese" },
  { code: "86000128", description: "Prótese total imediata", defaultPrice: 2200, category: "Prótese" },
  { code: "86000136", description: "Reembasamento de prótese removível (em consultório)", defaultPrice: 350, category: "Prótese" },
  { code: "86000144", description: "Reembasamento de prótese removível (em laboratório)", defaultPrice: 500, category: "Prótese" },
  { code: "86000152", description: "Conserto de prótese removível (fraturas/adição de dente)", defaultPrice: 200, category: "Prótese" },
  { code: "86000160", description: "Placa miorrelaxante (bruxismo)", defaultPrice: 600, category: "Prótese" },
  { code: "86000179", description: "Placa de clareamento (moldeira silicone)", defaultPrice: 200, category: "Prótese" },
  { code: "86000187", description: "Plano inclinado (aparelho ortopédico funcional)", defaultPrice: 500, category: "Prótese" },
  { code: "86000195", description: "Prótese obturadora (para fissura palatina)", defaultPrice: 2500, category: "Prótese" },
  { code: "86000209", description: "Moldagem funcional com moldeira individual", defaultPrice: 150, category: "Prótese" },
  { code: "86000217", description: "Registro intermaxilar (arco facial)", defaultPrice: 100, category: "Prótese" },
  { code: "86000225", description: "Faceta em resina acrílica sobre metal", defaultPrice: 600, category: "Prótese" },
  { code: "86000233", description: "Bloco/coroa CAD-CAM em cerâmica (por elemento)", defaultPrice: 2000, category: "Prótese" },
  { code: "86000241", description: "Prótese overdenture sobre dentes (barra clipe)", defaultPrice: 3500, category: "Prótese" },
  { code: "86000250", description: "Placa de Hawley (contenção ortodôntica removível)", defaultPrice: 400, category: "Prótese" },

  // ══════════════════════════════════════════════════════════════
  // ORTODONTIA
  // ══════════════════════════════════════════════════════════════
  { code: "87000019", description: "Aparelho ortodôntico fixo metálico (por arcada)", defaultPrice: 1500, category: "Ortodontia" },
  { code: "87000027", description: "Aparelho ortodôntico fixo estético/cerâmico (por arcada)", defaultPrice: 2500, category: "Ortodontia" },
  { code: "87000035", description: "Aparelho ortodôntico fixo autoligado (por arcada)", defaultPrice: 3000, category: "Ortodontia" },
  { code: "87000043", description: "Alinhador transparente (por fase / conjunto)", defaultPrice: 5000, category: "Ortodontia" },
  { code: "87000051", description: "Aparelho ortodôntico removível (por arcada)", defaultPrice: 600, category: "Ortodontia" },
  { code: "87000060", description: "Aparelho ortopédico funcional (Bimler, Bionator, etc.)", defaultPrice: 1200, category: "Ortodontia" },
  { code: "87000078", description: "Manutenção ortodôntica mensal (ajuste/troca de fio)", defaultPrice: 250, category: "Ortodontia" },
  { code: "87000086", description: "Instalação de mini-implante ortodôntico (ancoragem temporária)", defaultPrice: 500, category: "Ortodontia" },
  { code: "87000094", description: "Remoção de mini-implante ortodôntico", defaultPrice: 150, category: "Ortodontia" },
  { code: "87000108", description: "Colagem de bracket / tubo (por unidade)", defaultPrice: 80, category: "Ortodontia" },
  { code: "87000116", description: "Recolagem de bracket descolado", defaultPrice: 80, category: "Ortodontia" },
  { code: "87000124", description: "Remoção de aparelho fixo (por arcada)", defaultPrice: 200, category: "Ortodontia" },
  { code: "87000132", description: "Contenção fixa (barra lingual colada por arcada)", defaultPrice: 300, category: "Ortodontia" },
  { code: "87000140", description: "Contenção removível (placa de Hawley por arcada)", defaultPrice: 400, category: "Ortodontia" },
  { code: "87000159", description: "Disjuntor palatino (expansor rápido da maxila)", defaultPrice: 1200, category: "Ortodontia" },
  { code: "87000167", description: "Arco extra-bucal (AEB / headgear)", defaultPrice: 600, category: "Ortodontia" },
  { code: "87000175", description: "Máscara facial (Petit/Delaire)", defaultPrice: 800, category: "Ortodontia" },
  { code: "87000183", description: "Mantenedor de espaço fixo", defaultPrice: 350, category: "Ortodontia" },
  { code: "87000191", description: "Mantenedor de espaço removível", defaultPrice: 300, category: "Ortodontia" },
  { code: "87000205", description: "Arco lingual / botão de Nance", defaultPrice: 400, category: "Ortodontia" },
  { code: "87000213", description: "Pendulum / Distal Jet (distalização molar)", defaultPrice: 1500, category: "Ortodontia" },
  { code: "87000221", description: "Grade palatina (para sucção digital / interposição lingual)", defaultPrice: 400, category: "Ortodontia" },
  { code: "87000230", description: "Elástico intermaxilar (kit mensal)", defaultPrice: 30, category: "Ortodontia" },
  { code: "87000248", description: "Placa labioativa (lip bumper)", defaultPrice: 500, category: "Ortodontia" },
  { code: "87000256", description: "Aparelho ortodôntico lingual (por arcada)", defaultPrice: 5000, category: "Ortodontia" },

  // ══════════════════════════════════════════════════════════════
  // IMPLANTODONTIA
  // ══════════════════════════════════════════════════════════════
  { code: "88000015", description: "Implante dentário osseointegrado (corpo do implante)", defaultPrice: 3000, category: "Implantodontia" },
  { code: "88000023", description: "Implante dentário osseointegrado - carga imediata", defaultPrice: 4000, category: "Implantodontia" },
  { code: "88000031", description: "Reabertura de implante (segundo tempo cirúrgico)", defaultPrice: 500, category: "Implantodontia" },
  { code: "88000040", description: "Instalação de cicatrizador", defaultPrice: 300, category: "Implantodontia" },
  { code: "88000058", description: "Componente protético / pilar (abutment)", defaultPrice: 800, category: "Implantodontia" },
  { code: "88000066", description: "Pilar personalizado (UCLA / CAD-CAM)", defaultPrice: 1200, category: "Implantodontia" },
  { code: "88000074", description: "Coroa unitária sobre implante - metalocerâmica", defaultPrice: 2000, category: "Implantodontia" },
  { code: "88000082", description: "Coroa unitária sobre implante - cerâmica pura (zircônia)", defaultPrice: 2800, category: "Implantodontia" },
  { code: "88000090", description: "Prótese fixa sobre implantes (protocolo) - por arcada", defaultPrice: 15000, category: "Implantodontia" },
  { code: "88000104", description: "Prótese fixa sobre implantes (protocolo em zircônia) - por arcada", defaultPrice: 25000, category: "Implantodontia" },
  { code: "88000112", description: "Overdenture sobre implantes (protócolo barra clipe - por arcada)", defaultPrice: 8000, category: "Implantodontia" },
  { code: "88000120", description: "Overdenture sobre implantes (o-ring / bola - por arcada)", defaultPrice: 6000, category: "Implantodontia" },
  { code: "88000139", description: "Prótese provisória sobre implante (unitária)", defaultPrice: 400, category: "Implantodontia" },
  { code: "88000147", description: "Prótese provisória sobre implantes (protocolo provisório - arcada)", defaultPrice: 3000, category: "Implantodontia" },
  { code: "88000155", description: "Remoção de implante osseointegrado", defaultPrice: 500, category: "Implantodontia" },
  { code: "88000163", description: "Enxerto ósseo para implante (biomaterial particulado)", defaultPrice: 800, category: "Implantodontia" },
  { code: "88000171", description: "Membrana para regeneração óssea guiada", defaultPrice: 500, category: "Implantodontia" },
  { code: "88000180", description: "Levantamento de seio maxilar para implante - lateral", defaultPrice: 2000, category: "Implantodontia" },
  { code: "88000198", description: "Levantamento de seio maxilar para implante - crestal (atraumático)", defaultPrice: 1500, category: "Implantodontia" },
  { code: "88000201", description: "Guia cirúrgico para implante", defaultPrice: 800, category: "Implantodontia" },
  { code: "88000210", description: "Planejamento virtual (cirurgia guiada por computador)", defaultPrice: 1200, category: "Implantodontia" },
  { code: "88000228", description: "Carga imediata com prótese provisória (All-on-4 / All-on-6)", defaultPrice: 20000, category: "Implantodontia" },
  { code: "88000236", description: "Implante zigomático (por unidade)", defaultPrice: 8000, category: "Implantodontia" },
  { code: "88000244", description: "Manutenção de prótese sobre implante (aperto de parafuso, ajuste)", defaultPrice: 200, category: "Implantodontia" },

  // ══════════════════════════════════════════════════════════════
  // ESTÉTICA DENTAL
  // ══════════════════════════════════════════════════════════════
  { code: "89000011", description: "Clareamento dental de consultório (por sessão)", defaultPrice: 800, category: "Estética" },
  { code: "89000020", description: "Clareamento dental caseiro (kit completo com moldeiras)", defaultPrice: 500, category: "Estética" },
  { code: "89000038", description: "Faceta direta em resina composta (por dente)", defaultPrice: 400, category: "Estética" },
  { code: "89000046", description: "Faceta direta em resina com ensaio estético (mock-up + faceta)", defaultPrice: 600, category: "Estética" },
  { code: "89000054", description: "Faceta indireta em cerâmica / porcelana (laminado - por dente)", defaultPrice: 1500, category: "Estética" },
  { code: "89000062", description: "Lente de contato dental (laminado ultrafino - por dente)", defaultPrice: 2000, category: "Estética" },
  { code: "89000070", description: "Gengivoplastia estética / harmonização do sorriso gengival (laser)", defaultPrice: 500, category: "Estética" },
  { code: "89000089", description: "Ensaio restaurador (mock-up / wax-up diagnóstico)", defaultPrice: 300, category: "Estética" },
  { code: "89000097", description: "Reanatomização dental em resina (por dente)", defaultPrice: 250, category: "Estética" },
  { code: "89000100", description: "Aplicação de toxina botulínica perioral (harmonização orofacial)", defaultPrice: 1200, category: "Estética" },
  { code: "89000119", description: "Preenchimento com ácido hialurônico perioral (harmonização orofacial)", defaultPrice: 1500, category: "Estética" },
  { code: "89000127", description: "Bichectomia (remoção de bola de Bichat)", defaultPrice: 2000, category: "Estética" },
  { code: "89000135", description: "Peeling perioral", defaultPrice: 400, category: "Estética" },
  { code: "89000143", description: "Microagulhamento perioral", defaultPrice: 500, category: "Estética" },

  // ══════════════════════════════════════════════════════════════
  // ODONTOPEDIATRIA
  // ══════════════════════════════════════════════════════════════
  { code: "90000015", description: "Pulpotomia em dente decíduo", defaultPrice: 200, category: "Odontopediatria" },
  { code: "90000023", description: "Pulpectomia em dente decíduo", defaultPrice: 250, category: "Odontopediatria" },
  { code: "90000031", description: "Exodontia de dente decíduo", defaultPrice: 120, category: "Odontopediatria" },
  { code: "90000040", description: "Mantenedor de espaço fixo (banda-alça)", defaultPrice: 350, category: "Odontopediatria" },
  { code: "90000058", description: "Mantenedor de espaço removível", defaultPrice: 300, category: "Odontopediatria" },
  { code: "90000066", description: "Coroa de aço em dente decíduo", defaultPrice: 250, category: "Odontopediatria" },
  { code: "90000074", description: "Coroa de celulóide em dente decíduo", defaultPrice: 200, category: "Odontopediatria" },
  { code: "90000082", description: "Restauração em dente decíduo com resina", defaultPrice: 120, category: "Odontopediatria" },
  { code: "90000090", description: "Restauração em dente decíduo com ionômero de vidro", defaultPrice: 100, category: "Odontopediatria" },
  { code: "90000104", description: "Aplicação tópica de flúor em criança", defaultPrice: 60, category: "Odontopediatria" },
  { code: "90000112", description: "Selante de fissuras em dente decíduo ou permanente jovem", defaultPrice: 80, category: "Odontopediatria" },
  { code: "90000120", description: "Tratamento restaurador atraumático (ART) em decíduo", defaultPrice: 100, category: "Odontopediatria" },
  { code: "90000139", description: "Adequação de meio bucal em criança (múltiplos ART)", defaultPrice: 200, category: "Odontopediatria" },
  { code: "90000147", description: "Condicionamento de comportamento (por sessão)", defaultPrice: 80, category: "Odontopediatria" },
  { code: "90000155", description: "Sedação consciente com óxido nitroso (por sessão)", defaultPrice: 300, category: "Odontopediatria" },
  { code: "90000163", description: "Tratamento sob anestesia geral (taxa hospitalar excluída)", defaultPrice: 2000, category: "Odontopediatria" },

  // ══════════════════════════════════════════════════════════════
  // DTM / OCLUSÃO / DOR OROFACIAL
  // ══════════════════════════════════════════════════════════════
  { code: "91000011", description: "Placa miorrelaxante (placa oclusal estabilizadora)", defaultPrice: 600, category: "DTM/Oclusão" },
  { code: "91000020", description: "Placa reposicionadora (para DTM)", defaultPrice: 700, category: "DTM/Oclusão" },
  { code: "91000038", description: "Ajuste oclusal por desgaste seletivo (sessão)", defaultPrice: 200, category: "DTM/Oclusão" },
  { code: "91000046", description: "Ajuste oclusal por acréscimo (overlay)", defaultPrice: 400, category: "DTM/Oclusão" },
  { code: "91000054", description: "Montagem em articulador semi-ajustável", defaultPrice: 150, category: "DTM/Oclusão" },
  { code: "91000062", description: "Desprogramação neuromuscular (JIG / Lucia)", defaultPrice: 100, category: "DTM/Oclusão" },
  { code: "91000070", description: "Aplicação de toxina botulínica para bruxismo / DTM", defaultPrice: 1200, category: "DTM/Oclusão" },
  { code: "91000089", description: "Infiltração de ATM com ácido hialurônico (viscossuplementação)", defaultPrice: 1000, category: "DTM/Oclusão" },
  { code: "91000097", description: "Fisioterapia orofacial orientada pelo dentista (por sessão)", defaultPrice: 150, category: "DTM/Oclusão" },
  { code: "91000100", description: "Eletromiografia de superfície (diagnóstico)", defaultPrice: 300, category: "DTM/Oclusão" },
  { code: "91000119", description: "Análise oclusal computadorizada (T-Scan)", defaultPrice: 400, category: "DTM/Oclusão" },

  // ══════════════════════════════════════════════════════════════
  // ESTOMATOLOGIA / PATOLOGIA ORAL / MEDICINA ORAL
  // ══════════════════════════════════════════════════════════════
  { code: "92000017", description: "Biópsia incisional de lesão oral", defaultPrice: 300, category: "Estomatologia" },
  { code: "92000025", description: "Biópsia excisional de lesão oral", defaultPrice: 400, category: "Estomatologia" },
  { code: "92000033", description: "Citologia esfoliativa oral", defaultPrice: 150, category: "Estomatologia" },
  { code: "92000041", description: "Exame estomatológico para rastreio de câncer bucal", defaultPrice: 100, category: "Estomatologia" },
  { code: "92000050", description: "Remoção de lesão de tecido mole (papiloma, fibroma, etc.)", defaultPrice: 350, category: "Estomatologia" },
  { code: "92000068", description: "Remoção de lesão de mucosa por laser", defaultPrice: 400, category: "Estomatologia" },
  { code: "92000076", description: "Tratamento de lesão aftosa / herpes (laser de baixa potência)", defaultPrice: 150, category: "Estomatologia" },
  { code: "92000084", description: "Tratamento de parestesia / neuralgia trigeminal (laser)", defaultPrice: 200, category: "Estomatologia" },
  { code: "92000092", description: "Tratamento de xerostomia (boca seca) - por sessão", defaultPrice: 150, category: "Estomatologia" },
  { code: "92000106", description: "Exame salivar (sialometria)", defaultPrice: 100, category: "Estomatologia" },
  { code: "92000114", description: "Teste microbiológico oral (cultura bacteriana/fúngica)", defaultPrice: 200, category: "Estomatologia" },
  { code: "92000122", description: "Diascopia oral (diagnóstico de lesão vascular)", defaultPrice: 50, category: "Estomatologia" },

  // ══════════════════════════════════════════════════════════════
  // LASERTERAPIA ODONTOLÓGICA
  // ══════════════════════════════════════════════════════════════
  { code: "93000013", description: "Laserterapia de baixa potência (por sessão / região)", defaultPrice: 100, category: "Laserterapia" },
  { code: "93000021", description: "Laserterapia pós-cirúrgica (bioestimulação)", defaultPrice: 100, category: "Laserterapia" },
  { code: "93000030", description: "Laserterapia para mucosite oral", defaultPrice: 150, category: "Laserterapia" },
  { code: "93000048", description: "Laserterapia para hipersensibilidade dentinária (por sessão)", defaultPrice: 100, category: "Laserterapia" },
  { code: "93000056", description: "Terapia fotodinâmica antimicrobiana (PDT)", defaultPrice: 200, category: "Laserterapia" },
  { code: "93000064", description: "Frenectomia a laser", defaultPrice: 500, category: "Laserterapia" },
  { code: "93000072", description: "Gengivectomia / gengivoplastia a laser", defaultPrice: 500, category: "Laserterapia" },
  { code: "93000080", description: "Descontaminação periodontal a laser (por sextante)", defaultPrice: 200, category: "Laserterapia" },
  { code: "93000099", description: "Clareamento dental assistido por laser (por sessão)", defaultPrice: 1000, category: "Laserterapia" },
  { code: "93000102", description: "Remoção de lesão oral a laser (fibroma, papiloma)", defaultPrice: 400, category: "Laserterapia" },

  // ══════════════════════════════════════════════════════════════
  // ODONTOLOGIA DO TRABALHO / LEGAL / FORENSE
  // ══════════════════════════════════════════════════════════════
  { code: "94000010", description: "Exame odontológico admissional", defaultPrice: 80, category: "Odontologia do Trabalho" },
  { code: "94000028", description: "Exame odontológico periódico (rotina)", defaultPrice: 60, category: "Odontologia do Trabalho" },
  { code: "94000036", description: "Exame odontológico demissional", defaultPrice: 80, category: "Odontologia do Trabalho" },
  { code: "94000044", description: "Exame odontológico para mudança de função", defaultPrice: 80, category: "Odontologia do Trabalho" },
  { code: "94000052", description: "Exame odontológico de retorno ao trabalho", defaultPrice: 80, category: "Odontologia do Trabalho" },
  { code: "94000060", description: "Laudo / atestado odontológico", defaultPrice: 50, category: "Odontologia do Trabalho" },
  { code: "94000079", description: "Perícia odontológica (para fins jurídicos)", defaultPrice: 500, category: "Odontologia do Trabalho" },
  { code: "94000087", description: "Confecção de protetor bucal esportivo personalizado", defaultPrice: 300, category: "Odontologia do Trabalho" },
  { code: "94000095", description: "Moldagem para protetor auricular (silicone)", defaultPrice: 150, category: "Odontologia do Trabalho" },

  // ══════════════════════════════════════════════════════════════
  // SEDAÇÃO E ANESTESIA
  // ══════════════════════════════════════════════════════════════
  { code: "95000016", description: "Anestesia local (por procedimento)", defaultPrice: 30, category: "Anestesia" },
  { code: "95000024", description: "Anestesia tópica (gel/spray)", defaultPrice: 15, category: "Anestesia" },
  { code: "95000032", description: "Sedação consciente com óxido nitroso", defaultPrice: 300, category: "Anestesia" },
  { code: "95000040", description: "Sedação consciente oral (via medicamentosa)", defaultPrice: 400, category: "Anestesia" },
  { code: "95000059", description: "Sedação endovenosa (acompanhamento anestesista)", defaultPrice: 1500, category: "Anestesia" },
  { code: "95000067", description: "Anestesia geral para procedimento odontológico", defaultPrice: 2500, category: "Anestesia" },

  // ══════════════════════════════════════════════════════════════
  // OUTROS / DIVERSOS
  // ══════════════════════════════════════════════════════════════
  { code: "99000012", description: "Moldagem de estudo (alginato por arcada)", defaultPrice: 50, category: "Outros" },
  { code: "99000020", description: "Moldagem com silicone de adição (por arcada)", defaultPrice: 120, category: "Outros" },
  { code: "99000039", description: "Planejamento digital do sorriso (DSD)", defaultPrice: 500, category: "Outros" },
  { code: "99000047", description: "Enceramento diagnóstico (wax-up - por arcada)", defaultPrice: 300, category: "Outros" },
  { code: "99000055", description: "Cimentação de peça protética", defaultPrice: 100, category: "Outros" },
  { code: "99000063", description: "Remoção de cimento / excesso de material", defaultPrice: 50, category: "Outros" },
  { code: "99000071", description: "Dessensibilização dentinária (por sessão)", defaultPrice: 80, category: "Outros" },
  { code: "99000080", description: "Aplicação de verniz fluoretado (por sessão)", defaultPrice: 60, category: "Outros" },
  { code: "99000098", description: "Teste alérgico a materiais odontológicos", defaultPrice: 150, category: "Outros" },
  { code: "99000101", description: "Imobilização dental com fibra de vidro (por dente)", defaultPrice: 300, category: "Outros" },
  { code: "99000110", description: "Remoção de corpo estranho da cavidade bucal", defaultPrice: 150, category: "Outros" },
  { code: "99000128", description: "Irrigação de alvéolo (tratamento de alveolite)", defaultPrice: 100, category: "Outros" },
  { code: "99000136", description: "Tamponamento de alvéolo", defaultPrice: 100, category: "Outros" },
  { code: "99000144", description: "Jateamento com bicarbonato (profilaxia a jato)", defaultPrice: 200, category: "Outros" },
];

/**
 * Mapeamento condição do odontograma → código TUSS sugerido
 * Usado ao gerar plano de tratamento automaticamente.
 * Cada condição aponta para o procedimento mais provável.
 */
export const CONDITION_TUSS_MAP: Record<string, { code: string; description: string; defaultPrice: number }> = {
  caries:       { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  fracture:     { code: "82000050", description: "Restauração direta em resina composta - 3 faces", defaultPrice: 320 },
  extraction:   { code: "85000016", description: "Exodontia simples (por dente permanente)", defaultPrice: 200 },
  abscess:      { code: "83000227", description: "Drenagem de abscesso dentoalveolar", defaultPrice: 180 },
  periapical:   { code: "83000014", description: "Tratamento de canal unirradicular (endodontia)", defaultPrice: 600 },
  root_remnant: { code: "85000067", description: "Exodontia de raiz residual (resto radicular)", defaultPrice: 250 },
  resorption:   { code: "83000014", description: "Tratamento de canal unirradicular (endodontia)", defaultPrice: 600 },
  fistula:      { code: "83000014", description: "Tratamento de canal unirradicular (endodontia)", defaultPrice: 600 },
  mobility:     { code: "84000184", description: "Imobilização dental temporária (esplintagem)", defaultPrice: 250 },
  recession:    { code: "84000109", description: "Recobrimento radicular (técnica de túnel)", defaultPrice: 900 },
  erosion:      { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  abrasion:     { code: "82000034", description: "Restauração direta em resina composta - 1 face", defaultPrice: 180 },
  temporary:    { code: "82000042", description: "Restauração direta em resina composta - 2 faces", defaultPrice: 250 },
  impacted:     { code: "85000032", description: "Exodontia de dente incluso / impactado", defaultPrice: 500 },
  supernumerary:{ code: "85000091", description: "Remoção de dente supranumerário", defaultPrice: 400 },
  agenesis:     { code: "88000015", description: "Implante dentário osseointegrado (corpo do implante)", defaultPrice: 3000 },
  crown:        { code: "86000020", description: "Coroa total em cerâmica pura (metal-free)", defaultPrice: 1800 },
  bridge:       { code: "86000063", description: "Prótese parcial fixa metalocerâmica (por elemento)", defaultPrice: 1200 },
  implant:      { code: "88000244", description: "Manutenção de prótese sobre implante (aperto de parafuso, ajuste)", defaultPrice: 200 },
  filling:      { code: "82000042", description: "Restauração direta em resina composta - 2 faces", defaultPrice: 250 },
  veneer:       { code: "89000054", description: "Faceta indireta em cerâmica / porcelana (laminado - por dente)", defaultPrice: 1500 },
  sealant:      { code: "81100030", description: "Aplicação de selante de fissura (por dente)", defaultPrice: 80 },
  endodontic:   { code: "83000030", description: "Tratamento de canal multirradicular (3 ou mais canais)", defaultPrice: 1000 },
};

/**
 * Busca preço TUSS baseado na condição do dente.
 * Se o tenant tiver preços customizados, usa esses; caso contrário usa o padrão.
 */
export function getTussPrice(
  condition: string,
  tenantPrices?: Map<string, number>,
): { code: string; description: string; price: number } | null {
  const mapping = CONDITION_TUSS_MAP[condition];
  if (!mapping) return null;

  const customPrice = tenantPrices?.get(mapping.code);
  return {
    code: mapping.code,
    description: mapping.description,
    price: customPrice ?? mapping.defaultPrice,
  };
}
