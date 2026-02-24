/**
 * URL Routing Conventions — Padrão de URLs para entidades
 * 
 * Este arquivo documenta as convenções de roteamento para páginas de entidades
 * no ClinicaFlow, seguindo as melhores práticas de UX enterprise.
 * 
 * ## Padrão de URLs
 * 
 * | Ação | URL | Componente | Descrição |
 * |------|-----|------------|-----------|
 * | Listar | `/entidades` | EntidadesPage | Lista com filtros, busca, paginação |
 * | Detalhe | `/entidades/:id` | EntidadeDetalhePage | Visualização completa com abas |
 * | Editar | `/entidades/:id/edit` | EntidadeEditPage | Formulário de edição |
 * | Criar | `/entidades/novo` | EntidadeNovoPage | Formulário de criação |
 * 
 * ## Exemplos por Entidade
 * 
 * ### Pacientes (Clientes)
 * - `/clientes` — Lista de pacientes
 * - `/clientes/:id` — Ficha completa do paciente (abas: Dados, Prontuários, Receitas, etc.)
 * - `/clientes/:id/edit` — Editar dados cadastrais
 * - `/clientes/novo` — Cadastrar novo paciente
 * 
 * ### Prontuários
 * - `/prontuarios` — Lista de prontuários
 * - `/prontuarios/:id` — Detalhe do prontuário (já existe como ProntuarioDetalhe)
 * 
 * ### Compras
 * - `/compras` — Lista de compras
 * - `/compras/:id` — Detalhe da compra
 * - `/compras/nova` — Nova compra (multi-step)
 * 
 * ### Campanhas
 * - `/campanhas` — Lista de campanhas
 * - `/campanhas/:id` — Detalhe/métricas da campanha
 * - `/campanhas/nova` — Nova campanha (editor)
 * - `/campanhas/:id/edit` — Editar campanha
 * 
 * ### Modelos de Prontuário
 * - `/modelos-prontuario` — Lista de modelos
 * - `/modelos-prontuario/:id` — Editor do modelo (builder)
 * - `/modelos-prontuario/novo` — Novo modelo
 * 
 * ### Termos de Consentimento
 * - `/termos-consentimento` — Lista de termos
 * - `/termos-consentimento/:id` — Editor do termo
 * - `/termos-consentimento/novo` — Novo termo
 * 
 * ### Contratos e Termos
 * - `/contratos-termos` — Lista de contratos
 * - `/contratos-termos/:id` — Editor do contrato
 * - `/contratos-termos/novo` — Novo contrato
 * 
 * ## Regras de Decisão
 * 
 * 1. **Listar** → Sempre `/entidades` (plural)
 * 2. **Detalhe** → `/entidades/:id` quando há visualização rica (abas, histórico)
 * 3. **Editar** → `/entidades/:id/edit` quando edição é separada do detalhe
 * 4. **Criar** → `/entidades/novo` ou `/entidades/nova` (gênero da entidade)
 * 
 * ## Quando usar Drawer vs Página
 * 
 * - **Drawer (5-10 campos)**: Receituários, Laudos, Atestados, Encaminhamentos
 *   - Mantém contexto da lista atrás
 *   - Não precisa de URL própria (estado local)
 * 
 * - **Página (10+ campos ou abas)**: Ficha do Paciente, Compras, Campanhas
 *   - URL linkável e compartilhável
 *   - Breadcrumb para navegação
 *   - Suporte a deep linking
 * 
 * ## Implementação
 * 
 * ```tsx
 * // App.tsx
 * <Route path="/clientes" element={<Clientes />} />
 * <Route path="/clientes/novo" element={<ClienteNovo />} />
 * <Route path="/clientes/:id" element={<ClienteDetalhe />} />
 * <Route path="/clientes/:id/edit" element={<ClienteEdit />} />
 * ```
 * 
 * ## Navegação
 * 
 * ```tsx
 * // Da lista para detalhe
 * navigate(`/clientes/${cliente.id}`);
 * 
 * // Do detalhe para edição
 * navigate(`/clientes/${id}/edit`);
 * 
 * // Voltar para lista
 * navigate("/clientes");
 * // ou
 * navigate(-1);
 * ```
 */

export const ENTITY_ROUTES = {
  clientes: {
    list: "/clientes",
    detail: (id: string) => `/clientes/${id}`,
    edit: (id: string) => `/clientes/${id}/edit`,
    create: "/clientes/novo",
  },
  compras: {
    list: "/compras",
    detail: (id: string) => `/compras/${id}`,
    create: "/compras/nova",
  },
  campanhas: {
    list: "/campanhas",
    detail: (id: string) => `/campanhas/${id}`,
    edit: (id: string) => `/campanhas/${id}/edit`,
    create: "/campanhas/nova",
  },
  modelosProntuario: {
    list: "/modelos-prontuario",
    detail: (id: string) => `/modelos-prontuario/${id}`,
    create: "/modelos-prontuario/novo",
  },
  termosConsentimento: {
    list: "/termos-consentimento",
    detail: (id: string) => `/termos-consentimento/${id}`,
    create: "/termos-consentimento/novo",
  },
  contratosTermos: {
    list: "/contratos-termos",
    detail: (id: string) => `/contratos-termos/${id}`,
    create: "/contratos-termos/novo",
  },
} as const;

export type EntityRouteKey = keyof typeof ENTITY_ROUTES;
