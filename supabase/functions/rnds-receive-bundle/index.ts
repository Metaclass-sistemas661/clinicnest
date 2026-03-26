/**
 * Edge Function: rnds-receive-bundle
 *
 * Webhook para receber FHIR Bundles da RNDS (Rede Nacional de Dados em Saúde).
 * Implementa o fluxo bidirecional:
 *   1. Recebe Bundle FHIR via POST
 *   2. Valida estrutura e extrai metadados
 *   3. Tenta deduplicar paciente por CPF
 *   4. Armazena na tabela incoming_rnds_bundles
 *   5. Retorna confirmation
 *
 * Autenticação: Bearer token da RNDS ou API key configurada no tenant.
 * 
 * Endpoints:
 *   POST / — Receber bundle
 *   GET  / — Health check
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Health check
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", service: "rnds-receive-bundle", version: "1.0.0" }),
      { headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // ── Authenticate ────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKey = req.headers.get("X-API-Key") ?? "";
    const cnesHeader = req.headers.get("X-CNES-Destino") ?? "";

    // Find tenant by CNES
    let tenantId: string | null = null;

    if (cnesHeader) {
      const { data: tenantData } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("rnds_cnes", cnesHeader)
        .eq("rnds_enabled", true)
        .single();

      tenantId = tenantData?.id ?? null;
    }

    // Fallback: try auth header as Supabase JWT  
    if (!tenantId && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );

      const { data: { user } } = await supabaseUser.auth.getUser();
      if (user) {
        const { data: profile } = await supabaseUser
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();

        tenantId = profile?.tenant_id ?? null;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ error: "Não foi possível identificar o estabelecimento destino. Informe X-CNES-Destino ou Authorization." }),
        { status: 401, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Parse Bundle ──────────────────────────────────────────
    const body = await req.json();

    if (!body || body.resourceType !== "Bundle" || !Array.isArray(body.entry)) {
      return new Response(
        JSON.stringify({ error: "Payload inválido. Esperado FHIR Bundle R4 com entry[]." }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // ── Extract metadata ──────────────────────────────────────
    const resourceTypes: string[] = [];
    const typeSet = new Set<string>();
    let patientCpf: string | null = null;
    let patientName: string | null = null;
    let sourceCnes: string | null = req.headers.get("X-CNES-Origem") ?? null;
    let sourceName: string | null = null;

    for (const entry of body.entry) {
      if (!entry?.resource?.resourceType) continue;
      const rt = entry.resource.resourceType;
      typeSet.add(rt);

      // Extract patient CPF
      if (rt === "Patient" && !patientCpf) {
        const identifiers = entry.resource.identifier;
        if (Array.isArray(identifiers)) {
          for (const id of identifiers) {
            if (
              id?.system === "http://rnds.saude.gov.br/fhir/r4/NamingSystem/cpf" ||
              id?.system === "urn:oid:2.16.840.1.113883.13.237" ||
              (typeof id?.system === "string" && id.system.includes("cpf"))
            ) {
              patientCpf = id.value ?? null;
            }
          }
        }
        // Extract name
        if (Array.isArray(entry.resource.name) && entry.resource.name.length > 0) {
          const n = entry.resource.name[0];
          patientName = n.text ?? [
            ...(n.given || []),
            n.family,
          ].filter(Boolean).join(" ") || null;
        }
      }

      // Extract source organization  
      if (rt === "Organization" && !sourceName) {
        sourceName = entry.resource.name ?? null;
        const orgIds = entry.resource.identifier;
        if (Array.isArray(orgIds)) {
          for (const id of orgIds) {
            if (typeof id?.system === "string" && id.system.includes("cnes")) {
              sourceCnes = id.value ?? sourceCnes;
            }
          }
        }
      }
    }

    for (const t of typeSet) resourceTypes.push(t);
    resourceTypes.sort();

    // ── Patient deduplication ─────────────────────────────────
    let matchedPatientId: string | null = null;

    if (patientCpf) {
      // Sanitize CPF — only digits
      const sanitizedCpf = patientCpf.replace(/\D/g, "");
      
      if (sanitizedCpf.length === 11) {
        const { data: matchedPatient } = await supabaseAdmin
          .from("patients")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("cpf", sanitizedCpf)
          .limit(1)
          .single();

        matchedPatientId = matchedPatient?.id ?? null;
      }
    }

    // ── Store in database ─────────────────────────────────────
    const { data: inserted, error: insertError } = await supabaseAdmin
      .from("incoming_rnds_bundles")
      .insert({
        tenant_id: tenantId,
        bundle_type: body.type || "document",
        fhir_bundle: body,
        bundle_id: body.id ?? null,
        source_cnes: sourceCnes,
        source_name: sourceName,
        source_uf: req.headers.get("X-UF-Origem") ?? null,
        patient_cpf: patientCpf?.replace(/\D/g, "") ?? null,
        patient_name: patientName,
        matched_patient_id: matchedPatientId,
        resource_types: resourceTypes,
        resource_count: body.entry.length,
        review_status: "pending",
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Erro ao armazenar bundle", details: insertError.message }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        status: "received",
        id: inserted?.id,
        resource_count: body.entry.length,
        resource_types: resourceTypes,
        patient_matched: !!matchedPatientId,
        message: "Bundle FHIR recebido com sucesso. Aguardando revisão clínica.",
      }),
      { status: 201, headers: { ...cors, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("rnds-receive-bundle error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
