/**
 * ClinicaFlow Public API — OpenAPI 3.0 specification
 *
 * This module generates the OpenAPI spec dynamically and provides
 * endpoint documentation for third-party integrations.
 */

export interface OpenAPISpec {
  openapi: string;
  info: { title: string; description: string; version: string; contact: { email: string } };
  servers: Array<{ url: string; description: string }>;
  paths: Record<string, Record<string, unknown>>;
  components: { securitySchemes: Record<string, unknown>; schemas: Record<string, unknown> };
  security: Array<Record<string, string[]>>;
}

export function generateOpenAPISpec(supabaseUrl: string): OpenAPISpec {
  return {
    openapi: "3.0.3",
    info: {
      title: "ClinicaFlow Public API",
      description:
        "API REST para integração com o ClinicaFlow. " +
        "Permite consultar pacientes, agendamentos, prontuários e realizar operações " +
        "de faturamento. Autenticação via API Key (Bearer token).",
      version: "1.0.0",
      contact: { email: "api@clinicaflow.com.br" },
    },
    servers: [
      { url: `${supabaseUrl}/rest/v1`, description: "Supabase REST (PostgREST)" },
      { url: `${supabaseUrl}/functions/v1`, description: "Supabase Edge Functions" },
    ],
    paths: {
      "/clients": {
        get: {
          summary: "Listar pacientes",
          description: "Retorna a lista de pacientes do tenant autenticado.",
          tags: ["Pacientes"],
          parameters: [
            { name: "name", in: "query", schema: { type: "string" }, description: "Filtrar por nome (ilike)" },
            { name: "cpf", in: "query", schema: { type: "string" }, description: "Filtrar por CPF" },
            { name: "select", in: "query", schema: { type: "string" }, description: "Campos retornados (PostgREST select)" },
            { name: "limit", in: "query", schema: { type: "integer" }, description: "Limite de registros" },
            { name: "offset", in: "query", schema: { type: "integer" }, description: "Offset para paginação" },
          ],
          responses: {
            "200": { description: "Lista de pacientes", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Client" } } } } },
            "401": { description: "Não autenticado" },
          },
        },
        post: {
          summary: "Criar paciente",
          description: "Cria um novo paciente no tenant autenticado.",
          tags: ["Pacientes"],
          requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/ClientCreate" } } } },
          responses: {
            "201": { description: "Paciente criado" },
            "409": { description: "CPF já cadastrado" },
          },
        },
      },
      "/appointments": {
        get: {
          summary: "Listar agendamentos",
          description: "Retorna agendamentos do tenant. Suporta filtros por data, profissional e status.",
          tags: ["Agendamentos"],
          parameters: [
            { name: "scheduled_at", in: "query", schema: { type: "string" }, description: "Filtro por data (gte/lte)" },
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "confirmed", "completed", "cancelled"] } },
            { name: "professional_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "select", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Lista de agendamentos", content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/Appointment" } } } } },
          },
        },
      },
      "/medical_records": {
        get: {
          summary: "Listar prontuários",
          description: "Retorna prontuários médicos do tenant.",
          tags: ["Prontuários"],
          parameters: [
            { name: "client_id", in: "query", schema: { type: "string", format: "uuid" } },
            { name: "select", in: "query", schema: { type: "string" } },
          ],
          responses: {
            "200": { description: "Lista de prontuários" },
          },
        },
      },
      "/services": {
        get: {
          summary: "Listar procedimentos/serviços",
          description: "Retorna os serviços cadastrados no tenant.",
          tags: ["Serviços"],
          responses: { "200": { description: "Lista de serviços" } },
        },
      },
      "/insurance_plans": {
        get: {
          summary: "Listar convênios",
          description: "Retorna os planos de saúde/convênios do tenant.",
          tags: ["Convênios"],
          responses: { "200": { description: "Lista de convênios" } },
        },
      },
      "/tiss_guides": {
        get: {
          summary: "Listar guias TISS",
          description: "Retorna as guias TISS geradas pelo tenant.",
          tags: ["Faturamento"],
          parameters: [
            { name: "status", in: "query", schema: { type: "string", enum: ["pending", "submitted", "accepted", "rejected"] } },
            { name: "lot_number", in: "query", schema: { type: "string" } },
          ],
          responses: { "200": { description: "Lista de guias TISS" } },
        },
      },
      "/rpc/create_appointment_v2": {
        post: {
          summary: "Criar agendamento",
          description: "Cria um agendamento via RPC com validação de conflitos e horários.",
          tags: ["Agendamentos"],
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["p_client_id", "p_service_id", "p_professional_id", "p_scheduled_at"],
                  properties: {
                    p_client_id: { type: "string", format: "uuid" },
                    p_service_id: { type: "string", format: "uuid" },
                    p_professional_id: { type: "string", format: "uuid" },
                    p_scheduled_at: { type: "string", format: "date-time" },
                    p_duration: { type: "integer", default: 30 },
                    p_price: { type: "number" },
                    p_status: { type: "string", default: "pending" },
                    p_notes: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": { description: "Agendamento criado com sucesso" },
            "409": { description: "Conflito de horário" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Token JWT obtido via autenticação Supabase (supabase.auth.signIn)",
        },
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "apikey",
          description: "Chave anon/service_role do projeto Supabase",
        },
      },
      schemas: {
        Client: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            cpf: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            birth_date: { type: "string", format: "date" },
            gender: { type: "string" },
            created_at: { type: "string", format: "date-time" },
          },
        },
        ClientCreate: {
          type: "object",
          required: ["name"],
          properties: {
            name: { type: "string" },
            cpf: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            birth_date: { type: "string", format: "date" },
            gender: { type: "string", enum: ["M", "F", "O"] },
          },
        },
        Appointment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            scheduled_at: { type: "string", format: "date-time" },
            duration_minutes: { type: "integer" },
            status: { type: "string", enum: ["pending", "confirmed", "completed", "cancelled"] },
            client_id: { type: "string", format: "uuid" },
            service_id: { type: "string", format: "uuid" },
            professional_id: { type: "string", format: "uuid" },
          },
        },
      },
    },
    security: [
      { BearerAuth: [] },
      { ApiKeyAuth: [] },
    ],
  };
}

/**
 * Downloads the OpenAPI spec as JSON.
 */
export function downloadOpenAPISpec(spec: OpenAPISpec) {
  const json = JSON.stringify(spec, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "clinicaflow-api-spec.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
