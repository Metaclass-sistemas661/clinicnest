# RELATÓRIO EXAUSTIVO — MÓDULO DE ODONTOLOGIA
**Sistema:** ClinicaFlow  
**Data:** 06 de março de 2026  
**Escopo:** Análise completa do fluxo, arquitetura, componentes, banco de dados, erros e recomendações

---

## ÍNDICE

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Mapa Completo de Arquivos](#2-mapa-completo-de-arquivos)
3. [Fluxo de Dados Completo](#3-fluxo-de-dados-completo)
4. [Componentes Frontend — Análise Detalhada](#4-componentes-frontend)
5. [Banco de Dados — Tabelas e Migrações](#5-banco-de-dados)
6. [RPCs (Funções Supabase)](#6-rpcs-funções-supabase)
7. [Políticas de Segurança (RLS)](#7-políticas-de-segurança-rls)
8. [Erros Identificados](#8-erros-identificados)
9. [Problemas de Arquitetura](#9-problemas-de-arquitetura)
10. [Recomendações de Correção](#10-recomendações-de-correção)

---

## 1. VISÃO GERAL DA ARQUITETURA

O módulo de odontologia é composto por **5 submódulos** integrados:

| Submódulo | Descrição | Página | Rota |
|-----------|-----------|--------|------|
| **Odontograma** | Mapa dental interativo com 5 faces por dente | `Odontograma.tsx` | `/odontograma` |
| **Periograma** | Ficha periodontal com 6 sítios por dente | `Periograma.tsx` | `/periograma` |
| **OdontogramaEmbed** | Widget compacto embutido no prontuário | `OdontogramaEmbed.tsx` | Tab em `/prontuario/:id` |
| **DentalImagesGallery** | Galeria de imagens intraorais e radiografias | `DentalImagesGallery.tsx` | Tab em `/prontuario/:id` |
| **Planos de Tratamento** | Plano de tratamento gerado a partir do odontograma | `PlanosTratamento.tsx` | `/planos-tratamento` |

### Diagrama de dependência:
```
ProntuarioDetalhe.tsx
 ├── OdontogramaEmbed.tsx
 │    ├── OdontogramChart.tsx
 │    │    └── ToothDiagram.tsx
 │    └── ToothEditDialog.tsx
 └── DentalImagesGallery.tsx

Odontograma.tsx (página standalone)
 ├── OdontogramChart.tsx
 │    └── ToothDiagram.tsx
 ├── ToothEditDialog.tsx
 └── odontogramPdf.ts (geração PDF)

Periograma.tsx (página standalone)
 ├── Periograma.tsx (componente interno)
 └── periogramPdf.ts (geração PDF)

PlanosTratamento.tsx → gerado pelo Odontograma
```

---

## 2. MAPA COMPLETO DE ARQUIVOS

### Componentes Core (`src/components/odontograma/`)
| Arquivo | LOC | Função |
|---------|-----|--------|
| `odontogramConstants.ts` | ~170 | Constantes: 33 condições dentárias, numeração FDI, faces, materiais, graus de mobilidade, prioridades |
| `OdontogramChart.tsx` | ~270 | Gráfico visual do odontograma completo (arcada superior/inferior, legenda, stats) |
| `ToothDiagram.tsx` | ~260 | SVG interativo de dente individual com 5 faces clicáveis |
| `ToothEditDialog.tsx` | ~350 | Sheet/Drawer lateral para edição de condição, faces, mobilidade, prioridade, material |
| `Periograma.tsx` | ~1015 | Componente completo do periograma (6 sítios por dente, índices periodontais) |

### Componentes Prontuário (`src/components/prontuario/`)
| Arquivo | LOC | Função |
|---------|-----|--------|
| `OdontogramaEmbed.tsx` | ~290 | Widget compacto do odontograma para embedding no prontuário |
| `DentalImagesGallery.tsx` | ~600+ | Galeria de fotos intraorais e radiografias com upload/viewer |

### Páginas (`src/pages/`)
| Arquivo | LOC | Função |
|---------|-----|--------|
| `Odontograma.tsx` | ~921 | Página principal: seleção de paciente, histórico, comparação, plano de tratamento |
| `Periograma.tsx` | ~607 | Página do periograma: seleção de paciente, medições, histórico |
| `ProntuarioDetalhe.tsx` | ~618 | Detalhe do prontuário com tabs (inclui Odontograma + DentalImages) |
| `PlanosTratamento.tsx` | ~? | Página de planos de tratamento |

### Utilitários (`src/utils/`)
| Arquivo | Função |
|---------|--------|
| `odontogramPdf.ts` | Geração de PDF A4 paisagem com mapa dental, tabela, legenda e stats |
| `periogramPdf.ts` | Geração de PDF do periograma |

### Migrações Supabase (`supabase/migrations/`)
| Arquivo | Fase | Descrição |
|---------|------|-----------|
| `20260325000001_odontograms_v1.sql` | 25A | Tabelas core: `odontograms`, `odontogram_teeth` + RPCs + RLS |
| `20260304000001_odontogram_v2_expansion.sql` | — | Expansão: 33 condições, face, mobilidade, prioridade, surfaces, annotations |
| `20260304000000_fix_odontogram_patient_id.sql` | Fix | Corrige `client_id` → `patient_id` nas RPCs e views |
| `20260330300000_rename_clients_to_patients_v1.sql` | 44 | Renomeia tabela `clients` → `patients` e colunas `client_id` → `patient_id` |
| `20260325100001_treatment_plans_v1.sql` | 25C | Planos de tratamento: `treatment_plans`, `treatment_plan_items` |

---

## 3. FLUXO DE DADOS COMPLETO

### 3.1 Fluxo: Criar/Editar Odontograma (Página Principal)

```
1. Usuário busca paciente → query "patients" table (Supabase)
2. Seleciona paciente → RPC "get_client_odontograms(tenant_id, patient_id)"
   ↓ retorna lista de odontogramas com contagem de dentes
3. Carrega último odontograma → RPC "get_odontogram_teeth(odontogram_id)"
   ↓ retorna array de dentes com condition, surfaces, notes, mobility_grade, priority
4. Monta Map<number, ToothRecord> no state React
5. Renderiza OdontogramChart → ToothDiagram (32 dentes adulto / 20 decíduos / 52 misto)
6. Clique no dente → abre ToothEditDialog (Sheet lateral)
7. Edita condição/faces/mobilidade/prioridade → salva no state local (Map)
8. Clique "Salvar" → RPC "create_odontogram_with_teeth(tenant, patient, professional, teeth[])"
   ↓ cria NOVO registro de odontograma (imutável, versionado)
9. Reload do histórico
```

### 3.2 Fluxo: Odontograma Embed (Prontuário)

```
1. ProntuarioDetalhe carrega record.patient_id
2. Passa tenantId, patientId, professionalId para OdontogramaEmbed
3. OdontogramaEmbed chama RPC "get_client_odontograms" 
4. Carrega o último odontograma automaticamente
5. Edição limitada (modo compacto)
6. Salva via RPC "create_odontogram_with_teeth"
```

### 3.3 Fluxo: Comparação de Versões

```
1. historyEntries[] contém todas as versões ordenadas por data DESC
2. Usuário clica "Comparar" → carrega dentes da versão anterior
3. Calcula diff: condições que mudaram entre versões
4. Renderiza dois OdontogramCharts lado a lado + tabela de diferenças
```

### 3.4 Fluxo: Gerar Plano de Tratamento

```
1. Filtra dentes com condições "tratáveis" (caries, fracture, extraction, etc.)
2. Abre dialog com checkboxes para selecionar quais dentes incluir
3. Mapeia condição → procedimento sugerido (CONDITION_PROCEDURE_MAP)
4. INSERT em treatment_plans + treatment_plan_items
5. Navega para /planos-tratamento
```

### 3.5 Fluxo: Periograma

```
1. Busca paciente → query "patients"
2. Carrega periogramas → RPC 
3. Exibe tabela 32 dentes × 6 sítios → mede depth/recession/bleeding/plaque/suppuration
4. Calcula NIC, índices de placa, sangramento, profundidade média
5. Salva via RPC dedicado
6. Exporta PDF via periogramPdf.ts
```

### 3.6 Fluxo: Imagens Odontológicas

```
1. ProntuarioDetalhe → DentalImagesGallery
2. Upload para Supabase Storage (bucket)
3. Metadados: tipo (intraoral/radiografia), dentes associados, notas clínicas
4. Visualização com zoom/rotação
```

---

## 4. COMPONENTES FRONTEND — ANÁLISE DETALHADA

### 4.1 `odontogramConstants.ts`
- **33 condições dentárias** organizadas em 5 categorias: status (6), pathology (11), treatment (4), prosthetic (6), anomaly (5) + extraction
- **Numeração FDI** completa: permanentes (11-48) e decíduos (51-85)
- **3 tipos de dentição**: permanent (32 dentes), deciduous (20 dentes), mixed (52 dentes)
- **Faces por dente**: V, L/P, M, D, O/I — diferencia dentes anteriores vs posteriores, superiores vs inferiores
- **Materiais de restauração**: 8 tipos (resina, amálgama, cerâmica, ionômero, ouro, zircônia, metálica, provisório)
- **Graus de mobilidade**: 0-3 (firme, leve <1mm, moderada 1-2mm, severa >2mm)
- **Prioridades**: normal, low, high, urgent

### 4.2 `ToothDiagram.tsx`
- Renderiza SVG com 5 polígonos (faces) clicáveis independentemente
- Suporte a condições especiais: missing (X tracejado), impacted/unerupted (círculo tracejado)
- Símbolos visuais: endodontia (linha diagonal), coroa (círculo), implante (retângulo vertical), extração (X branco), ponte (linha horizontal)
- Indicadores: prioridade (círculo colorido canto superior direito), mobilidade (círculo com número canto inferior esquerdo)
- Modo compacto (44px) vs completo (56px)

### 4.3 `OdontogramChart.tsx`
- Renderiza arcadas superior e inferior usando arrays de ToothDiagram
- Suporte a dentição mista: separa permanentes e decíduos visualmente
- Toggle de dentição (ToggleGroup)
- Estatísticas: contagem de cáries, ausentes, restaurados, urgentes, com mobilidade
- Legenda filtrada por condições em uso, agrupada por categoria

### 4.4 `ToothEditDialog.tsx`
- Sheet/Drawer lateral (padrão brasileiro de software odontológico)
- 3 tabs: Condição, Faces, Detalhes
- Tab Condição: lista todos os 33 condições agrupadas por categoria com cor
- Tab Faces: botões interativos para V/L/P/M/D/O/I + seletor de material (condicional)
- Tab Detalhes: mobilidade (ToggleGroup 0-3), prioridade, data do procedimento, observações
- Warning visual para prioridade urgente

### 4.5 `OdontogramaEmbed.tsx`
- Versão compacta para prontuário: OdontogramChart em modo compact
- Carrega automaticamente o último odontograma do paciente
- Tabela de registros inline com condição/faces/obs
- Botão "Completo" → link para /odontograma (página full)
- Tracking de dirty state (alterações não salvas)

### 4.6 `Periograma.tsx` (componente)
- Tabela interativa com 32 dentes × 6 sítios (MV, V, DV, ML, L, DL)
- Campos: profundidade de sondagem, recessão, sangramento, supuração, placa
- NIC calculado automaticamente (profundidade + recessão)
- Mobilidade (0-3) e furca (0-3) por dente
- Cor por profundidade: verde ≤3mm, amarelo 4-5mm, vermelho ≥6mm
- Índices calculados: % placa, % sangramento, profundidade média
- Diagnóstico periodontal e classificação de risco
- Histórico e exportação PDF

---

## 5. BANCO DE DADOS — TABELAS E MIGRAÇÕES

### 5.1 Tabela `odontograms`
```sql
id              UUID PK
tenant_id       UUID FK → tenants(id)
patient_id      UUID FK → patients(id)  -- renomeado de client_id
professional_id UUID FK → profiles(id)
appointment_id  UUID FK → appointments(id) -- nullable
exam_date       DATE
notes           TEXT
dentition_type  TEXT ('permanent'|'deciduous'|'mixed')
digital_hash    TEXT
signed_at       TIMESTAMPTZ
signed_by_name  TEXT
signed_by_crm   TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### 5.2 Tabela `odontogram_teeth`
```sql
id              UUID PK
odontogram_id   UUID FK → odontograms(id)
tooth_number    INTEGER (11-48, 51-85)
condition       TEXT (33 valores possíveis)
surfaces        TEXT
notes           TEXT
procedure_date  DATE
mobility_grade  INTEGER (0-3, nullable)
priority        TEXT ('normal'|'low'|'high'|'urgent')
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
UNIQUE(odontogram_id, tooth_number)
```

### 5.3 Tabela `odontogram_tooth_surfaces` (v2)
```sql
id                  UUID PK
odontogram_tooth_id UUID FK → odontogram_teeth(id)
surface             TEXT ('V'|'L'|'M'|'D'|'O'|'I'|'P'|'C')
condition           TEXT
material            TEXT
color_shade         TEXT
notes               TEXT
UNIQUE(odontogram_tooth_id, surface)
```

### 5.4 Tabela `odontogram_annotations` (v2)
```sql
id              UUID PK
odontogram_id   UUID FK → odontograms(id)
annotation_type TEXT ('note'|'alert'|'treatment_note'|'prognosis'|'referral'|'contraindication')
content         TEXT
tooth_number    INTEGER (nullable)
created_by      UUID FK → profiles(id)
```

### 5.5 Tabela `treatment_plans`
```sql
id              UUID PK
tenant_id       UUID FK → tenants(id)
client_id       UUID FK → clients(id)  ⚠️ PROBLEMA: usa client_id, não patient_id
professional_id UUID FK → profiles(id)
odontogram_id   UUID FK → odontograms(id)
title           TEXT
description     TEXT
status          TEXT ('pendente'|'apresentado'|'aprovado'|'em_andamento'|'concluido'|'cancelado')
total_value     DECIMAL(12,2)
discount_percent/discount_value/final_value
payment_conditions, installments
approved_at, approved_by_client, client_signature
valid_until     DATE
```

### 5.6 Tabela `treatment_plan_items`
```sql
id              UUID PK
plan_id         UUID FK → treatment_plans(id)
tooth_number    INTEGER
surface         TEXT
procedure_code  TEXT
procedure_name  TEXT
unit_price/quantity/total_price  DECIMAL
status          TEXT
scheduled_date, appointment_id, completed_at, completed_by
notes, sort_order
```

---

## 6. RPCs (FUNÇÕES SUPABASE)

| RPC | Parâmetros | Retorno | Uso |
|-----|-----------|---------|-----|
| `create_odontogram_with_teeth` | tenant_id, client_id, professional_id, appointment_id, exam_date, notes, teeth(JSONB) | UUID (id) | Criar odontograma + dentes em transação |
| `get_client_odontograms` | tenant_id, client_id | TABLE(id, exam_date, notes, professional_name, tooth_count, created_at) | Listar odontogramas do paciente |
| `get_odontogram_teeth` | odontogram_id | TABLE(tooth_number, condition, surfaces, notes, procedure_date, mobility_grade, priority) | Buscar dentes de um odontograma |
| `upsert_odontogram_teeth` | odontogram_id, teeth(JSONB) | VOID | Upsert de dentes (replace all) |
| `update_odontogram_inline` | odontogram_id, notes, teeth(JSONB) | VOID | Edição in-place com upsert |
| `get_tooth_evolution` | tenant_id, patient_id, tooth_number | TABLE(odontogram_id, exam_date, ...) | Histórico de um dente específico |
| `compare_odontograms` | id_1, id_2 | TABLE(..., changed) | Diff entre dois odontogramas |
| `get_odontogram_stats` | tenant_id, patient_id | JSONB | Estatísticas gerais |
| `is_dentist` | user_id | BOOLEAN | Verifica se é dentista |
| `is_clinical_professional` | user_id | BOOLEAN | Verifica se é profissional clínico |

---

## 7. POLÍTICAS DE SEGURANÇA (RLS)

### `odontograms`
- **SELECT**: tenant admin + profissional clínico (qualquer tipo)
- **INSERT**: tenant admin + dentista apenas
- **UPDATE**: tenant admin + dentista apenas (mesmo tenant)
- **DELETE**: tenant admin apenas

### `odontogram_teeth`  
- Herda do pai `odontograms` via subquery JOIN
- Mesmas regras: SELECT clínico, INSERT/UPDATE dentista, DELETE admin

### `odontogram_tooth_surfaces`
- Herda de `odontogram_teeth` → `odontograms` via double JOIN

### `odontogram_annotations`
- SELECT: qualquer profissional do tenant
- INSERT: admin + dentista
- DELETE: admin apenas

### Proteção de rota
- Rota `/odontograma` protegida por `<ProtectedRoute resource="odontograma">`
- Rota `/periograma` protegida por `<ProtectedRoute resource="periograma">`
- Tab Odontograma no prontuário condicionada a `isDentist`

---

## 8. ERROS IDENTIFICADOS

### 🔴 CRÍTICO — Erros que causam falha em runtime

#### 8.1 RPC `create_odontogram_with_teeth` não salva `mobility_grade` e `priority`
**Localização:** `20260304000000_fix_odontogram_patient_id.sql` (linhas 80-101)  
**Problema:** A versão corrigida da RPC `create_odontogram_with_teeth` NÃO insere `mobility_grade` e `priority` nos dentes. O INSERT no loop faz:
```sql
INSERT INTO public.odontogram_teeth (
  odontogram_id, tooth_number, condition, surfaces, notes, procedure_date
) VALUES ( ... );
```
Mas o frontend envia `mobility_grade` e `priority` no JSON:
```ts
const teethArray = Array.from(teeth.values()).map(t => ({
  tooth_number: t.tooth_number,
  condition: t.condition,
  surfaces: t.surfaces || null,
  notes: t.notes || null,
  procedure_date: t.procedure_date || null,
  mobility_grade: t.mobility_grade ?? null,  // ← IGNORADO pela RPC
  priority: t.priority || "normal",           // ← IGNORADO pela RPC
}));
```
**Impacto:** Mobilidade e prioridade são PERDIDAS ao salvar e não restauradas ao recarregar.  
**Severidade:** 🔴 CRÍTICA

#### 8.2 RPC `get_client_odontograms` não retorna `dentition_type`
**Localização:** `20260304000000_fix_odontogram_patient_id.sql` (linhas 14-44)  
**Problema:** A function retorna `(id, exam_date, notes, professional_name, tooth_count, created_at)` mas NÃO retorna `dentition_type`. O frontend tenta acessar:
```ts
setDentitionType((latest.dentition_type as DentitionType) || "permanent");
```
**Impacto:** Tipo de dentição sempre será "permanent" ao recarregar, mesmo que tenha sido salvo como "deciduous" ou "mixed".  
**Severidade:** 🔴 CRÍTICA

#### 8.3 RPC `get_tooth_evolution` usa coluna `o.patient_id` que pode não existir dependendo da ordem de migração
**Localização:** `20260304000001_odontogram_v2_expansion.sql` (linha 277)  
**Problema:** Referencia `o.patient_id` mas a coluna é `o.client_id` na v1 (renomeada na migration 20260330). Se a migration v2 for executada ANTES da rename, falha. Se executada depois, ok. Depende da **ordem das migrações** que tem timestamps inconsistentes:
- `20260304000001_odontogram_v2_expansion.sql` (timestamp: 2026-03-04) ← usa `patient_id`
- `20260330300000_rename_clients_to_patients_v1.sql` (timestamp: 2026-03-30) ← faz o rename  
**Impacto:** Se v2 roda antes do rename → ERRO 42703 `column o.patient_id does not exist`.  
**Severidade:** 🔴 CRÍTICA (depende do ambiente)

#### 8.4 `get_odontogram_stats` referencia `patient_id` antes do rename
**Localização:** `20260304000001_odontogram_v2_expansion.sql` (linhas 435-490)  
**Mesmo problema do 8.3** — usa `patient_id` que não existe até a migração 20260330.  
**Severidade:** 🔴 CRÍTICA

#### 8.5 `treatment_plans` usa `client_id` mas frontend envia `patient_id`
**Localização:** 
- Migration: `20260325100001_treatment_plans_v1.sql` (linha 12) → `client_id UUID NOT NULL REFERENCES public.clients(id)`
- Frontend: `Odontograma.tsx` (linha 421) → `patient_id: selectedPatient`
**Problema:** A tabela tem coluna `client_id`, mas o INSERT do frontend envia `patient_id`. Se a migration de rename (20260330) já executou, `clients` é uma view e a coluna foi renomeada. Se não executou, o INSERT falha porque a coluna `patient_id` não existe.
**Impacto:** Criar plano de tratamento pode falhar dependendo do estado das migrações.  
**Severidade:** 🔴 CRÍTICA

#### 8.6 `treatment_plan_items.tooth_number` CHECK constraint limitado a 11-48
**Localização:** `20260325100001_treatment_plans_v1.sql` (linha 64)
```sql
tooth_number INTEGER CHECK (tooth_number BETWEEN 11 AND 48 OR tooth_number IS NULL)
```
**Problema:** Dentes decíduos (51-85) não são aceitos. Se um odontograma de dentição mista/decídua gerar um plano de tratamento com dente decíduo, o INSERT falhará.  
**Severidade:** 🔴 CRÍTICA para dentição infantil

---

### 🟡 MODERADO — Erros que afetam funcionalidade

#### 8.7 Componente `Periograma.tsx` tem variáveis/imports não utilizados
**Localização:** `src/components/odontograma/Periograma.tsx`
- Linha 19: `Input` importado mas não usado
- Linha 114: `getDepthBorderColor` declarada mas nunca chamada
- Linha 140: `activeCell` e `setActiveCell` declarados mas nunca lidos
- Linha 447: `isReversed` parâmetro declarado mas nunca usado
**Impacto:** Warning de compilação, código morto.  
**Severidade:** 🟡 MODERADA

#### 8.8 Frontend usa `(supabase.rpc as any)` e `(supabase.from(...) as any)` extensivamente
**Localização:** Todos os arquivos que chamam RPCs do odontograma
**Problema:** Type casting com `as any` suprime erros de tipo, dificulta manutenção e refatoração. Indica que os tipos do Supabase não estão sendo gerados/atualizados com as tabelas do odontograma.  
**Severidade:** 🟡 MODERADA

#### 8.9 `create_odontogram_with_teeth` NÃO salva `dentition_type`
**Localização:** `20260304000000_fix_odontogram_patient_id.sql`  
**Problema:** O RPC cria o odontograma mas nunca recebe nem salva `dentition_type`. O INSERT faz:
```sql
INSERT INTO public.odontograms (tenant_id, patient_id, professional_id, appointment_id, exam_date, notes)
```
Mas não inclui `dentition_type`. Sempre será o DEFAULT 'permanent'.
Frontend envia `dentitionType` no state mas não na chamada RPC.  
**Impacto:** Mesmo que o usuário selecione "Infantil" ou "Misto", ao recarregar sempre volta para "Permanente".  
**Severidade:** 🟡 MODERADA → 🔴 CRÍTICA para odontopediatria

#### 8.10 PDF só renderiza dentes permanentes (UPPER_PERMANENT / LOWER_PERMANENT)
**Localização:** `src/utils/odontogramPdf.ts` (linhas 13, 91-141)
```ts
import { UPPER_PERMANENT, LOWER_PERMANENT } from "@/components/odontograma/odontogramConstants";
// ... só itera sobre esses arrays
```
**Problema:** Para dentição decídua ou mista, os dentes 51-85 não aparecem no PDF.  
**Severidade:** 🟡 MODERADA para quem usa dentição infantil

#### 8.11 `odontogram_tooth_surfaces` não é utilizado pelo frontend
**Localização:** Tabela criada na v2, mas nenhum componente faz INSERT/SELECT nela.
**Problema:** O `ToothDiagram.tsx` aceita `ToothSurfaceData[]` mas o frontend nunca popula esse campo com dados do banco. É conceitualmente suportado mas não implementado end-to-end.  
**Severidade:** 🟡 MODERADA (feature incompleta)

#### 8.12 `odontogram_annotations` não é utilizado pelo frontend
**Localização:** Tabela criada na v2, sem nenhum componente que leia/escreva.
**Severidade:** 🟡 MODERADA (feature incompleta)

---

### 🟢 MENOR — Problemas de qualidade

#### 8.13 Busca de pacientes sem debounce
**Localização:** `Odontograma.tsx` (linhas 141-151) e `Periograma.tsx`  
**Problema:** `useEffect` dispara query na tabela `patients` a cada keystroke (mínimo 2 chars). Sem debounce, pode gerar muitas requisições.  
**Severidade:** 🟢 MENOR

#### 8.14 `loadLatestOdontogram` sem cleanup no useEffect
**Localização:** `OdontogramaEmbed.tsx` (linhas 53-56)
```ts
useEffect(() => {
  if (tenantId && patientId) {
    void loadLatestOdontogram();
  }
}, [tenantId, patientId]);
```
**Problema:** Se o componente desmonta antes da requisição completar, pode causar state update em componente desmontado.  
**Severidade:** 🟢 MENOR

#### 8.15 Erros de SQL syntax nos arquivos de migração (warnings do IDE)
**Localização:** `20260304000001_odontogram_v2_expansion.sql`, `20260325100001_treatment_plans_v1.sql`  
**Problema:** O VS Code detecta erros de sintaxe SQL (provavelmente por parser SQL-Server em vez de PostgreSQL). Esses erros NÃO são reais — são falso-positivos do linter SQL do VS Code que não entende PostgreSQL corretamente (IF NOT EXISTS, REFERENCES, CHECK, etc.).  
**Severidade:** 🟢 INFORMATIVO — não são erros reais

---

## 9. PROBLEMAS DE ARQUITETURA

### 9.1 Inconsistência `client_id` vs `patient_id`
O sistema passou por um rename de `clients` → `patients` (migration 20260330), mas:
- Algumas RPCs ainda usam parâmetro `p_client_id` (mantém compatibilidade)
- Algumas migrações referenciam `patient_id` antes do rename acontecer
- `treatment_plans` ainda referencia `public.clients(id)` / `client_id`
- Há uma migration de fix (`20260304000000_fix_odontogram_patient_id.sql`) mas com timestamp ANTERIOR ao rename

### 9.2 Versionamento de odontograma é "append-only" sem soft delete
Cada "Salvar" cria um NOVO odontograma em vez de atualizar o existente. Isso gera:
- Crescimento infinito de registros
- Não há mecanismo de compactação/arquivamento
- `update_odontogram_inline` existe na v2 mas NÃO é usado pelo frontend

### 9.3 Tipos TypeScript não gerados para o módulo odontológico
Todos os acessos ao Supabase usam `as any`, indicando que o schema do banco não foi regenerado com `supabase gen types`. Isso desabilita a proteção de tipos para todo o módulo.

### 9.4 Periograma duplicado
Existem dois componentes `Periograma`:
- `src/components/odontograma/Periograma.tsx` (~1015 linhas) — componente reutilizável
- `src/pages/Periograma.tsx` (~607 linhas) — página standalone
A página standalone parece não utilizar o componente interno, implementando sua própria lógica.

### 9.5 Sem testes automatizados
Nenhum arquivo de teste foi encontrado para os componentes do módulo odontológico. O diretório `src/components/__tests__/` existe mas não contém testes de odontograma.

---

## 10. RECOMENDAÇÕES DE CORREÇÃO

### Prioridade 1 — CRÍTICAS (corrigir imediatamente)

| # | Ação | Arquivo |
|---|------|---------|
| C1 | **Atualizar RPC `create_odontogram_with_teeth`** para incluir `mobility_grade`, `priority` e `dentition_type` no INSERT | Nova migration SQL |
| C2 | **Atualizar RPC `get_client_odontograms`** para retornar `dentition_type` na TABLE de retorno | Nova migration SQL |
| C3 | **Expandir CHECK constraint** de `treatment_plan_items.tooth_number` para aceitar decíduos (51-85) | Nova migration SQL |
| C4 | **Corrigir `treatment_plans`** — garantir que a coluna é `patient_id` (após rename) e que o frontend está consistente | Verificar estado do banco + migration fix |
| C5 | **Verificar ordem de execução** das migrações para garantir que o rename `clients→patients` ocorre antes das RPCs que usam `patient_id` | Renomear arquivos se necessário |

### Prioridade 2 — MODERADAS (corrigir em breve)

| # | Ação | Arquivo |
|---|------|---------|
| M1 | **Atualizar `odontogramPdf.ts`** para suportar dentição decídua/mista (UPPER_DECIDUOUS, LOWER_DECIDUOUS) | `src/utils/odontogramPdf.ts` |
| M2 | **Gerar tipos TypeScript** do Supabase (`supabase gen types typescript`) e remover `as any` | `src/integrations/supabase/` |
| M3 | **Limpar imports não utilizados** no `Periograma.tsx` componente | `src/components/odontograma/Periograma.tsx` |
| M4 | **Implementar fluxo end-to-end** de `odontogram_tooth_surfaces` (condição independente por face) | Multiple files |
| M5 | **Adicionar `appointmentId`** na chamada RPC de `OdontogramaEmbed` (já disponível como prop mas não utilizado) | `OdontogramaEmbed.tsx` |

### Prioridade 3 — MELHORIAS (backlog)

| # | Ação |
|---|------|
| L1 | Adicionar debounce na busca de pacientes (300-500ms) |
| L2 | Adicionar cleanup no useEffect de carregamento (AbortController) |
| L3 | Unificar componente Periograma (usar o componente interno na página) |
| L4 | Implementar UI para `odontogram_annotations` |
| L5 | Adicionar testes unitários para componentes do odontograma |
| L6 | Implementar mecanismo de archiving para odontogramas antigos |
| L7 | Usar `update_odontogram_inline` para edições in-place (evitar append-only contínuo) |

---

## MIGRATION SQL — CORREÇÃO PROPOSTA

```sql
-- ============================================================
-- FIX: create_odontogram_with_teeth — adicionar mobility_grade, priority, dentition_type
-- ============================================================

-- Atualizar a RPC para receber e salvar dentition_type
CREATE OR REPLACE FUNCTION public.create_odontogram_with_teeth(
  p_tenant_id UUID,
  p_client_id UUID,
  p_professional_id UUID,
  p_appointment_id UUID DEFAULT NULL,
  p_exam_date DATE DEFAULT CURRENT_DATE,
  p_notes TEXT DEFAULT NULL,
  p_teeth JSONB DEFAULT '[]'::JSONB,
  p_dentition_type TEXT DEFAULT 'permanent'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_odontogram_id UUID;
  v_tooth JSONB;
BEGIN
  IF NOT (
    public.is_tenant_admin(auth.uid(), p_tenant_id)
    OR public.is_dentist(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Apenas dentistas podem criar odontogramas';
  END IF;

  INSERT INTO public.odontograms (
    tenant_id, patient_id, professional_id, appointment_id, exam_date, notes, dentition_type
  ) VALUES (
    p_tenant_id, p_client_id, p_professional_id, p_appointment_id, p_exam_date, p_notes,
    COALESCE(p_dentition_type, 'permanent')
  ) RETURNING id INTO v_odontogram_id;

  FOR v_tooth IN SELECT * FROM jsonb_array_elements(p_teeth)
  LOOP
    INSERT INTO public.odontogram_teeth (
      odontogram_id, tooth_number, condition, surfaces, notes,
      procedure_date, mobility_grade, priority
    ) VALUES (
      v_odontogram_id,
      (v_tooth->>'tooth_number')::INTEGER,
      COALESCE(v_tooth->>'condition', 'healthy'),
      v_tooth->>'surfaces',
      v_tooth->>'notes',
      (v_tooth->>'procedure_date')::DATE,
      (v_tooth->>'mobility_grade')::INTEGER,
      COALESCE(v_tooth->>'priority', 'normal')
    );
  END LOOP;

  RETURN v_odontogram_id;
END;
$$;

-- Atualizar get_client_odontograms para retornar dentition_type
DROP FUNCTION IF EXISTS public.get_client_odontograms(UUID, UUID);
CREATE OR REPLACE FUNCTION public.get_client_odontograms(
  p_tenant_id UUID,
  p_client_id UUID
)
RETURNS TABLE (
  id UUID,
  exam_date DATE,
  notes TEXT,
  professional_name TEXT,
  tooth_count BIGINT,
  created_at TIMESTAMPTZ,
  dentition_type TEXT
)
LANGUAGE sql
STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    o.id, o.exam_date, o.notes,
    p.full_name as professional_name,
    (SELECT COUNT(*) FROM public.odontogram_teeth t WHERE t.odontogram_id = o.id),
    o.created_at,
    o.dentition_type
  FROM public.odontograms o
  LEFT JOIN public.profiles p ON p.id = o.professional_id
  WHERE o.tenant_id = p_tenant_id AND o.patient_id = p_client_id
  ORDER BY o.exam_date DESC, o.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_client_odontograms(UUID, UUID) TO authenticated;

-- Fix treatment_plan_items tooth_number constraint
ALTER TABLE public.treatment_plan_items DROP CONSTRAINT IF EXISTS treatment_plan_items_tooth_number_check;
ALTER TABLE public.treatment_plan_items ADD CONSTRAINT treatment_plan_items_tooth_number_check
  CHECK (
    tooth_number IS NULL
    OR (tooth_number BETWEEN 11 AND 48)
    OR (tooth_number BETWEEN 51 AND 85)
  );
```

---

**Fim do relatório.**
