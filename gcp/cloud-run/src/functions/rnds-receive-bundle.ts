/**
 * rnds-receive-bundle — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { createDbClient } from '../shared/db-builder';
import { createAuthAdmin } from '../shared/auth-admin';
export async function rndsReceiveBundle(req: Request, res: Response) {
  try {
    const db = createDbClient();
    const authAdmin = createAuthAdmin();
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
      // CORS handled by middleware
      // Health check
      if (req.method === "GET") {
        return new Response(
          JSON.stringify({ status: "ok", service: "rnds-receive-bundle", version: "1.0.0" }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
      }
        // ── Authenticate ────────────────────────────────────────────
        const authHeader = (req.headers['authorization'] as string) ?? "";
        const apiKey = (req.headers['x-api-key'] as string) ?? "";
        const cnesHeader = (req.headers['x-cnes-destino'] as string) ?? "";

        // Find tenant by CNES
        let tenantId: string | null = null;

        if (cnesHeader) {
          const { data: tenantData } = await db.from("tenants")
            .select("id")
            .eq("rnds_cnes", cnesHeader)
            .eq("rnds_enabled", true)
            .single();

          tenantId = tenantData?.id ?? null;
        }

        // Fallback: try auth header as JWT
        if (!tenantId && authHeader.startsWith("Bearer ")) {
          const token = authHeader.replace("Bearer ", "");
                    const _authRes = await authAdmin.getUser((authHeader || '').replace('Bearer ', ''));

                    const user = _authRes.data?.user;
          if (user) {
            const { data: profile } = await db.from("profiles")
              .select("tenant_id")
              .eq("user_id", user.id)
              .single();

            tenantId = profile?.tenant_id ?? null;
          }
        }

        if (!tenantId) {
          return res.status(401).json({ error: "Não foi possível identificar o estabelecimento destino. Informe X-CNES-Destino ou Authorization." });
        }

        // ── Parse Bundle ──────────────────────────────────────────
        const body = req.body;

        if (!body || body.resourceType !== "Bundle" || !Array.isArray(body.entry)) {
          return res.status(400).json({ error: "Payload inválido. Esperado FHIR Bundle R4 com entry[]." });
        }

        // ── Extract metadata ──────────────────────────────────────
        const resourceTypes: string[] = [];
        const typeSet = new Set<string>();
        let patientCpf: string | null = null;
        let patientName: string | null = null;
        let sourceCnes: string | null = (req.headers['x-cnes-origem'] as string) ?? null;
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
              patientName = n.text ?? ([
                ...(n.given || []),
                n.family,
              ].filter(Boolean).join(" ") || null);
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
            const { data: matchedPatient } = await db.from("patients")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("cpf", sanitizedCpf)
              .limit(1)
              .single();

            matchedPatientId = matchedPatient?.id ?? null;
          }
        }

        // ── Store in database ─────────────────────────────────────
        const { data: inserted, error: insertError } = await db.from("incoming_rnds_bundles")
          .insert({
            tenant_id: tenantId,
            bundle_type: body.type || "document",
            fhir_bundle: body,
            bundle_id: body.uid ?? null,
            source_cnes: sourceCnes,
            source_name: sourceName,
            source_uf: (req.headers['x-uf-origem'] as string) ?? null,
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
          return res.status(500).json({ error: "Erro ao armazenar bundle", details: insertError.message });
        }

        return res.status(201).json({
            status: "received",
            id: inserted?.id,
            resource_count: body.entry.length,
            resource_types: resourceTypes,
            patient_matched: !!matchedPatientId,
            message: "Bundle FHIR recebido com sucesso. Aguardando revisão clínica.",
          });
  } catch (err: any) {
    console.error("rnds-receive-bundle error:", err);
    return res.status(500).json({ error: err instanceof Error ? err.message : "Erro interno" });
  }
}
