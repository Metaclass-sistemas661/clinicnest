# AUDITORIA COMPLETA DO SISTEMA — ClinicaFlow

**Data:** 04/07/2026  
**Escopo:** Sistema completo (frontend `src/` + backend `supabase/migrations/`)  
**Build:** ✅ TypeScript 0 erros | ✅ Vite build SUCCESS (3m 13s)

---

## RESUMO EXECUTIVO

| # | Categoria | Severidade | Total | Status |
|---|-----------|-----------|-------|--------|
| 1 | RPCs sem GRANT EXECUTE | **CRÍTICA** | 32 funções | ✅ CORRIGIDO — migração criada |
| 2 | Tabela obsoleta `.from("clients")` | **ALTA** | 1 ocorrência | ✅ CORRIGIDO |
| 3 | Falta de error handling em queries | **ALTA** | ~308 chamadas | ⚠️ Pendente (refatoração grande) |
| 4 | Type assertions `as any` | **MÉDIA** | 255 ocorrências | ⚠️ Pendente (refatoração gradual) |
| 5 | useEffect com deps vazias | **MÉDIA** | 45 em 37 arquivos | ⚠️ Pendente (maioria legítima) |
| 6 | Chunks > 500KB no build | **BAIXA** | 3 chunks | ℹ️ Informativo |
| 7 | Rotas sem autenticação | **BAIXA** | 0 problemas reais | ✅ OK |
| 8 | Segredos hardcoded | **NENHUMA** | 0 | ✅ OK |
| 9 | Console.log sensível | **NENHUMA** | 0 | ✅ OK |
| 10 | `.from("services")` obsoleto | **NENHUMA** | 0 | ✅ Migrado |

---

## 1. RPCs SEM GRANT EXECUTE — ✅ CORRIGIDO

**Problema:** 32 funções RPC chamadas pelo frontend não tinham `GRANT EXECUTE`, causando erro 404 no PostgREST/Supabase quando invocadas.

**Correção aplicada:** `supabase/migrations/20260704200000_grant_execute_missing_rpcs.sql`

### Funções corrigidas (32):

| Módulo | Funções |
|--------|---------|
| **Chat** | `create_chat_channel`, `send_chat_message`, `edit_chat_message`, `delete_chat_message`, `mark_chat_as_read`, `get_unread_chat_count`, `search_chat_messages` |
| **Retornos** | `create_return_reminder`, `get_pending_returns`, `get_returns_to_notify`, `get_return_statistics`, `link_appointment_to_return` |
| **Retenção CFM** | `get_retention_statistics`, `get_retention_deletion_attempts`, `get_clients_near_retention_expiry`, `archive_client_clinical_data`, `get_archived_client_data` |
| **ONA/Acreditação** | `calcular_indicadores_ona`, `generate_adverse_event_number` |
| **Odontologia** | `get_client_dental_images`, `get_periogram_measurements` |
| **HL7/FHIR** | `get_hl7_dashboard_stats` |
| **Certificado Digital** | `sign_medical_certificate`, `sign_prescription`, `verify_certificate_signature` |
| **Feature Overrides** | `create_feature_override`, `create_limit_override`, `get_tenant_overrides`, `tenant_has_feature` |
| **Tema** | `get_tenant_theme`, `upsert_tenant_theme` |
| **Agenda** | `get_time_slot_no_show_rate` |

> Todas receberam `GRANT EXECUTE TO authenticated, service_role`.

---

## 2. TABELA OBSOLETA `.from("clients")` — ✅ CORRIGIDO

**Arquivo:** `src/pages/FaturasPacientes.tsx` (linha 144)  
**Antes:** `.from("clients")`  
**Depois:** `.from("patients")`

> Funcionava apenas pela VIEW de compatibilidade `public.clients AS SELECT * FROM public.patients`. Agora usa a tabela correta diretamente.

> **`.from("services")` não foi encontrado** — migração para `procedures` está completa.

---

## 3. FALTA DE ERROR HANDLING — ⚠️ Pendente

**~308 chamadas** `.from()` ou `.rpc()` sem verificação do campo `error`.

### Top 10 arquivos ofensores:

| Arquivo | Chamadas sem check |
|---------|-------------------|
| `src/pages/Integracoes.tsx` | 12 |
| `src/components/meu-financeiro/MeuFinanceiroResumo.tsx` | 11 |
| `src/pages/Dashboard.tsx` | 10 |
| `src/pages/Agenda.tsx` | 9 |
| `src/pages/Pacientes.tsx` | 7 |
| `src/pages/PacienteDetalhe.tsx` | 7 |
| `src/pages/Relatorios.tsx` | 6 |
| `src/pages/Encaminhamentos.tsx` | 6 |
| `src/hooks/useUsageStats.ts` | 6 |
| `src/pages/PlanosTratamento.tsx` | 6 |

### Padrão problemático:
```ts
// ❌ Sem tratamento de erro
const { data } = await supabase.from("appointments").select("*").eq("tenant_id", tid);

// ✅ Com tratamento de erro
const { data, error } = await supabase.from("appointments").select("*").eq("tenant_id", tid);
if (error) { logger.error("Appointments:", error); toast.error("Erro ao carregar"); return; }
```

### Recomendação:
Criar um wrapper `safeFetch` ou `safeRpc` para centralizar tratamento de erro e reduzir boilerplate.

---

## 4. TYPE ASSERTIONS `as any` — ⚠️ Pendente

**255 ocorrências** em todo o projeto.

### Top 5 ofensores:
| Arquivo | Count |
|---------|-------|
| `src/pages/Integracoes.tsx` | 23 |
| `src/integrations/fhir.ts` | 15 |
| `src/pages/Odontograma.tsx` | 10 |
| `src/components/comandas/ComandaDetail.tsx` | 8 |
| `src/hooks/useExamResults.ts` | 7 |

### Recomendação:
- Criar interfaces tipadas para respostas de RPCs do Supabase
- Gerar tipos automaticamente com `supabase gen types typescript`
- Priorizar `Integracoes.tsx` e `fhir.ts` que concentram 38 ocorrências

---

## 5. useEffect COM DEPS VAZIAS — ⚠️ Pendente

**45 ocorrências de `useEffect(() => {...}, [])` em 37 arquivos.**

### Que merecem revisão:
| Arquivo | Observação |
|---------|------------|
| `PatientAgendar.tsx` | 2 effects sem deps de contexto do paciente |
| `PatientFinanceiro.tsx` | Fetch sem dep de tenant/patient |
| `PatientSaude.tsx` | Fetch de dados de saúde sem deps |
| `PatientMensagens.tsx` | Fetch sem deps |
| `PainelChamada.tsx` | Subscrição realtime |

> **Nota:** Nem todas são bugs. Effects de inicialização única (timers, listeners, service workers) legitimamente usam `[]`.

---

## 6. CHUNKS GRANDES NO BUILD — ℹ️ Informativo

| Chunk | Tamanho |
|-------|---------|
| `vendor-pdf` (jsPDF) | 648 KB |
| `VideoRoom` (WebRTC) | 462 KB |
| `vendor-charts` (recharts) | 422 KB |

### Recomendação:
- Lazy load do módulo de teleconsulta (`VideoRoom`)
- Lazy load do PDF generator
- São warnings, não erros — não impactam funcionalidade

---

## 7. ROTAS SEM AUTENTICAÇÃO — ✅ OK

**60+ rotas internas** estão corretamente protegidas com `<ProtectedRoute>`.

**Rotas públicas** (corretas):
- Landing pages: `/`, `/solucoes`, `/sobre`
- Auth: `/login`, `/cadastro`, `/forgot-password`, `/reset-password`
- Legal: `/termos-de-uso`, `/politica-de-privacidade`
- Links com token: `/confirmar/:token`, `/nps/:token`, etc.
- Portal paciente auth: `/paciente/login`, `/paciente/cadastro`

**Nota sobre `/painel-chamada`:**  
Rota pública por design (TV da recepção). Exibe nomes abreviados (2 primeiras palavras). Os hooks usam RPCs que requerem sessão autenticada — sem login, dados não carregam. Considerar exibir apenas primeiro nome + inicial para mais conformidade LGPD.

---

## 8-10. SEGURANÇA — ✅ OK

- **Zero segredos hardcoded** no código fonte
- **Zero console.log com dados sensíveis** (password, token, secret)
- **`.from("services")` totalmente migrado** para `.from("procedures")`
- Todas as variáveis sensíveis usam `import.meta.env.VITE_*`

---

## MIGRAÇÕES SQL CRIADAS NESTA SESSÃO

| Arquivo | Propósito |
|---------|-----------|
| `20260704000000_fix_odontogram_critical_bugs.sql` | Fix RPCs odontograma (mobility_grade, priority, dentition_type, CHECK constraint dentes decíduos) |
| `20260704100000_fix_periogram_treatment_rpcs_patient_id.sql` | Fix client_id → patient_id nas RPCs periograma e planos de tratamento |
| `20260704200000_grant_execute_missing_rpcs.sql` | GRANT EXECUTE para 32 RPCs chamadas pelo frontend |

---

## ARQUIVOS FRONTEND MODIFICADOS NESTA SESSÃO

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Odontograma.tsx` | `p_dentition_type` + debounce busca paciente |
| `src/pages/Periograma.tsx` | Debounce busca paciente |
| `src/pages/PlanosTratamento.tsx` | Debounce busca paciente |
| `src/pages/FaturasPacientes.tsx` | `.from("clients")` → `.from("patients")` |
| `src/components/prontuario/OdontogramaEmbed.tsx` | `p_dentition_type` + cleanup useEffect |
| `src/components/odontograma/Periograma.tsx` | Remoção de imports/vars não usados |
| `src/utils/odontogramPdf.ts` | Suporte dentes decíduos/mistos no PDF |

---

## PRÓXIMOS PASSOS RECOMENDADOS (por prioridade)

1. **Aplicar as 3 migrações SQL** no Supabase (produção)
2. **Adicionar error handling** nos top 10 arquivos — criar wrapper `safeFetch`/`safeRpc`
3. **Gerar tipos Supabase** com `supabase gen types typescript` para reduzir `as any`
4. **Revisar** `PainelChamada` para exibir apenas primeiro nome (LGPD)
5. **Code splitting** — lazy load `VideoRoom` e geradores de PDF  
6. **Reduzir `as any`** gradualmente, começando por `Integracoes.tsx` (23) e `fhir.ts` (15)
