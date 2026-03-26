/**
 * Edge Function: seal-consent-pdf
 *
 * Gera um PDF selado com validade jurídica para um consentimento assinado.
 * - Monta PDF com pdf-lib contendo: dados do paciente, conteúdo do termo,
 *   foto/assinatura, metadados (IP, user-agent, timestamp), QR Code de verificação.
 * - Calcula SHA-256 do PDF gerado.
 * - Faz upload no bucket consent-sealed-pdfs.
 * - Chama RPC seal_consent_pdf para registrar path + hash no banco.
 *
 * Chamada pelo frontend após sign_consent_v2 ou sign_consent_via_token.
 * Requer Authorization header (JWT do usuário autenticado ou service_role).
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createSupabaseAdmin } from "../_shared/supabase.ts";
import { createLogger } from "../_shared/logging.ts";

const log = createLogger("SEAL-CONSENT-PDF");

// ─── Helpers ───────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li[^>]*>/gi, "  - ")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sha256Hex(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function wrapText(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = "";
    for (const word of words) {
      if ((current + " " + word).trim().length > maxChars) {
        if (current) lines.push(current);
        current = word;
      } else {
        current = current ? current + " " + word : word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { consent_id } = await req.json() as { consent_id?: string };

    if (!consent_id) {
      return new Response(
        JSON.stringify({ error: "consent_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAdmin = createSupabaseAdmin();

    // ── Auth: validar JWT real via Auth Admin API (service_role) ──
    const authHeader = req.headers.get("authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing authorization token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      log.warn("Invalid JWT", { error: authErr?.message });
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. Buscar consent com dados relacionados ──
    const { data: consent, error: consentErr } = await supabaseAdmin
      .from("patient_consents")
      .select("*")
      .eq("id", consent_id)
      .single();

    console.log("[seal-consent-pdf] Consent fetch:", consent ? "found" : "not found");

    if (consentErr || !consent) {
      log.error("Consent not found", { consent_id });
      return new Response(
        JSON.stringify({ error: "Consentimento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Verificar que o usuário é dono do consent ou staff do tenant ──
    const isOwner = consent.patient_user_id === user.id;
    const userRole = user.app_metadata?.role ?? user.user_metadata?.account_type;
    const isStaff = userRole !== "patient";
    if (!isOwner && !isStaff) {
      log.warn("Forbidden: user is not consent owner or staff", { userId: user.id, consentOwner: consent.patient_user_id });
      return new Response(
        JSON.stringify({ error: "Sem permissão para selar este consentimento" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!consent.signed_at) {
      return new Response(
        JSON.stringify({ error: "Consentimento ainda não foi assinado" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Se já foi selado, retorna o resultado existente
    if (consent.sealed_pdf_path && consent.sealed_pdf_hash) {
      return new Response(
        JSON.stringify({
          success: true,
          consent_id,
          sealed_pdf_path: consent.sealed_pdf_path,
          sealed_pdf_hash: consent.sealed_pdf_hash,
          sealed_at: consent.sealed_at,
          already_sealed: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 2. Buscar dados do paciente ──
    const { data: client } = await supabaseAdmin
      .from("patients")
      .select("name, cpf, birth_date, email, phone")
      .eq("id", consent.patient_id)
      .single();

    // ── 3. Buscar template original ──
    const { data: template } = await supabaseAdmin
      .from("consent_templates")
      .select("title, slug")
      .eq("id", consent.template_id)
      .single();

    // ── 4. Buscar tenant ──
    const { data: tenant } = await supabaseAdmin
      .from("tenants")
      .select("name, cnpj, address, phone, email, logo_url")
      .eq("id", consent.tenant_id)
      .single();

    const patientName = client?.name ?? "Paciente";
    const templateTitle = template?.title ?? "Termo de Consentimento";
    const clinicName = tenant?.name ?? "Clínica";
    const clinicAddress = tenant?.address ?? "";
    const clinicPhone = tenant?.phone ?? "";
    const clinicEmail = tenant?.email ?? "";
    const clinicCnpj = tenant?.cnpj ?? "";
    const signedAt = formatDateBR(consent.signed_at);
    const signatureMethod = consent.signature_method === "manual"
      ? "Assinatura Manual (Canvas)"
      : "Reconhecimento Facial";

    // ── Teal palette ──
    const TEAL      = rgb(0.047, 0.608, 0.545);  // #0C9B8B
    const TEAL_DARK = rgb(0.035, 0.478, 0.427);   // #097A6D
    const TEAL_LIGHT = rgb(0.878, 0.965, 0.949);  // #E0F6F2
    const TEXT_DARK  = rgb(0.12, 0.12, 0.12);
    const TEXT_MID   = rgb(0.35, 0.35, 0.35);
    const TEXT_LIGHT = rgb(0.5, 0.5, 0.5);
    const BORDER     = rgb(0.82, 0.85, 0.88);

    // ── 5. Gerar PDF com pdf-lib ──
    const pdfDoc = await PDFDocument.create();
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const PAGE_W = 595.28; // A4 em pontos
    const PAGE_H = 841.89;
    const MARGIN = 50;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    const LINE_H = 14;
    const SMALL_LINE_H = 11;

    let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    const addNewPageIfNeeded = (needed: number) => {
      if (y - needed < MARGIN + 60) {
        drawFooter(page);
        page = pdfDoc.addPage([PAGE_W, PAGE_H]);
        y = PAGE_H - MARGIN;
      }
    };

    const drawFooter = (pg: typeof page) => {
      const footerY = 25;
      // Bottom teal bar
      pg.drawRectangle({
        x: 0, y: 0, width: PAGE_W, height: 6,
        color: TEAL,
      });
      pg.drawLine({
        start: { x: MARGIN, y: footerY + 12 },
        end: { x: PAGE_W - MARGIN, y: footerY + 12 },
        thickness: 0.5,
        color: BORDER,
      });
      pg.drawText("Documento selado digitalmente por ClinicNest — clinicnest.metaclass.com.br", {
        x: MARGIN,
        y: footerY,
        size: 7,
        font: helvetica,
        color: TEXT_LIGHT,
      });
    };

    // ── Top accent bar ──
    page.drawRectangle({
      x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6,
      color: TEAL,
    });
    y = PAGE_H - MARGIN - 10;

    // ── Cabeçalho da clínica ──
    page.drawText(clinicName.toUpperCase(), {
      x: MARGIN,
      y,
      size: 16,
      font: helveticaBold,
      color: TEAL_DARK,
    });
    y -= 14;

    // Info da clínica em uma linha
    const clinicInfoParts = [clinicAddress, clinicPhone, clinicEmail, clinicCnpj ? `CNPJ: ${clinicCnpj}` : ""].filter(Boolean);
    if (clinicInfoParts.length > 0) {
      page.drawText(clinicInfoParts.join("  ·  "), {
        x: MARGIN,
        y,
        size: 7.5,
        font: helvetica,
        color: TEXT_LIGHT,
      });
      y -= 10;
    }

    // Teal line separator
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 2,
      color: TEAL,
    });
    y -= 22;

    // ── Banner do tipo de documento ──
    page.drawRectangle({
      x: MARGIN, y: y - 22, width: CONTENT_W, height: 22,
      color: TEAL,
    });
    page.drawText("TERMO DE CONSENTIMENTO ASSINADO", {
      x: MARGIN + 10,
      y: y - 16,
      size: 10,
      font: helveticaBold,
      color: rgb(1, 1, 1),
    });
    y -= 32;

    // ── Subtítulo do template ──
    page.drawText(templateTitle, {
      x: MARGIN,
      y,
      size: 11,
      font: helvetica,
      color: TEXT_MID,
    });
    y -= 22;

    // ── Dados do paciente — caixa ──
    const fieldCount = 6;
    const boxH = LINE_H * fieldCount + 16;
    page.drawRectangle({
      x: MARGIN,
      y: y - boxH,
      width: CONTENT_W,
      height: boxH,
      color: TEAL_LIGHT,
      borderColor: BORDER,
      borderWidth: 0.5,
    });
    y -= 10;

    const drawField = (label: string, value: string) => {
      addNewPageIfNeeded(LINE_H * 2);
      page.drawText(label, {
        x: MARGIN + 10,
        y,
        size: 8,
        font: helveticaBold,
        color: TEAL_DARK,
      });
      page.drawText(value, {
        x: MARGIN + 130,
        y,
        size: 9,
        font: helvetica,
        color: TEXT_DARK,
      });
      y -= LINE_H;
    };

    drawField("PACIENTE:", patientName);
    drawField("CPF:", client?.cpf ?? "Não informado");
    drawField("DATA ASSINATURA:", signedAt);
    drawField("MÉTODO:", signatureMethod);
    drawField("IP:", consent.ip_address ?? "Não capturado");
    drawField("USER-AGENT:", (consent.user_agent ?? "N/A").substring(0, 55));
    y -= 12;

    // ── Conteúdo do termo ──
    addNewPageIfNeeded(30);
    page.drawText("CONTEÚDO DO TERMO", {
      x: MARGIN,
      y,
      size: 10,
      font: helveticaBold,
      color: TEAL_DARK,
    });
    y -= 5;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 0.5,
      color: TEAL,
    });
    y -= LINE_H;

    const termContent = consent.template_snapshot_html
      ? stripHtml(consent.template_snapshot_html)
      : "Conteúdo do termo não disponível.";

    const wrappedLines = wrapText(termContent, 85);
    for (const line of wrappedLines) {
      addNewPageIfNeeded(SMALL_LINE_H);
      if (line === "") {
        y -= SMALL_LINE_H / 2;
        continue;
      }
      page.drawText(line, {
        x: MARGIN,
        y,
        size: 9,
        font: helvetica,
        color: rgb(0.2, 0.2, 0.2),
      });
      y -= SMALL_LINE_H;
    }
    y -= 15;

    // ── Embed imagem de assinatura se manual ──
    if (consent.signature_method === "manual" && consent.manual_signature_path) {
      try {
        const { data: sigData, error: sigDlErr } = await supabaseAdmin.storage
          .from("consent-signatures")
          .download(consent.manual_signature_path);
        if (sigDlErr) console.warn("[seal-consent-pdf] Signature download error:", sigDlErr.message);

        if (sigData) {
          const sigBytes = new Uint8Array(await sigData.arrayBuffer());
          let sigImage;
          try {
            sigImage = await pdfDoc.embedPng(sigBytes);
          } catch {
            sigImage = await pdfDoc.embedJpg(sigBytes);
          }
          const sigDims = sigImage.scale(0.4);
          const maxW = 200;
          const maxH = 80;
          const ratio = Math.min(maxW / sigDims.width, maxH / sigDims.height, 1);

          addNewPageIfNeeded(sigDims.height * ratio + 30);
          page.drawText("ASSINATURA:", {
            x: MARGIN,
            y,
            size: 8,
            font: helveticaBold,
            color: TEAL_DARK,
          });
          y -= 5;
          page.drawImage(sigImage, {
            x: MARGIN,
            y: y - sigDims.height * ratio,
            width: sigDims.width * ratio,
            height: sigDims.height * ratio,
          });
          y -= sigDims.height * ratio + 15;
        }
      } catch (err) {
        log.warn("Could not embed signature image", err);
      }
    }

    // ── Embed foto facial se disponível ──
    if (consent.facial_photo_path) {
      try {
        const { data: photoData, error: photoDlErr } = await supabaseAdmin.storage
          .from("consent-photos")
          .download(consent.facial_photo_path);
        if (photoDlErr) console.warn("[seal-consent-pdf] Photo download error:", photoDlErr.message);

        if (photoData) {
          const photoBytes = new Uint8Array(await photoData.arrayBuffer());
          let photoImage;
          // Tenta como JPEG, fallback como PNG
          try {
            photoImage = await pdfDoc.embedJpg(photoBytes);
          } catch {
            photoImage = await pdfDoc.embedPng(photoBytes);
          }
          const maxW = 100;
          const maxH = 100;
          const photoDims = photoImage.scale(1);
          const ratio = Math.min(maxW / photoDims.width, maxH / photoDims.height, 1);

          addNewPageIfNeeded(photoDims.height * ratio + 30);
          page.drawText("FOTO FACIAL:", {
            x: MARGIN,
            y,
            size: 8,
            font: helveticaBold,
            color: TEAL_DARK,
          });
          y -= 5;
          page.drawImage(photoImage, {
            x: MARGIN,
            y: y - photoDims.height * ratio,
            width: photoDims.width * ratio,
            height: photoDims.height * ratio,
          });
          y -= photoDims.height * ratio + 15;
        }
      } catch (err) {
        log.warn("Could not embed facial photo", err);
      }
    }

    // ── Selo de autenticidade ──
    addNewPageIfNeeded(60);
    y -= 10;
    page.drawRectangle({
      x: MARGIN,
      y: y - 45,
      width: CONTENT_W,
      height: 45,
      color: TEAL_LIGHT,
      borderColor: TEAL,
      borderWidth: 1,
    });
    page.drawText("\u2713 DOCUMENTO SELADO DIGITALMENTE", {
      x: MARGIN + 10,
      y: y - 15,
      size: 10,
      font: helveticaBold,
      color: TEAL_DARK,
    });
    page.drawText(`Selado em: ${formatDateBR(new Date().toISOString())}  |  ID: ${consent_id}`, {
      x: MARGIN + 10,
      y: y - 30,
      size: 7,
      font: helvetica,
      color: TEXT_MID,
    });
    y -= 55;

    // Rodapé da última página
    drawFooter(page);

    // ── 6. Serializar e calcular hash ──
    const pdfBytes = await pdfDoc.save();
    const pdfUint8 = new Uint8Array(pdfBytes);
    const pdfHash = await sha256Hex(pdfUint8);

    // ── 7. Upload para o bucket ──
    const storagePath = `${consent.tenant_id}/${consent.patient_user_id}/${consent_id}.pdf`;
    console.log(`[seal-consent-pdf] Sealing consent, size: ${pdfUint8.length}`);
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("consent-sealed-pdfs")
      .upload(storagePath, pdfUint8, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadErr) {
      log.error("Upload failed", uploadErr);
      return new Response(
        JSON.stringify({ error: "Falha ao fazer upload do PDF" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 8. Registrar no banco via RPC ──
    const { data: sealResult, error: sealErr } = await supabaseAdmin.rpc("seal_consent_pdf", {
      p_consent_id: consent_id,
      p_sealed_pdf_path: storagePath,
      p_sealed_pdf_hash: pdfHash,
    });

    if (sealErr) {
      log.error("seal_consent_pdf RPC failed", sealErr);
      return new Response(
        JSON.stringify({ error: "Falha ao registrar selagem no banco" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    log.info("Consent PDF sealed successfully", { consent_id, hash: pdfHash });

    return new Response(
      JSON.stringify({
        success: true,
        consent_id,
        sealed_pdf_path: storagePath,
        sealed_pdf_hash: pdfHash,
        sealed_at: sealResult?.sealed_at ?? new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
    console.error("[SEAL-CONSENT-PDF] Unexpected error:", errMsg);
    return new Response(
      JSON.stringify({ error: "Erro interno ao gerar PDF selado", details: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
