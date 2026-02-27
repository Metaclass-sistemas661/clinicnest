import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { useTour } from "@/contexts/TourContext";
import {
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
  FileText,
  ChevronRight,
  ExternalLink,
  Zap,
} from "lucide-react";

type DocCategory = {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  href: string;
  articles: string[];
};

const CATEGORIES: DocCategory[] = [
  {
    id: "comecando",
    title: "Começando",
    icon: Sparkles,
    description: "Primeiros passos para configurar sua clínica",
    href: "/configuracoes",
    articles: [
      "Configurar dados da clínica",
      "Cadastrar serviços",
      "Adicionar profissionais",
      "Criar primeiro agendamento",
    ],
  },
  {
    id: "agenda",
    title: "Agenda",
    icon: Calendar,
    description: "Gerencie agendamentos e horários",
    href: "/agenda",
    articles: [
      "Criar agendamento",
      "Confirmar e finalizar",
      "Bloquear horários",
      "Lista de espera",
    ],
  },
  {
    id: "pacientes",
    title: "Pacientes",
    icon: Users,
    description: "Cadastro e histórico de pacientes",
    href: "/pacientes",
    articles: [
      "Cadastrar paciente",
      "Histórico de atendimentos",
      "Observações e preferências",
      "Exportar dados",
    ],
  },
  {
    id: "servicos",
    title: "Serviços",
    icon: Stethoscope,
    description: "Catálogo de serviços e preços",
    href: "/servicos",
    articles: [
      "Criar serviço",
      "Definir duração e preço",
      "Categorias de serviços",
      "Desativar serviços",
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro",
    icon: DollarSign,
    description: "Controle de receitas e despesas",
    href: "/financeiro",
    articles: [
      "Registrar transações",
      "Categorias financeiras",
      "Relatórios e gráficos",
      "Exportar para PDF",
    ],
  },
  {
    id: "produtos",
    title: "Estoque",
    icon: Package,
    description: "Controle de produtos e insumos",
    href: "/produtos",
    articles: [
      "Cadastrar produtos",
      "Entrada e saída",
      "Alertas de estoque baixo",
      "Histórico de movimentações",
    ],
  },
  {
    id: "equipe",
    title: "Equipe",
    icon: UserCog,
    description: "Profissionais e permissões",
    href: "/equipe",
    articles: [
      "Convidar membros",
      "Definir permissões",
      "Comissões e repasses",
      "Gerenciar acessos",
    ],
  },
  {
    id: "documentos",
    title: "Documentos",
    icon: FileText,
    description: "Prontuários e termos",
    href: "/evolucoes",
    articles: [
      "Criar evolução",
      "Termos de consentimento",
      "Receitas e atestados",
      "Assinatura digital",
    ],
  },
  {
    id: "configuracoes",
    title: "Configurações",
    icon: Settings,
    description: "Ajustes gerais do sistema",
    href: "/configuracoes",
    articles: [
      "Dados da clínica",
      "Horário de funcionamento",
      "Integrações",
      "Notificações",
    ],
  },
  {
    id: "assinatura",
    title: "Assinatura",
    icon: CreditCard,
    description: "Planos e cobrança",
    href: "/assinatura",
    articles: [
      "Ver plano atual",
      "Fazer upgrade",
      "Histórico de faturas",
      "Cancelar assinatura",
    ],
  },
];

const QUICK_LINKS = [
  { label: "Criar agendamento", href: "/agenda", icon: Calendar },
  { label: "Cadastrar paciente", href: "/pacientes", icon: Users },
  { label: "Ver financeiro", href: "/financeiro", icon: DollarSign },
  { label: "Abrir suporte", href: "/suporte", icon: LifeBuoy },
];

export default function Ajuda() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const tour = useTour();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CATEGORIES;

    return CATEGORIES.filter((cat) => {
      const searchable = [cat.title, cat.description, ...cat.articles].join(" ").toLowerCase();
      return searchable.includes(q);
    });
  }, [query]);

  return (
    <MainLayout
      title="Central de Ajuda"
      subtitle="Encontre respostas e aprenda a usar o ClinicNest"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={tour.start}
            className="hidden sm:inline-flex"
          >
            <Zap className="h-4 w-4 mr-2" />
            Tutorial guiado
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/suporte")}
          >
            <LifeBuoy className="h-4 w-4 mr-2" />
            Suporte
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/agenda")}
            className="gradient-primary text-primary-foreground"
          >
            <PlayCircle className="h-4 w-4 mr-2" />
            Ir para agenda
          </Button>
        </div>
      }
    >
      <div className="space-y-8">
        {/* Search Section */}
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Como podemos ajudar?
          </h2>
          <p className="mt-2 text-muted-foreground">
            Busque por funcionalidades, tutoriais ou dúvidas frequentes
          </p>
          <div className="relative mt-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ex: como criar agendamento, financeiro, pacientes..."
              className="h-12 pl-12 text-base rounded-xl border-2 focus-visible:ring-2"
              data-tour="help-search"
            />
          </div>
        </div>

        {/* Quick Links */}
        {!query && (
          <div className="flex flex-wrap justify-center gap-2">
            {QUICK_LINKS.map((link) => {
              const Icon = link.icon;
              return (
                <Button
                  key={link.href}
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(link.href)}
                  className="rounded-full"
                >
                  <Icon className="h-4 w-4 mr-2" />
                  {link.label}
                </Button>
              );
            })}
          </div>
        )}

        {/* Categories Grid */}
        {filtered.length === 0 ? (
          <div className="py-12">
            <EmptyState
              icon={Search}
              title="Nenhum resultado encontrado"
              description={`Não encontramos resultados para "${query}". Tente buscar por outro termo.`}
              action={
                <Button variant="outline" onClick={() => setQuery("")}>
                  Limpar busca
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((category) => {
              const Icon = category.icon;
              return (
                <Card
                  key={category.id}
                  className="group cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                  onClick={() => navigate(category.href)}
                >
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {category.title}
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                          {category.description}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-4 space-y-1.5">
                      {category.articles.slice(0, 3).map((article, idx) => (
                        <li
                          key={idx}
                          className="flex items-center gap-2 text-sm text-muted-foreground"
                        >
                          <ChevronRight className="h-3 w-3 shrink-0" />
                          <span className="truncate">{article}</span>
                        </li>
                      ))}
                      {category.articles.length > 3 && (
                        <li className="text-xs text-muted-foreground/70 pl-5">
                          +{category.articles.length - 3} mais
                        </li>
                      )}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Footer Help */}
        <div className="rounded-xl border bg-muted/30 p-6 text-center">
          <h3 className="font-semibold">Não encontrou o que procurava?</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Nossa equipe de suporte está pronta para ajudar você
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <Button variant="outline" onClick={() => navigate("/suporte")}>
              <LifeBuoy className="h-4 w-4 mr-2" />
              Abrir ticket de suporte
            </Button>
            <Button variant="outline" onClick={tour.start}>
              <PlayCircle className="h-4 w-4 mr-2" />
              Iniciar tutorial guiado
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
