import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTour } from "@/contexts/TourContext";
import {
  BookOpen,
  Search,
  Calendar,
  Users,
  Stethoscope,
  Package,
  DollarSign,
  UserCog,
  Settings,
  CreditCard,
  LifeBuoy,
  ArrowRight,
  Sparkles,
  PlayCircle,
} from "lucide-react";

type DocSection = {
  id: string;
  title: string;
  icon: React.ElementType;
  tags: string[];
  summary: string;
  steps: string[];
  actions: Array<{ label: string; href: string }>;
};

const SECTIONS: DocSection[] = [
  {
    id: "comecando",
    title: "Começando no ClinicNest",
    icon: Sparkles,
    tags: ["primeiro acesso", "configuração", "setup"],
    summary: "Configure o clínica, cadastre serviços e comece a usar a agenda em poucos minutos.",
    steps: [
      "Acesse Configurações e confira os dados do clínica.",
      "Cadastre seus serviços com preço e duração.",
      "Cadastre clientes (ou comece pela agenda e crie ao agendar).",
      "Comece a agendar e finalize atendimentos para alimentar o financeiro.",
    ],
    actions: [
      { label: "Abrir Configurações", href: "/configuracoes" },
      { label: "Abrir Serviços", href: "/servicos" },
      { label: "Abrir Agenda", href: "/agenda" },
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    tags: ["agendamentos", "horários", "rotina"],
    summary: "Agende, confirme e finalize atendimentos para manter tudo organizado.",
    steps: [
      "Crie um agendamento informando cliente, serviço, profissional e horário.",
      "Use status (confirmado/finalizado) para refletir a operação real.",
      "Finalize atendimentos para gerar dados confiáveis para metas e financeiro.",
    ],
    actions: [{ label: "Abrir Agenda", href: "/agenda" }],
  },
  {
    id: "clientes",
    title: "Clientes",
    icon: Users,
    tags: ["cadastro", "histórico", "fidelização"],
    summary: "Centralize dados, histórico e observações importantes de cada cliente.",
    steps: [
      "Cadastre nome, telefone e e-mail (opcional).",
      "Use observações para preferências e alergias.",
      "Acompanhe o histórico de gastos e atendimentos.",
    ],
    actions: [{ label: "Abrir Clientes", href: "/clientes" }],
  },
  {
    id: "servicos",
    title: "Serviços",
    icon: Stethoscope,
    tags: ["catálogo", "preço", "duração"],
    summary: "Mantenha um catálogo enxuto e claro para acelerar o agendamento.",
    steps: [
      "Crie serviços com duração real e preço final.",
      "Desative serviços antigos para manter a lista limpa.",
    ],
    actions: [{ label: "Abrir Serviços", href: "/servicos" }],
  },
  {
    id: "produtos",
    title: "Produtos & Estoque",
    icon: Package,
    tags: ["estoque", "vendas", "perdas"],
    summary: "Controle estoque, evite falta e registre perdas de forma auditável.",
    steps: [
      "Cadastre produtos com custo, quantidade e mínimo.",
      "Acompanhe alertas de estoque baixo.",
    ],
    actions: [{ label: "Abrir Produtos", href: "/produtos" }],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: DollarSign,
    tags: ["receitas", "despesas", "relatórios"],
    summary: "Tenha visão clara do caixa e gere relatórios com poucos cliques.",
    steps: [
      "Registre despesas/receitas e categorize corretamente.",
      "Use relatórios para acompanhar lucratividade e tendências.",
      "Gere PDF quando precisar compartilhar ou arquivar.",
    ],
    actions: [{ label: "Abrir Financeiro", href: "/financeiro" }],
  },
  {
    id: "equipe",
    title: "Equipe",
    icon: UserCog,
    tags: ["profissionais", "permissões", "convites"],
    summary: "Convide profissionais com segurança e mantenha permissões sob controle.",
    steps: [
      "Convide membros e defina função (admin/staff).",
      "Configure comissões/salários quando aplicável.",
    ],
    actions: [{ label: "Abrir Equipe", href: "/equipe" }],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    tags: ["clínica", "dados", "perfil"],
    summary: "Onde você define os dados do clínica e ajustes operacionais.",
    steps: [
      "Mantenha CPF/CNPJ de cobrança preenchido para evitar bloqueio no checkout.",
      "Revise dados do clínica para comunicações e relatórios.",
    ],
    actions: [{ label: "Abrir Configurações", href: "/configuracoes" }],
  },
  {
    id: "assinatura",
    title: "Assinatura & Planos",
    icon: CreditCard,
    tags: ["planos", "upgrade", "trial"],
    summary: "Gerencie plano, periodicidade e recursos liberados por tier.",
    steps: [
      "Acesse Assinatura para ver seu plano atual.",
      "Faça upgrade para liberar relatórios avançados, exportações e suporte WhatsApp.",
    ],
    actions: [{ label: "Abrir Assinatura", href: "/assinatura" }],
  },
  {
    id: "suporte",
    title: "Suporte",
    icon: LifeBuoy,
    tags: ["tickets", "email", "whatsapp"],
    summary: "Abra tickets com contexto automático. Básico por e-mail; Pro/Premium por WhatsApp.",
    steps: [
      "Abra um ticket com assunto e descrição detalhada.",
      "Acompanhe a conversa e responda quando precisar.",
    ],
    actions: [{ label: "Abrir Suporte", href: "/suporte" }],
  },
];

export default function Ajuda() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const tour = useTour();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return SECTIONS;

    return SECTIONS.filter((s) => {
      const hay = [s.title, s.summary, ...s.tags, ...s.steps].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [query]);

  const primary = filtered[0] ?? null;

  return (
    <MainLayout
      title="Ajuda & Documentação"
      subtitle="Guia oficial ClinicNest — aprenda rápido e use com confiança"
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end py-1">
          <Tabs value="ajuda" onValueChange={(v) => v === "suporte" && navigate("/suporte")}>
            <TabsList data-tour="help-support-tabs">
              <TabsTrigger value="ajuda" data-tour="help-tab-ajuda">Ajuda</TabsTrigger>
              <TabsTrigger value="suporte" data-tour="help-tab-suporte">Suporte</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="outline"
            onClick={tour.start}
            className="hidden sm:inline-flex"
            data-tour="help-start-tour"
          >
            Iniciar tutorial
          </Button>
          <Button
            variant="outline"
            onClick={() => void tour.reset()}
            className="hidden sm:inline-flex"
            data-tour="help-reset-tour"
          >
            Reiniciar tutorial
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate("/suporte")}
            className="hidden sm:inline-flex"
            data-tour="help-open-support"
          >
            <LifeBuoy className="h-4 w-4 mr-2" />
            Abrir suporte
          </Button>
          <Button
            onClick={() => navigate("/agenda")}
            className="gradient-primary text-primary-foreground"
            data-tour="help-go-agenda"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Ir para a agenda
          </Button>
        </div>
      }
    >
      <Card className="border-gradient overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-teal-600 to-cyan-500 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Central de Ajuda</CardTitle>
              <div className="mt-1 text-sm text-white/90">
                Conteúdos curtos, objetivos e alinhados ao seu dia a dia.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">ClinicNest</span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 min-h-[calc(100vh-260px)]">
          <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-stretch min-h-0">
            <div className="flex flex-col gap-4 min-h-0 h-full">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por: agenda, financeiro, clientes..."
                  className="pl-9"
                  data-tour="help-search"
                />
              </div>

              <ScrollArea className="flex-1 min-h-0 rounded-xl border" data-tour="help-sections">
                <div className="p-2 space-y-1">
                  {filtered.length === 0 ? (
                    <div className="p-2">
                      <EmptyState
                        icon={Search}
                        title="Nada encontrado"
                        description="Tente buscar por um módulo (ex.: Agenda, Financeiro) ou por uma ação (ex.: gerar PDF)."
                        action={
                          query ? (
                            <Button variant="outline" onClick={() => setQuery("")}>Limpar busca</Button>
                          ) : undefined
                        }
                      />
                    </div>
                  ) : (
                    filtered.map((s) => {
                      const Icon = s.icon;
                      const active = primary?.id === s.id;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`doc-${s.id}`);
                            el?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className={`w-full rounded-xl border p-3 text-left transition-colors ${
                            active ? "bg-accent/50 border-primary/30" : "hover:bg-accent/30"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm truncate">{s.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-2">{s.summary}</div>
                              <div className="mt-2 flex flex-wrap gap-1">
                                {s.tags.slice(0, 3).map((t) => (
                                  <Badge key={t} variant="secondary" className="text-[10px]">
                                    {t}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                Dica: se estiver travado em algo, abra um ticket em{" "}
                <Link className="underline" to="/suporte" data-tour="help-tip-open-support">
                  Suporte
                </Link>
                .
              </div>
            </div>

            <div className="space-y-6 min-h-0" data-tour="help-content">
              {filtered.length === 0 ? null : (
                filtered.map((s, idx) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.id} id={`doc-${s.id}`} className="scroll-mt-24">
                      {idx > 0 && <Separator className="my-6" />}
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl gradient-vibrant shadow-glow">
                          <Icon className="h-5 w-5 text-white" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h2 className="text-lg font-display font-bold text-foreground">{s.title}</h2>
                          <p className="mt-1 text-sm text-muted-foreground">{s.summary}</p>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Passo a passo</CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <ol className="space-y-2 text-sm">
                              {s.steps.map((step, i) => (
                                <li key={i} className="flex gap-3">
                                  <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">
                                    {i + 1}
                                  </div>
                                  <div className="text-foreground">{step}</div>
                                </li>
                              ))}
                            </ol>
                          </CardContent>
                        </Card>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {s.actions.map((a) => (
                            <Link
                              key={a.href}
                              to={a.href}
                              data-tour={`help-section-action-${s.id}-${a.href.replace(/\//g, "").replace(/\W+/g, "-")}`}
                            >
                              <Button variant="outline">
                                {a.label}
                                <ArrowRight className="h-4 w-4 ml-2" />
                              </Button>
                            </Link>
                          ))}
                          <Button
                            className="gradient-primary text-primary-foreground"
                            onClick={() => navigate("/suporte")}
                            data-tour="help-need-help"
                          >
                            <LifeBuoy className="h-4 w-4 mr-2" />
                            Preciso de ajuda
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
