/**
 * Edge Function: rnds-submit
 * 
 * Processa submissões pendentes para a RNDS (Rede Nacional de Dados em Saúde).
 * Executa em background, processando lotes de submissões.
 * 
 * Fluxo:
 * 1. Busca submissões pendentes no banco
 * 2. Para cada submissão:
 *    a. Obtém token de acesso (ou usa cache)
 *    b. Envia Bundle FHIR para RNDS
 *    c. Atualiza status no banco
 * 3. Implementa retry com backoff exponencial
 * 
 * Trigger: Cron job ou chamada manual
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import * as forge from 'https://esm.sh/node-forge@1.3.1';

// ─── Configuração ──────────────────────────────────────────────────────────────

const RNDS_ENVIRONMENTS = {
  homologacao: {
    authUrl: 'https://ehr-auth-hmg.saude.gov.br/api/token',
    fhirUrl: 'https://ehr-services-hmg.saude.gov.br/api/fhir/r4',
  },
  producao: {
    authUrl: 'https://ehr-auth.saude.gov.br/api/token',
    fhirUrl: 'https://ehr-services.saude.gov.br/api/fhir/r4',
  },
};

const BATCH_SIZE = 10;
const JWT_EXPIRY_SECONDS = 300;

// ─── Tipos ─────────────────────────────────────────────────────────────────────

interface Submission {
  id: string;
  tenant_id: string;
  resource_type: string;
  resource_id: string;
  fhir_bundle: Record<string, unknown>;
  attempt_count: number;
  rnds_cnes: string;
  rnds_uf: string;
  rnds_environment: 'homologacao' | 'producao';
}

interface TokenCache {
  [tenantId: string]: {
    accessToken: string;
    expiresAt: number;
  };
}

// ─── Cache de tokens ───────────────────────────────────────────────────────────

const tokenCache: TokenCache = {};

// ─── Funções auxiliares ────────────────────────────────────────────────────────

function base64UrlEncode(data: string): string {
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function generateSignedJWT(
  cnes: string,
  authUrl: string,
  certificateData: string,
  password: string
): Promise<string> {
  const p12Der = forge.util.decode64(certificateData);
  const p12Asn1 = forge.asn1.fromDer(p12Der);
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
  
  const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  
  if (!keyBag?.key) {
    throw new Error('Chave privada não encontrada no certificado');
  }
  
  const privateKey = keyBag.key;
  
  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: cnes,
    sub: cnes,
    aud: authUrl,
    iat: now,
    exp: now + JWT_EXPIRY_SECONDS,
    jti: crypto.randomUUID(),
  };
  
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;
  
  const md = forge.md.sha256.create();
  md.update(dataToSign, 'utf8');
  const signature = privateKey.sign(md);
  const encodedSignature = base64UrlEncode(signature);
  
  return `${dataToSign}.${encodedSignature}`;
}

async function getAccessToken(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  cnes: string,
  environment: 'homologacao' | 'producao'
): Promise<string | null> {
  const cached = tokenCache[tenantId];
  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.accessToken;
  }
  
  const { data: existingToken } = await supabase
    .from('rnds_tokens')
    .select('access_token, expires_at')
    .eq('tenant_id', tenantId)
    .gt('expires_at', new Date().toISOString())
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();
  
  if (existingToken) {
    tokenCache[tenantId] = {
      accessToken: existingToken.access_token,
      expiresAt: new Date(existingToken.expires_at).getTime(),
    };
    return existingToken.access_token;
  }
  
  const { data: certificate } = await supabase
    .from('rnds_certificates')
    .select('certificate_data, password_hash')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .single();
  
  if (!certificate) {
    console.error(`Certificado não encontrado para tenant ${tenantId}`);
    return null;
  }
  
  try {
    const urls = RNDS_ENVIRONMENTS[environment];
    const jwt = await generateSignedJWT(
      cnes,
      urls.authUrl,
      certificate.certificate_data,
      certificate.password_hash || ''
    );
    
    const response = await fetch(urls.authUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      console.error(`Erro ao obter token RNDS: ${error}`);
      return null;
    }
    
    const tokenData = await response.json();
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + (tokenData.expires_in || 3600));
    
    await supabase.from('rnds_tokens').insert({
      tenant_id: tenantId,
      access_token: tokenData.access_token,
      token_type: tokenData.token_type,
      expires_at: expiresAt.toISOString(),
      scope: tokenData.scope,
    });
    
    tokenCache[tenantId] = {
      accessToken: tokenData.access_token,
      expiresAt: expiresAt.getTime(),
    };
    
    return tokenData.access_token;
  } catch (error) {
    console.error(`Erro ao gerar token RNDS: ${error}`);
    return null;
  }
}

async function submitToRNDS(
  submission: Submission,
  accessToken: string
): Promise<{ success: boolean; protocol?: string; error?: { code: string; message: string } }> {
  const urls = RNDS_ENVIRONMENTS[submission.rnds_environment];
  
  try {
    const response = await fetch(urls.fhirUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/fhir+json',
        'Accept': 'application/fhir+json',
        'X-Authorization-Server': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(submission.fhir_bundle),
    });
    
    const responseData = await response.json().catch(() => null);
    
    if (response.ok) {
      const protocol = response.headers.get('X-Request-Id') ||
                      response.headers.get('Location')?.split('/').pop() ||
                      responseData?.id;
      
      return { success: true, protocol };
    }
    
    const errorCode = responseData?.issue?.[0]?.code || response.status.toString();
    const errorMessage = responseData?.issue?.[0]?.diagnostics ||
                        responseData?.message ||
                        `Erro HTTP ${response.status}`;
    
    return {
      success: false,
      error: { code: errorCode, message: errorMessage },
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Erro de conexão',
      },
    };
  }
}

// ─── Handler principal ─────────────────────────────────────────────────────────

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: submissions, error: fetchError } = await supabase
      .rpc('get_pending_rnds_submissions', { p_limit: BATCH_SIZE });

    if (fetchError) {
      throw new Error(`Erro ao buscar submissões: ${fetchError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      return new Response(
        JSON.stringify({ message: 'Nenhuma submissão pendente', processed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results = {
      processed: 0,
      success: 0,
      errors: 0,
      retries: 0,
    };

    for (const submission of submissions as Submission[]) {
      results.processed++;

      const accessToken = await getAccessToken(
        supabase,
        submission.tenant_id,
        submission.rnds_cnes,
        submission.rnds_environment
      );

      if (!accessToken) {
        await supabase.rpc('update_rnds_submission_status', {
          p_submission_id: submission.id,
          p_status: 'error',
          p_error_message: 'Não foi possível obter token de acesso',
          p_error_code: 'AUTH_FAILED',
        });
        results.errors++;
        continue;
      }

      const result = await submitToRNDS(submission, accessToken);

      if (result.success) {
        await supabase.rpc('update_rnds_submission_status', {
          p_submission_id: submission.id,
          p_status: 'success',
          p_rnds_protocol: result.protocol,
        });
        results.success++;
      } else {
        const isRetryable = ['NETWORK_ERROR', 'timeout', 'transient', 'throttled']
          .includes(result.error?.code || '');
        
        const maxAttempts = 3;
        const shouldRetry = isRetryable && submission.attempt_count < maxAttempts - 1;

        await supabase.rpc('update_rnds_submission_status', {
          p_submission_id: submission.id,
          p_status: shouldRetry ? 'retry' : 'error',
          p_error_message: result.error?.message,
          p_error_code: result.error?.code,
        });

        if (shouldRetry) {
          results.retries++;
        } else {
          results.errors++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Processamento concluído',
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro no rnds-submit:', error);
    
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro interno',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
