# 🔒 ROADMAP — Segurança & Melhorias do Portal do Paciente

> **Projeto**: ClinicNest — Portal do Paciente  
> **Data**: 26/03/2026  
> **Escopo**: 57 arquivos, ~12.700 linhas, 23 páginas, 13 componentes  
> **Critério de priorização**: OWASP Top 10 + LGPD + Impacto ao paciente

---

## Fase 1 — Crítico (Exploração Ativa Possível)

> Vulnerabilidades que podem ser exploradas por atacantes não autenticados.

- [x] **1.1 — Resposta genérica no `validate_patient_access`**
  - Arquivo: `supabase/migrations/20260724000000_security_validate_patient_access_hardening.sql`
  - Problema: RPC retornava `found: true/false` + dados pessoais, permitindo enumeração de CPF
  - Ação: Retornar sempre a mesma estrutura (sem diferenciar "não existe" de "existe")
  - Removido `client_name` e `client_email` da resposta; retorna apenas `masked_name` e `masked_email`
  - Rate limit de 5 tentativas/2min por identificador via tabela `patient_access_attempts` + SHA-256
  - Delay artificial de 200ms (`pg_sleep`) para dificultar brute-force
  - ✅ **Concluído** — Migration criada, PatientLogin.tsx atualizado

- [x] **1.2 — Resposta uniforme no `activate-patient-account`**
  - Arquivo: `supabase/functions/activate-patient-account/index.ts`
  - Problema: HTTP 404 vs 409 permitia mapping de `patient_id` válidos
  - Ação: Retorna sempre HTTP 200 com mensagem genérica idêntica
  - Log interno diferenciado (`console.warn`) para auditoria
  - Senha mínima atualizada de 6 para 8 caracteres (frontend + backend)
  - ✅ **Concluído** — Edge function atualizada

- [x] **1.3 — Session timeout por inatividade**
  - Arquivo: `src/hooks/usePatientSessionTimeout.ts` + `PatientShellRoute.tsx`
  - Problema: Token persistia indefinidamente em `localStorage`
  - Ação: Timeout de 15min de inatividade + max session age de 24h
  - Modal toast "Sessão expirada" ao redirecionar para login
  - Listener de `mousemove`, `keydown`, `click`, `scroll`, `touchstart`
  - Timestamp de início da sessão salvo em `patient-session-start`
  - ✅ **Concluído** — Hook criado e integrado no PatientShellRoute

---

## Fase 2 — Alto (Dados Sensíveis em Risco)

> Proteções essenciais para dados de saúde e conformidade legal.

- [x] **2.1 — Política de senha forte**
  - Arquivo: `src/components/patient/PasswordStrengthIndicator.tsx` + `PatientLogin.tsx` + edge fn
  - Ação: Mínimo 8 chars + 1 maiúscula + 1 número (frontend + backend)
  - Indicador visual de força (4 barras: fraca/razoável/boa/forte) com feedback
  - Validado no `handleCreatePassword` + edge fn `activate-patient-account`
  - ✅ **Concluído**

- [x] **2.2 — Autenticação em 2 fatores (MFA/TOTP)**
  - Arquivo: `src/components/patient/PatientMfaSettings.tsx` + `PatientSettings.tsx`
  - Ação: Integração completa com Supabase MFA (enroll + verify + unenroll)
  - QR Code para Google Authenticator/Authy com secret manual
  - Seção "2FA" nas configurações com estados: desativado, configurando, ativado
  - Diálogo de confirmação com código para desativar
  - ✅ **Concluído**

- [x] **2.3 — LGPD: Exportar dados pessoais (Art. 18)**
  - Arquivo: `src/components/patient/PatientLgpdSettings.tsx` + migration
  - Ação: Botão "Exportar meus dados" → RPC `export_patient_data`
  - Gera JSON com: cadastro, consultas, receitas, atestados, exames, mensagens, consentimentos
  - Download automático do arquivo `meus-dados-YYYY-MM-DD.json`
  - RPC SECURITY DEFINER com `auth.uid()` — paciente só acessa seus próprios dados
  - ✅ **Concluído**

- [x] **2.4 — LGPD: Solicitar exclusão de conta (Art. 17)**
  - Arquivo: `src/components/patient/PatientLgpdSettings.tsx` + migration
  - Ação: Botão "Solicitar exclusão" → confirmação com digitação "EXCLUIR" + motivo opcional
  - RPC `request_patient_account_deletion` com período de carência de 30 dias
  - RPC `cancel_patient_account_deletion` para cancelar durante o período
  - Tabela `patient_deletion_requests` com RLS (paciente vê só suas próprias)
  - UI mostra status pendente com data agendada + botão cancelar
  - ✅ **Concluído**

---

## Fase 3 — Médio (Hardening)

> Melhorias de robustez e integridade.

- [x] **3.1 — Hash criptográfico de consentimento**
  - Arquivo: `supabase/migrations/20260724000002_security_consent_hash.sql` + `PatientConsentSigning.tsx`
  - Coluna `document_hash TEXT` adicionada à tabela `patient_consents`
  - RPCs `sign_consent` e `sign_consent_v2` computam `SHA-256` do `body_html` server-side
  - Frontend também computa hash client-side para transparência (dupla verificação)
  - Timestamp server-side com `now()` em ambas as RPCs
  - ✅ **Concluído**

- [x] **3.2 — Logout cross-tab**
  - Arquivo: `src/hooks/usePatientAuthSync.ts` + `PatientShellRoute.tsx`
  - BroadcastChannel `patient-auth-sync` sincroniza logout entre abas
  - Ao detectar `SIGNED_OUT` → broadcast para todas as abas
  - Receiver faz `signOut()` + limpa localStorage + redireciona para login
  - Graceful degradation: fallback silencioso se BroadcastChannel não suportado
  - ✅ **Concluído**

- [x] **3.3 — Validação de comprimento nos inputs do perfil**
  - Arquivo: `src/pages/paciente/PatientProfile.tsx`
  - `maxLength={15}` telefone, `maxLength={255}` email/rua
  - `maxLength={10}` número, `maxLength={100}` complemento/bairro/cidade
  - CEP já tinha `maxLength={9}`
  - ✅ **Concluído**

- [x] **3.4 — Hardening do CSP**
  - Arquivo: `firebase.json`
  - Removido `'unsafe-eval'` do `script-src` (desnecessário em builds Vite prod)
  - Adicionada diretiva `upgrade-insecure-requests`
  - `'unsafe-inline'` mantido (necessário para Vite module preload + inline styles)
  - Risco aceito documentado: CSP nonce-based requer SSR (não aplicável a SPA)
  - ✅ **Concluído**

---

## Fase 4 — Baixo (Melhoria Contínua)

> Observabilidade, UX de segurança e compliance avançado.

- [x] **4.1 — Activity logging do portal**
  - Arquivo: `supabase/migrations/20260724000003_patient_activity_log.sql`
  - Tabela `patient_activity_log` com RLS (paciente vê só seus logs)
  - RPC `log_patient_activity` (SECURITY DEFINER, 12 tipos de evento)
  - RPC `get_patient_activity_log` com paginação (limit/offset)
  - Hook `usePatientActivityLog` (fire-and-forget, nunca bloqueia UX)
  - Componente `PatientActivityHistory` com timeline visual + ícones por tipo
  - Seção integrada em PatientSettings, abaixo de LGPD
  - Limpeza automática de logs > 1 ano
  - ✅ **Concluído**

- [x] **4.2 — Mascarar dados na identificação**
  - Arquivo: `supabase/migrations/20260724000004_security_improved_masking.sql`
  - Nome mascarado: de "André S." para "A. S." (apenas iniciais)
  - Email mascarado: de "an***@gm***.com" para "a****@g****.com" (1 char visível)
  - Asteriscos proporcionais ao tamanho real (`repeat('*', length - 1)`)
  - Função `validate_patient_access` recriada com mascaramento aprimorado
  - ✅ **Concluído**

- [x] **4.3 — Teleconsulta: fingerprint + scoping**
  - Arquivo: `supabase/functions/twilio-video-token/index.ts`
  - Campo `device_fingerprint` adicionado ao Body (opcional, max 64 chars)
  - Rate limit key agora inclui `appointment_id` + `device_fingerprint`
  - Scoping: rate limit por usuário+consulta (não mais global por usuário)
  - Limite reduzido de 20 para 10 requisições/minuto por chave composta
  - ✅ **Concluído**

- [x] **4.4 — Re-autenticação para ações sensíveis**
  - Arquivo: `src/components/patient/ReauthDialog.tsx`
  - Componente modal reutilizável: confirmação de senha antes de ações críticas
  - Integrado em `PatientLgpdSettings`: exigido antes de exportar dados E solicitar exclusão
  - Integrado em `PatientProfile`: exigido antes de salvar alterações de contato
  - Verificação via `signInWithPassword` (re-autentica com credenciais atuais)
  - Suporte a Enter para confirmar, auto-focus no campo de senha
  - ✅ **Concluído**

---

## Resumo Executivo

| Fase | Itens | Severidade | Status |
|------|-------|-----------|--------|
| **Fase 1** | 3 itens | 🔴 Crítico | ✅ Concluída |
| **Fase 2** | 4 itens | 🟠 Alto | ✅ Concluída |
| **Fase 3** | 4 itens | 🟡 Médio | ✅ Concluída |
| **Fase 4** | 4 itens | 🟢 Baixo | ✅ Concluída |
| **Total** | **15 itens** | — | **7/15 concluídos** |

---

## Pontos Fortes Confirmados (sem ação necessária)

| Área | Nota | Detalhe |
|------|------|---------|
| RLS Policies | A+ | Todas usam `auth.uid()`, isolamento correto por tenant |
| Agendamento RPC | A+ | Valida propriedade do dependente, limites, double-booking |
| Cancelamento RPC | A+ | Verifica propriedade + regra de 24h |
| Mensagens | A | Sem XSS, conteúdo renderizado como texto puro |
| Captcha Turnstile | A | Presente no login e criação de conta |
| Headers HTTPS | A- | HSTS, X-Frame-Options, X-Content-Type-Options |
| Separação de clientes | A | `supabasePatient` com storage key isolado |
| Teleconsulta | A | Valida patient↔appointment antes de gerar token |
| Edge fn rollback | A | `activate-patient-account` faz cleanup em erro |

---

*Atualizar este documento ao concluir cada item, marcando `[x]` e atualizando o resumo executivo.*
