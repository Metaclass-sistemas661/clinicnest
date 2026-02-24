import {
  Shield,
  Zap,
  Building2,
  FileText,
  Globe,
  Lock,
  Activity,
  CheckCircle,
  Clock,
  Database,
} from "lucide-react";
import { cn } from "@/lib/utils";

const integrations = [
  {
    category: "Interoperabilidade",
    items: [
      { name: "HL7 FHIR R4", description: "Padrão internacional", icon: Zap },
      { name: "API REST", description: "Documentação OpenAPI", icon: Activity },
      { name: "Webhooks", description: "Eventos em tempo real", icon: Globe },
      { name: "Export/Import", description: "CSV, PDF, Excel", icon: FileText },
    ],
  },
  {
    category: "Faturamento",
    items: [
      { name: "TISS 3.05", description: "Padrão ANS", icon: FileText },
      { name: "Multi-convênio", description: "Todas operadoras", icon: Building2 },
      { name: "XML Retorno", description: "Parser automático", icon: Activity },
      { name: "Recurso Glosas", description: "Workflow completo", icon: Shield },
    ],
  },
  {
    category: "Pagamentos",
    items: [
      { name: "Asaas", description: "Boleto, Pix, Cartão", icon: Activity },
      { name: "Split Payment", description: "Divisão automática", icon: Zap },
      { name: "Recorrência", description: "Cobranças automáticas", icon: FileText },
      { name: "Notificações", description: "Cobrança automática", icon: Globe },
    ],
  },
  {
    category: "Comunicação",
    items: [
      { name: "WhatsApp", description: "Confirmação automática", icon: Activity },
      { name: "Push Notifications", description: "PWA nativo", icon: Zap },
      { name: "E-mail", description: "Templates customizáveis", icon: FileText },
      { name: "SMS", description: "Lembretes", icon: Globe },
    ],
  },
];

const complianceFeatures = [
  {
    name: "LGPD",
    description: "Lei Geral de Proteção de Dados",
    icon: Shield,
    status: "Implementado",
    details: ["Gestão de consentimentos", "Direitos do titular", "Logs de acesso", "Política de privacidade"],
  },
  {
    name: "Retenção CFM",
    description: "Conselho Federal de Medicina",
    icon: Clock,
    status: "Implementado",
    details: ["Retenção 20 anos", "Prontuário eletrônico", "Backup automático", "Versionamento"],
  },
  {
    name: "TISS ANS",
    description: "Padrão de faturamento",
    icon: FileText,
    status: "Implementado",
    details: ["TISS 3.05", "4 tipos de guia", "XML padrão", "Lote automático"],
  },
  {
    name: "Assinatura Digital",
    description: "Certificados digitais",
    icon: Lock,
    status: "Implementado",
    details: ["Suporte a certificados", "Assinatura de documentos", "Validação", "Histórico"],
  },
  {
    name: "SNGPC",
    description: "Medicamentos controlados",
    icon: Activity,
    status: "Implementado",
    details: ["Livro de registro", "Geração de XML", "Rastreabilidade", "Alertas de vencimento"],
  },
  {
    name: "Segurança",
    description: "Proteção de dados",
    icon: Shield,
    status: "Implementado",
    details: ["Criptografia TLS", "RBAC granular", "RLS no banco", "Auditoria de acessos"],
  },
  {
    name: "Backup",
    description: "Continuidade de negócio",
    icon: Database,
    status: "Implementado",
    details: ["Backup diário", "Retenção 30 dias", "Recuperação rápida", "Redundância"],
  },
  {
    name: "Disponibilidade",
    description: "Infraestrutura confiável",
    icon: Zap,
    status: "Implementado",
    details: ["Alta disponibilidade", "CDN global", "Monitoramento 24/7", "Escalabilidade"],
  },
];

export function IntegrationsSection() {
  return (
    <section id="integracoes" className="py-20 sm:py-32 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 border border-blue-200 mb-6">
            <Zap className="h-4 w-4 text-blue-600" aria-hidden="true" />
            <span className="text-sm font-medium text-blue-600">Integrações & Segurança</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Conectado e{" "}
            <span className="bg-gradient-to-r from-blue-600 to-indigo-500 bg-clip-text text-transparent">
              seguro
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Integrações nativas com os principais sistemas e funcionalidades de segurança e compliance implementadas.
          </p>
        </div>

        <div className="mb-20">
          <h3 className="font-display text-2xl font-bold text-center mb-10">Integrações Disponíveis</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {integrations.map((group) => (
              <div key={group.category} className="p-6 rounded-2xl border bg-card">
                <h4 className="font-semibold text-lg mb-4 text-center">{group.category}</h4>
                <div className="space-y-3">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div key={item.name} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                          <Icon className="h-4 w-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="font-medium text-sm">{item.name}</p>
                          <p className="text-xs text-muted-foreground">{item.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="font-display text-2xl font-bold text-center mb-10">Segurança & Compliance</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {complianceFeatures.map((feature) => {
              const Icon = feature.icon;
              
              return (
                <div
                  key={feature.name}
                  className="group p-6 rounded-2xl border bg-card hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-blue-600" />
                    </div>
                    <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                      {feature.status}
                    </span>
                  </div>
                  <h4 className="font-display text-lg font-bold mb-1">{feature.name}</h4>
                  <p className="text-sm text-muted-foreground mb-4">{feature.description}</p>
                  <div className="space-y-1.5">
                    {feature.details.map((detail) => (
                      <div key={detail} className="flex items-center gap-2">
                        <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground">{detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-12 p-6 rounded-2xl bg-amber-50 border border-amber-200 max-w-3xl mx-auto">
          <p className="text-sm text-amber-800 text-center">
            <strong>Nota:</strong> O ClinicNest implementa funcionalidades que atendem aos requisitos técnicos de diversas regulamentações. 
            Certificações oficiais (SBIS, ONA, ISO) são processos independentes que dependem de auditoria externa e não estão incluídas no sistema.
          </p>
        </div>
      </div>
    </section>
  );
}
