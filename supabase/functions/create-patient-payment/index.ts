import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const log = createLogger("CREATE-PATIENT-PAYMENT");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface CreatePaymentBody {
  invoice_id: string;
  payment_method?: "gateway" | "pix" | "boleto";
  return_url?: string;
}

interface PaymentGatewayConfig {
  provider: "stripe" | "pagseguro" | "asaas";
  api_key: string;
}

/**
 * Stripe Payment Links API
 * Docs: https://docs.stripe.com/api/payment-link/create
 * Cria um link de pagamento reutilizável
 */
async function createStripePaymentLink(
  apiKey: string,
  amount: number,
  description: string,
  metadata: Record<string, string>,
  returnUrl: string
): Promise<{ url: string; payment_id: string } | null> {
  try {
    // Primeiro, criar um produto inline
    const productResponse = await fetch("https://api.stripe.com/v1/products", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "name": description,
        "metadata[invoice_id]": metadata.invoice_id,
        "metadata[tenant_id]": metadata.tenant_id,
      }),
    });

    if (!productResponse.ok) {
      const error = await productResponse.text();
      log("Stripe: Erro ao criar produto", { error });
      return null;
    }

    const product = await productResponse.json();

    // Criar um price para o produto
    const priceResponse = await fetch("https://api.stripe.com/v1/prices", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "product": product.id,
        "unit_amount": String(Math.round(amount * 100)), // Stripe usa centavos
        "currency": "brl",
      }),
    });

    if (!priceResponse.ok) {
      const error = await priceResponse.text();
      log("Stripe: Erro ao criar price", { error });
      return null;
    }

    const price = await priceResponse.json();

    // Criar Payment Link conforme docs oficiais
    // POST /v1/payment_links
    const paymentLinkResponse = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "line_items[0][price]": price.id,
        "line_items[0][quantity]": "1",
        "after_completion[type]": "redirect",
        "after_completion[redirect][url]": `${returnUrl}?status=success&invoice_id=${metadata.invoice_id}`,
        "metadata[invoice_id]": metadata.invoice_id,
        "metadata[tenant_id]": metadata.tenant_id,
        "metadata[patient_id]": metadata.patient_id,
      }),
    });

    if (!paymentLinkResponse.ok) {
      const error = await paymentLinkResponse.text();
      log("Stripe: Erro ao criar payment link", { error });
      return null;
    }

    const paymentLink = await paymentLinkResponse.json();
    log("Stripe: Payment link criado", { id: paymentLink.id });
    
    return { 
      url: paymentLink.url, 
      payment_id: paymentLink.id 
    };
  } catch (error) {
    log("Stripe: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * PagBank (PagSeguro) Checkout API
 * Docs: https://developer.pagbank.com.br/reference/criar-checkout
 * Endpoint: POST /checkouts
 */
async function createPagSeguroPaymentLink(
  apiKey: string,
  amount: number,
  description: string,
  metadata: Record<string, string>,
  returnUrl: string
): Promise<{ url: string; payment_id: string } | null> {
  try {
    // PagBank API v4 - Criar Checkout
    // Docs: https://developer.pagbank.com.br/reference/criar-checkout
    const response = await fetch("https://api.pagseguro.com/checkouts", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-api-version": "4.0",
      },
      body: JSON.stringify({
        reference_id: metadata.invoice_id,
        expiration_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        customer_modifiable: true,
        items: [
          {
            reference_id: metadata.invoice_id,
            name: description.substring(0, 64), // Max 64 chars
            quantity: 1,
            unit_amount: Math.round(amount * 100), // PagBank usa centavos
          },
        ],
        additional_amount: 0,
        discount_amount: 0,
        payment_methods: [
          { type: "CREDIT_CARD" },
          { type: "DEBIT_CARD" },
          { type: "BOLETO" },
          { type: "PIX" },
        ],
        payment_methods_configs: [
          {
            type: "CREDIT_CARD",
            config_options: [
              { option: "INSTALLMENTS_LIMIT", value: "12" },
            ],
          },
        ],
        soft_descriptor: "CLINICNEST", // Max 13 chars, aparece na fatura do cartão
        redirect_urls: {
          return_url: `${returnUrl}?status=success&invoice_id=${metadata.invoice_id}`,
        },
        notification_urls: [
          `${SUPABASE_URL}/functions/v1/pagseguro-webhook`,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log("PagSeguro: Erro ao criar checkout", { status: response.status, error });
      return null;
    }

    const checkout = await response.json();
    
    // O link de pagamento vem no array links com rel "PAY"
    const payLink = checkout.links?.find((l: { rel: string; href: string }) => l.rel === "PAY");
    
    if (!payLink) {
      log("PagSeguro: Link PAY não encontrado na resposta", { checkout });
      return null;
    }

    log("PagSeguro: Checkout criado", { id: checkout.id });
    
    return { 
      url: payLink.href, 
      payment_id: checkout.id 
    };
  } catch (error) {
    log("PagSeguro: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Asaas API v3 - Criar Cobrança
 * Docs: https://docs.asaas.com/reference/criar-nova-cobranca
 * Endpoint: POST /v3/payments
 * 
 * billingType "UNDEFINED" permite que o cliente escolha a forma de pagamento
 */
async function createAsaasPaymentLink(
  apiKey: string,
  amount: number,
  description: string,
  customerEmail: string,
  customerName: string,
  customerCpfCnpj: string | null,
  metadata: Record<string, string>,
  dueDate: string
): Promise<{ url: string; payment_id: string } | null> {
  try {
    // Ambiente sandbox ou produção
    const baseUrl = Deno.env.get("ASAAS_SANDBOX") === "true"
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    // 1. Buscar ou criar cliente no Asaas
    // Docs: https://docs.asaas.com/reference/criar-novo-cliente
    let customerId: string | null = null;
    
    // Buscar cliente existente por email
    const searchResponse = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(customerEmail)}`, 
      {
        headers: { 
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.data?.length > 0) {
        customerId = searchResult.data[0].id;
        log("Asaas: Cliente encontrado", { customerId });
      }
    }

    // Se não encontrou, criar novo cliente
    if (!customerId) {
      const createCustomerResponse = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpfCnpj || undefined, // CPF/CNPJ é opcional mas recomendado
          externalReference: metadata.patient_id,
          notificationDisabled: false, // Asaas envia notificações ao cliente
        }),
      });

      if (createCustomerResponse.ok) {
        const newCustomer = await createCustomerResponse.json();
        customerId = newCustomer.id;
        log("Asaas: Cliente criado", { customerId });
      } else {
        const error = await createCustomerResponse.text();
        log("Asaas: Erro ao criar cliente", { error });
        return null;
      }
    }

    if (!customerId) {
      log("Asaas: Não foi possível obter ID do cliente");
      return null;
    }

    // 2. Criar cobrança
    // Docs: https://docs.asaas.com/reference/criar-nova-cobranca
    // billingType "UNDEFINED" = cliente escolhe (PIX, Boleto ou Cartão)
    const paymentResponse = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "UNDEFINED", // Cliente escolhe a forma de pagamento
        value: amount, // Asaas usa valor em reais (não centavos)
        dueDate: dueDate, // Formato: YYYY-MM-DD
        description: description.substring(0, 500), // Max 500 chars
        externalReference: metadata.invoice_id,
        postalService: false, // Não enviar boleto pelos correios
      }),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      log("Asaas: Erro ao criar cobrança", { status: paymentResponse.status, error });
      return null;
    }

    const payment = await paymentResponse.json();
    
    // invoiceUrl é o link para o cliente pagar
    if (!payment.invoiceUrl) {
      log("Asaas: invoiceUrl não retornado", { payment });
      return null;
    }

    log("Asaas: Cobrança criada", { id: payment.id, invoiceUrl: payment.invoiceUrl });
    
    return { 
      url: payment.invoiceUrl, 
      payment_id: payment.id 
    };
  } catch (error) {
    log("Asaas: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Asaas API v3 - Criar Cobrança PIX
 * Docs: https://docs.asaas.com/reference/criar-nova-cobranca
 * Retorna QR Code e código copia-e-cola
 */
async function createAsaasPix(
  apiKey: string,
  amount: number,
  description: string,
  customerEmail: string,
  customerName: string,
  customerCpfCnpj: string | null,
  metadata: Record<string, string>,
  dueDate: string
): Promise<{ payment_id: string; pix: { qr_code: string; qr_code_base64: string; copy_paste: string; expiration: string } } | null> {
  try {
    const baseUrl = Deno.env.get("ASAAS_SANDBOX") === "true"
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    // Buscar ou criar cliente
    let customerId: string | null = null;
    
    const searchResponse = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(customerEmail)}`, 
      {
        headers: { 
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.data?.length > 0) {
        customerId = searchResult.data[0].id;
      }
    }

    if (!customerId) {
      const createCustomerResponse = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpfCnpj || undefined,
          externalReference: metadata.patient_id,
          notificationDisabled: false,
        }),
      });

      if (createCustomerResponse.ok) {
        const newCustomer = await createCustomerResponse.json();
        customerId = newCustomer.id;
      } else {
        return null;
      }
    }

    if (!customerId) return null;

    // Criar cobrança com billingType PIX
    const paymentResponse = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "PIX",
        value: amount,
        dueDate: dueDate,
        description: description.substring(0, 500),
        externalReference: metadata.invoice_id,
      }),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      log("Asaas PIX: Erro ao criar cobrança", { error });
      return null;
    }

    const payment = await paymentResponse.json();

    // Buscar QR Code do PIX
    // Docs: https://docs.asaas.com/reference/recuperar-qr-code-pix
    const pixResponse = await fetch(`${baseUrl}/payments/${payment.id}/pixQrCode`, {
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
    });

    if (!pixResponse.ok) {
      log("Asaas PIX: Erro ao buscar QR Code");
      return null;
    }

    const pixData = await pixResponse.json();

    log("Asaas PIX: Cobrança criada", { id: payment.id });

    return {
      payment_id: payment.id,
      pix: {
        qr_code: pixData.encodedImage || "",
        qr_code_base64: pixData.encodedImage || "",
        copy_paste: pixData.payload || "",
        expiration: pixData.expirationDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  } catch (error) {
    log("Asaas PIX: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * PagBank PIX API
 * Docs: https://developer.pagbank.com.br/reference/criar-pedido-pix
 */
async function createPagSeguroPix(
  apiKey: string,
  amount: number,
  description: string,
  metadata: Record<string, string>
): Promise<{ payment_id: string; pix: { qr_code: string; qr_code_base64: string; copy_paste: string; expiration: string } } | null> {
  try {
    // PagBank API - Criar pedido com PIX
    const response = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-api-version": "4.0",
      },
      body: JSON.stringify({
        reference_id: metadata.invoice_id,
        customer: {
          name: "Paciente",
          email: "paciente@email.com",
        },
        items: [
          {
            reference_id: metadata.invoice_id,
            name: description.substring(0, 64),
            quantity: 1,
            unit_amount: Math.round(amount * 100),
          },
        ],
        qr_codes: [
          {
            amount: {
              value: Math.round(amount * 100),
            },
            expiration_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
        ],
        notification_urls: [
          `${SUPABASE_URL}/functions/v1/pagseguro-webhook`,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log("PagSeguro PIX: Erro", { error });
      return null;
    }

    const order = await response.json();
    const qrCode = order.qr_codes?.[0];

    if (!qrCode) {
      log("PagSeguro PIX: QR Code não retornado");
      return null;
    }

    // Buscar imagem do QR Code
    const qrCodeLink = qrCode.links?.find((l: { rel: string }) => l.rel === "QRCODE.PNG");

    return {
      payment_id: order.id,
      pix: {
        qr_code: qrCodeLink?.href || "",
        qr_code_base64: "", // PagSeguro retorna URL, não base64
        copy_paste: qrCode.text || "",
        expiration: qrCode.expiration_date || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    };
  } catch (error) {
    log("PagSeguro PIX: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * Asaas API v3 - Criar Boleto
 * Docs: https://docs.asaas.com/reference/criar-nova-cobranca
 * Retorna linha digitável e PDF do boleto
 */
async function createAsaasBoleto(
  apiKey: string,
  amount: number,
  description: string,
  customerEmail: string,
  customerName: string,
  customerCpfCnpj: string | null,
  metadata: Record<string, string>,
  dueDate: string
): Promise<{ payment_id: string; boleto: { barcode: string; barcode_formatted: string; pdf_url: string; due_date: string } } | null> {
  try {
    const baseUrl = Deno.env.get("ASAAS_SANDBOX") === "true"
      ? "https://sandbox.asaas.com/api/v3"
      : "https://api.asaas.com/v3";

    // Buscar ou criar cliente
    let customerId: string | null = null;
    
    const searchResponse = await fetch(
      `${baseUrl}/customers?email=${encodeURIComponent(customerEmail)}`, 
      {
        headers: { 
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
      }
    );
    
    if (searchResponse.ok) {
      const searchResult = await searchResponse.json();
      if (searchResult.data?.length > 0) {
        customerId = searchResult.data[0].id;
      }
    }

    if (!customerId) {
      const createCustomerResponse = await fetch(`${baseUrl}/customers`, {
        method: "POST",
        headers: {
          "access_token": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName,
          email: customerEmail,
          cpfCnpj: customerCpfCnpj || undefined,
          externalReference: metadata.patient_id,
          notificationDisabled: false,
        }),
      });

      if (createCustomerResponse.ok) {
        const newCustomer = await createCustomerResponse.json();
        customerId = newCustomer.id;
      } else {
        return null;
      }
    }

    if (!customerId) return null;

    // Criar cobrança com billingType BOLETO
    const paymentResponse = await fetch(`${baseUrl}/payments`, {
      method: "POST",
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        customer: customerId,
        billingType: "BOLETO",
        value: amount,
        dueDate: dueDate,
        description: description.substring(0, 500),
        externalReference: metadata.invoice_id,
      }),
    });

    if (!paymentResponse.ok) {
      const error = await paymentResponse.text();
      log("Asaas Boleto: Erro ao criar cobrança", { error });
      return null;
    }

    const payment = await paymentResponse.json();

    // Buscar linha digitável do boleto
    // Docs: https://docs.asaas.com/reference/recuperar-linha-digitavel
    const boletoResponse = await fetch(`${baseUrl}/payments/${payment.id}/identificationField`, {
      headers: {
        "access_token": apiKey,
        "Content-Type": "application/json",
      },
    });

    let barcodeFormatted = "";
    let barcode = "";
    
    if (boletoResponse.ok) {
      const boletoData = await boletoResponse.json();
      barcodeFormatted = boletoData.identificationField || "";
      barcode = boletoData.barCode || "";
    }

    log("Asaas Boleto: Cobrança criada", { id: payment.id });

    return {
      payment_id: payment.id,
      boleto: {
        barcode: barcode,
        barcode_formatted: barcodeFormatted,
        pdf_url: payment.bankSlipUrl || "",
        due_date: dueDate,
      },
    };
  } catch (error) {
    log("Asaas Boleto: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * PagBank Boleto API
 * Docs: https://developer.pagbank.com.br/reference/criar-pedido-boleto
 */
async function createPagSeguroBoleto(
  apiKey: string,
  amount: number,
  description: string,
  customerName: string,
  customerEmail: string,
  customerCpf: string | null,
  metadata: Record<string, string>,
  dueDate: string
): Promise<{ payment_id: string; boleto: { barcode: string; barcode_formatted: string; pdf_url: string; due_date: string } } | null> {
  try {
    const response = await fetch("https://api.pagseguro.com/orders", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "x-api-version": "4.0",
      },
      body: JSON.stringify({
        reference_id: metadata.invoice_id,
        customer: {
          name: customerName,
          email: customerEmail,
          tax_id: customerCpf?.replace(/\D/g, "") || undefined,
        },
        items: [
          {
            reference_id: metadata.invoice_id,
            name: description.substring(0, 64),
            quantity: 1,
            unit_amount: Math.round(amount * 100),
          },
        ],
        charges: [
          {
            reference_id: metadata.invoice_id,
            description: description.substring(0, 64),
            amount: {
              value: Math.round(amount * 100),
              currency: "BRL",
            },
            payment_method: {
              type: "BOLETO",
              boleto: {
                due_date: dueDate,
                instruction_lines: {
                  line_1: "Pagamento referente a serviços de saúde",
                  line_2: "Não receber após o vencimento",
                },
                holder: {
                  name: customerName,
                  tax_id: customerCpf?.replace(/\D/g, "") || "00000000000",
                  email: customerEmail,
                  address: {
                    country: "BRA",
                    region: "SP",
                    region_code: "SP",
                    city: "São Paulo",
                    postal_code: "01310100",
                    street: "Av Paulista",
                    number: "1000",
                    locality: "Bela Vista",
                  },
                },
              },
            },
          },
        ],
        notification_urls: [
          `${SUPABASE_URL}/functions/v1/pagseguro-webhook`,
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      log("PagSeguro Boleto: Erro", { error });
      return null;
    }

    const order = await response.json();
    const charge = order.charges?.[0];
    const boleto = charge?.payment_method?.boleto;

    if (!boleto) {
      log("PagSeguro Boleto: Dados do boleto não retornados");
      return null;
    }

    // Buscar link do PDF
    const pdfLink = charge.links?.find((l: { rel: string }) => l.rel === "BOLETO.PDF");

    return {
      payment_id: order.id,
      boleto: {
        barcode: boleto.barcode || "",
        barcode_formatted: boleto.formatted_barcode || boleto.barcode || "",
        pdf_url: pdfLink?.href || "",
        due_date: dueDate,
      },
    };
  } catch (error) {
    log("PagSeguro Boleto: Exceção", { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUserWithTenant(req, cors);
  if (authResult.error) return authResult.error;
  const { user, tenantId } = authResult;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "Configuração do servidor incompleta" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  try {
    const rl = await checkRateLimit(`payment:${user.id}`, 20, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const body: CreatePaymentBody = await req.json();
    const { invoice_id, payment_method = "gateway", return_url } = body;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "invoice_id é obrigatório" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    log("Criando link de pagamento", { invoice_id, tenantId });

    // Buscar fatura
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from("patient_invoices")
      .select(`
        id,
        amount,
        description,
        due_date,
        status,
        patient_id,
        tenant_id,
        external_payment_id,
        payment_url
      `)
      .eq("id", invoice_id)
      .eq("tenant_id", tenantId)
      .single();

    if (invoiceError || !invoice) {
      return new Response(
        JSON.stringify({ error: "Fatura não encontrada" }),
        { status: 404, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    if (invoice.status === "paid") {
      return new Response(
        JSON.stringify({ error: "Esta fatura já foi paga" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Se já tem link, retornar o existente
    if (invoice.payment_url && invoice.external_payment_id) {
      return new Response(
        JSON.stringify({
          success: true,
          payment_url: invoice.payment_url,
          payment_id: invoice.external_payment_id,
          message: "Link de pagamento já existente",
        }),
        { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do paciente
    const { data: patient, error: patientError } = await supabaseAdmin
      .from("clients")
      .select("id, name, email, cpf")
      .eq("id", invoice.patient_id)
      .single();

    if (patientError || !patient?.email) {
      return new Response(
        JSON.stringify({ error: "Paciente não encontrado ou sem email" }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração do gateway da clínica
    const { data: tenantData } = await supabaseAdmin
      .from("tenants")
      .select("payment_gateway_type, payment_gateway_config")
      .eq("id", tenantId)
      .single();

    const gatewayConfig: PaymentGatewayConfig = {
      provider: (tenantData?.payment_gateway_type as PaymentGatewayConfig["provider"]) || "stripe",
      api_key: (tenantData?.payment_gateway_config as { api_key?: string } | null)?.api_key || "",
    };

    // Se a clínica não configurou, tentar usar chaves globais (fallback)
    if (!gatewayConfig.api_key) {
      const fallbackKeys: Record<string, string | undefined> = {
        stripe: Deno.env.get("STRIPE_SECRET_KEY"),
        pagseguro: Deno.env.get("PAGSEGURO_TOKEN"),
        asaas: Deno.env.get("ASAAS_API_KEY"),
      };
      gatewayConfig.api_key = fallbackKeys[gatewayConfig.provider] || "";
    }

    if (!gatewayConfig.api_key) {
      return new Response(
        JSON.stringify({ 
          error: "Gateway de pagamento não configurado. Configure nas Configurações da clínica.",
          code: "payment_gateway_not_configured"
        }),
        { status: 400, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const siteUrl = Deno.env.get("SITE_URL") || "https://clinicnest.metaclass.com.br";
    const finalReturnUrl = return_url || `${siteUrl}/paciente/financeiro`;

    const metadata = {
      invoice_id: invoice.id,
      tenant_id: tenantId,
      patient_id: invoice.patient_id,
    };

    // Calcular data de vencimento (padrão: 7 dias se não definido)
    const dueDate = invoice.due_date || 
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Se é PIX, gerar QR Code diretamente
    if (payment_method === "pix") {
      let pixResult: { payment_id: string; pix: { qr_code: string; qr_code_base64: string; copy_paste: string; expiration: string } } | null = null;

      switch (gatewayConfig.provider) {
        case "asaas":
          pixResult = await createAsaasPix(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            patient.email,
            patient.name,
            patient.cpf || null,
            metadata,
            dueDate
          );
          break;

        case "pagseguro":
          pixResult = await createPagSeguroPix(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            metadata
          );
          break;

        case "stripe": {
          // Stripe não tem PIX nativo no Brasil, redirecionar para checkout
          const stripeResult = await createStripePaymentLink(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            metadata,
            finalReturnUrl
          );
          if (stripeResult) {
            return new Response(
              JSON.stringify({
                success: true,
                payment_url: stripeResult.url,
                payment_id: stripeResult.payment_id,
                provider: "stripe",
                message: "Stripe não suporta PIX. Redirecionando para checkout.",
              }),
              { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
            );
          }
          break;
        }
      }

      if (pixResult) {
        // Salvar referência do pagamento
        await supabaseAdmin
          .from("patient_invoices")
          .update({
            external_payment_id: pixResult.payment_id,
            payment_gateway: gatewayConfig.provider,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice_id);

        log("PIX gerado com sucesso", { 
          invoice_id, 
          provider: gatewayConfig.provider,
          payment_id: pixResult.payment_id 
        });

        return new Response(
          JSON.stringify({
            success: true,
            payment_id: pixResult.payment_id,
            provider: gatewayConfig.provider,
            pix: pixResult.pix,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: "Falha ao gerar PIX. Verifique as credenciais do gateway.",
          code: "pix_generation_failed"
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Se é BOLETO, gerar boleto diretamente
    if (payment_method === "boleto") {
      let boletoResult: { payment_id: string; boleto: { barcode: string; barcode_formatted: string; pdf_url: string; due_date: string } } | null = null;

      // Calcular nova data de vencimento para 2ª via (3 dias úteis)
      const newDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      switch (gatewayConfig.provider) {
        case "asaas":
          boletoResult = await createAsaasBoleto(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            patient.email,
            patient.name,
            patient.cpf || null,
            metadata,
            newDueDate
          );
          break;

        case "pagseguro":
          boletoResult = await createPagSeguroBoleto(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            patient.name,
            patient.email,
            patient.cpf || null,
            metadata,
            newDueDate
          );
          break;

        case "stripe": {
          // Stripe não tem boleto nativo, redirecionar para checkout
          const stripeResult = await createStripePaymentLink(
            gatewayConfig.api_key,
            invoice.amount,
            invoice.description || "Pagamento de consulta",
            metadata,
            finalReturnUrl
          );
          if (stripeResult) {
            return new Response(
              JSON.stringify({
                success: true,
                payment_url: stripeResult.url,
                payment_id: stripeResult.payment_id,
                provider: "stripe",
                message: "Stripe não suporta boleto. Redirecionando para checkout.",
              }),
              { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
            );
          }
          break;
        }
      }

      if (boletoResult) {
        // Salvar referência do pagamento
        await supabaseAdmin
          .from("patient_invoices")
          .update({
            external_payment_id: boletoResult.payment_id,
            payment_gateway: gatewayConfig.provider,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoice_id);

        log("Boleto gerado com sucesso", { 
          invoice_id, 
          provider: gatewayConfig.provider,
          payment_id: boletoResult.payment_id 
        });

        return new Response(
          JSON.stringify({
            success: true,
            payment_id: boletoResult.payment_id,
            provider: gatewayConfig.provider,
            boleto: boletoResult.boleto,
          }),
          { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          error: "Falha ao gerar boleto. Verifique as credenciais do gateway.",
          code: "boleto_generation_failed"
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Fluxo normal: gerar link de pagamento
    let paymentResult: { url: string; payment_id: string } | null = null;

    switch (gatewayConfig.provider) {
      case "stripe":
        paymentResult = await createStripePaymentLink(
          gatewayConfig.api_key,
          invoice.amount,
          invoice.description || "Pagamento de consulta",
          metadata,
          finalReturnUrl
        );
        break;

      case "pagseguro":
        paymentResult = await createPagSeguroPaymentLink(
          gatewayConfig.api_key,
          invoice.amount,
          invoice.description || "Pagamento de consulta",
          metadata,
          finalReturnUrl
        );
        break;

      case "asaas":
        paymentResult = await createAsaasPaymentLink(
          gatewayConfig.api_key,
          invoice.amount,
          invoice.description || "Pagamento de consulta",
          patient.email,
          patient.name,
          patient.cpf || null,
          metadata,
          dueDate
        );
        break;
    }

    if (!paymentResult) {
      return new Response(
        JSON.stringify({ 
          error: "Falha ao criar link de pagamento. Verifique as credenciais do gateway.",
          code: "payment_link_creation_failed"
        }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    // Salvar link na fatura
    await supabaseAdmin
      .from("patient_invoices")
      .update({
        external_payment_id: paymentResult.payment_id,
        payment_url: paymentResult.url,
        payment_gateway: gatewayConfig.provider,
        updated_at: new Date().toISOString(),
      })
      .eq("id", invoice_id);

    log("Link de pagamento criado com sucesso", { 
      invoice_id, 
      provider: gatewayConfig.provider,
      payment_id: paymentResult.payment_id 
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_url: paymentResult.url,
        payment_id: paymentResult.payment_id,
        provider: gatewayConfig.provider,
      }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  } catch (error) {
    log("Erro", { error: error instanceof Error ? error.message : String(error) });
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro interno" }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }
});
