import { Spinner } from "@/components/ui/spinner";
/**
 * Componente de Configuração RNDS
 * 
 * Permite configurar a integração com a Rede Nacional de Dados em Saúde.
 * Inclui:
 * - Habilitar/desabilitar integração
 * - Configurar CNES e UF
 * - Upload de certificado ICP-Brasil
 * - Estatísticas de envio
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Save,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Activity,
  FileKey,
  Building2,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { validateCNES, validateUF } from '@/lib/rnds-client';

interface RNDSConfig {
  rnds_enabled: boolean;
  rnds_cnes: string | null;
  rnds_uf: string | null;
  rnds_environment: string | null;
  rnds_auto_send: boolean;
  rnds_last_sync_at: string | null;
  has_certificate: boolean;
  certificate_valid_to: string | null;
}

interface RNDSStatistics {
  total_submissions: number;
  pending_count: number;
  success_count: number;
  error_count: number;
  retry_count: number;
  success_rate: number;
  last_success_at: string | null;
  last_error_at: string | null;
}

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export function RNDSConfigTab() {
  const { tenant } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const [config, setConfig] = useState<RNDSConfig | null>(null);
  const [statistics, setStatistics] = useState<RNDSStatistics | null>(null);
  
  const [formData, setFormData] = useState({
    rnds_enabled: false,
    rnds_cnes: '',
    rnds_uf: '',
    rnds_environment: 'homologacao',
    rnds_auto_send: false,
  });
  
  const [certificateFile, setCertificateFile] = useState<File | null>(null);
  const [certificatePassword, setCertificatePassword] = useState('');
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  const loadConfig = useCallback(async () => {
    if (!tenant?.id) return;
    
    setIsLoading(true);
    try {
      const { data: configData, error: configError } = await supabase
        .rpc('get_tenant_rnds_config');
      
      if (configError) throw configError;
      
      if (configData && configData.length > 0) {
        const cfg = configData[0] as RNDSConfig;
        setConfig(cfg);
        setFormData({
          rnds_enabled: cfg.rnds_enabled || false,
          rnds_cnes: cfg.rnds_cnes || '',
          rnds_uf: cfg.rnds_uf || '',
          rnds_environment: cfg.rnds_environment || 'homologacao',
          rnds_auto_send: cfg.rnds_auto_send || false,
        });
      }
      
      const { data: statsData, error: statsError } = await supabase
        .rpc('get_rnds_statistics');
      
      if (!statsError && statsData && statsData.length > 0) {
        setStatistics(statsData[0] as RNDSStatistics);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração RNDS:', error);
      toast.error('Erro ao carregar configuração');
    } finally {
      setIsLoading(false);
    }
  }, [tenant?.id]);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (formData.rnds_enabled) {
      if (!formData.rnds_cnes) {
        newErrors.rnds_cnes = 'CNES é obrigatório';
      } else if (!validateCNES(formData.rnds_cnes)) {
        newErrors.rnds_cnes = 'CNES inválido (deve ter 7 dígitos)';
      }
      
      if (!formData.rnds_uf) {
        newErrors.rnds_uf = 'UF é obrigatória';
      } else if (!validateUF(formData.rnds_uf)) {
        newErrors.rnds_uf = 'UF inválida';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase.rpc('update_tenant_rnds_config', {
        p_rnds_enabled: formData.rnds_enabled,
        p_rnds_cnes: formData.rnds_cnes || null,
        p_rnds_uf: formData.rnds_uf || null,
        p_rnds_environment: formData.rnds_environment,
        p_rnds_auto_send: formData.rnds_auto_send,
      });
      
      if (error) throw error;
      
      toast.success('Configuração RNDS salva com sucesso');
      loadConfig();
    } catch (error) {
      console.error('Erro ao salvar configuração:', error);
      toast.error('Erro ao salvar configuração');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCertificateUpload = async () => {
    if (!certificateFile || !certificatePassword) {
      toast.error('Selecione o certificado e informe a senha');
      return;
    }
    
    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        
        if (!base64) {
          toast.error('Erro ao ler certificado');
          setIsUploading(false);
          return;
        }
        
        const { error } = await supabase.from('rnds_certificates').insert({
          tenant_id: tenant?.id,
          name: certificateFile.name,
          certificate_data: base64,
          password_hash: certificatePassword,
          valid_from: new Date().toISOString(),
          valid_to: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          is_active: true,
        });
        
        if (error) throw error;
        
        toast.success('Certificado enviado com sucesso');
        setCertificateFile(null);
        setCertificatePassword('');
        loadConfig();
      };
      
      reader.readAsDataURL(certificateFile);
    } catch (error) {
      console.error('Erro ao enviar certificado:', error);
      toast.error('Erro ao enviar certificado');
    } finally {
      setIsUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner size="lg" className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <Globe className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Integração RNDS</CardTitle>
              <CardDescription>
                Rede Nacional de Dados em Saúde — Ministério da Saúde
              </CardDescription>
            </div>
            <Badge variant={formData.rnds_enabled ? 'default' : 'secondary'}>
              {formData.rnds_enabled ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="rnds-enabled" className="cursor-pointer font-medium">
                Habilitar integração RNDS
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite envio de dados clínicos para a RNDS
              </p>
            </div>
            <Switch
              id="rnds-enabled"
              checked={formData.rnds_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, rnds_enabled: checked })}
            />
          </div>

          {formData.rnds_enabled && (
            <>
              {/* Configurações do estabelecimento */}
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="rnds-cnes">CNES do Estabelecimento *</Label>
                  <Input
                    id="rnds-cnes"
                    value={formData.rnds_cnes}
                    onChange={(e) => setFormData({ ...formData, rnds_cnes: e.target.value.replace(/\D/g, '').slice(0, 7) })}
                    placeholder="0000000"
                    maxLength={7}
                  />
                  {errors.rnds_cnes && (
                    <p className="text-sm text-destructive">{errors.rnds_cnes}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rnds-uf">UF *</Label>
                  <Select
                    value={formData.rnds_uf}
                    onValueChange={(value) => setFormData({ ...formData, rnds_uf: value })}
                  >
                    <SelectTrigger id="rnds-uf">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map((uf) => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.rnds_uf && (
                    <p className="text-sm text-destructive">{errors.rnds_uf}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="rnds-env">Ambiente</Label>
                  <Select
                    value={formData.rnds_environment}
                    onValueChange={(value) => setFormData({ ...formData, rnds_environment: value })}
                  >
                    <SelectTrigger id="rnds-env">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologação</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Auto-envio */}
              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="rnds-auto" className="cursor-pointer font-medium">
                    Envio automático
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enviar automaticamente após cada consulta concluída
                  </p>
                </div>
                <Switch
                  id="rnds-auto"
                  checked={formData.rnds_auto_send}
                  onCheckedChange={(checked) => setFormData({ ...formData, rnds_auto_send: checked })}
                />
              </div>
            </>
          )}

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Salvar Configuração
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Certificado Digital */}
      {formData.rnds_enabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                <FileKey className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle>Certificado Digital ICP-Brasil</CardTitle>
                <CardDescription>
                  Certificado A1 para autenticação na RNDS
                </CardDescription>
              </div>
              {config?.has_certificate ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  Não configurado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {config?.has_certificate && config.certificate_valid_to && (
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertTitle>Certificado ativo</AlertTitle>
                <AlertDescription>
                  Válido até: {new Date(config.certificate_valid_to).toLocaleDateString('pt-BR')}
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cert-file">Arquivo do Certificado (.pfx ou .p12)</Label>
                <Input
                  id="cert-file"
                  type="file"
                  accept=".pfx,.p12"
                  onChange={(e) => setCertificateFile(e.target.files?.[0] || null)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cert-password">Senha do Certificado</Label>
                <Input
                  id="cert-password"
                  type="password"
                  value={certificatePassword}
                  onChange={(e) => setCertificatePassword(e.target.value)}
                  placeholder="Digite a senha"
                />
              </div>
            </div>

            <Button
              onClick={handleCertificateUpload}
              disabled={isUploading || !certificateFile || !certificatePassword}
              variant="outline"
              className="w-full"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Enviar Certificado
                </>
              )}
            </Button>

            <p className="text-xs text-muted-foreground">
              O certificado é armazenado de forma segura e usado apenas para autenticação na RNDS.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas */}
      {formData.rnds_enabled && statistics && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
                <Activity className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <CardTitle>Estatísticas de Envio</CardTitle>
                <CardDescription>
                  Histórico de submissões para a RNDS
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={loadConfig}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* KPIs */}
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold">{statistics.total_submissions}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-green-600">{statistics.success_count}</p>
                <p className="text-sm text-muted-foreground">Sucesso</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-yellow-600">{statistics.pending_count}</p>
                <p className="text-sm text-muted-foreground">Pendentes</p>
              </div>
              <div className="rounded-lg border p-4 text-center">
                <p className="text-2xl font-bold text-red-600">{statistics.error_count}</p>
                <p className="text-sm text-muted-foreground">Erros</p>
              </div>
            </div>

            {/* Taxa de sucesso */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Taxa de sucesso</span>
                <span className="font-medium">{statistics.success_rate}%</span>
              </div>
              <Progress value={statistics.success_rate} className="h-2" />
            </div>

            {/* Últimas atividades */}
            <div className="grid gap-4 md:grid-cols-2">
              {statistics.last_success_at && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Último sucesso: {new Date(statistics.last_success_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {statistics.last_error_at && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <span>Último erro: {new Date(statistics.last_error_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
            </div>

            {statistics.retry_count > 0 && (
              <Alert variant="default">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Reenvios pendentes</AlertTitle>
                <AlertDescription>
                  {statistics.retry_count} submissão(ões) aguardando nova tentativa de envio.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-500/10 text-gray-600">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Sobre a RNDS</CardTitle>
              <CardDescription>
                Informações sobre a integração
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            A <strong>Rede Nacional de Dados em Saúde (RNDS)</strong> é a plataforma nacional de 
            interoperabilidade de dados em saúde do Ministério da Saúde. Ela permite o compartilhamento 
            de informações clínicas entre estabelecimentos de saúde de forma segura e padronizada.
          </p>
          
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm font-medium">Dados enviados para a RNDS:</p>
            <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
              <li>Contato Assistencial (consultas e atendimentos)</li>
              <li>Resultados de Exames Laboratoriais</li>
              <li>Registro de Imunização</li>
              <li>Atestados Digitais</li>
              <li>Prescrições Digitais</li>
            </ul>
          </div>

          <p className="text-xs text-muted-foreground">
            Para mais informações, acesse:{' '}
            <a 
              href="https://rnds.saude.gov.br" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              rnds.saude.gov.br
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
