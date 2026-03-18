import { Link, useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Package,
  ShoppingCart,
  Truck,
  Users,
  UserCog,
  Settings,
  LogOut,
  Wallet,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Menu,
  Clock,
  Target,
  Shield,
  Send,
  BarChart3,
  Globe,
  Gift,
  Zap,
  Ticket,
  Plug,
  ClipboardList,
  HeartPulse,
  Building2,
  FlaskConical,
  Activity,
  FilePlus2,
  Stethoscope,
  Video,
  MessageSquare,
  FileCode2,
  Building,
  Calculator,
  ShieldCheck,
  FileSignature,
  FileCheck2,
  ArrowRightLeft,
  ClockArrowUp,
  Smile,
  DoorOpen,
  Code2,
  NotebookPen,
  Archive,
  CalendarClock,
  MonitorPlay,
  Tv,
  FileText,
  Sparkles,
  Lock,
  Plus,
  Bot,
  Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useSimpleMode } from "@/lib/simple-mode";
import { usePermissions } from "@/hooks/usePermissions";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { useUnreadChatCount } from "@/hooks/useUnreadChatCount";
import { PROFESSIONAL_TYPE_LABELS } from "@/types/database";
import { FeatureKey, PLAN_CONFIG, getMinimumTierForFeature as getMinTierForFeature } from "@/types/subscription-plans";

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  /** Recurso RBAC. Filtra via `usePermissions().can(resource, 'view')`. */
  resource?: string;
  /** Feature do plano. Filtra via `usePlanFeatures().hasFeature(feature)`. */
  requiredFeature?: FeatureKey;
  /** Legado — mantido apenas para itens exclusivos de staff (ex: Minhas Comissões). */
  staffOnly?: boolean;
  /** Badge de notificação */
  badge?: number;
}

interface NavCategory {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  /** Cor do tema da categoria */
  color: string;
  /** Cor do gradiente */
  gradient: string;
}

const STORAGE_KEY = "sidebar-open-categories";

function loadOpenCategories(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return {};
}

function saveOpenCategories(state: Record<string, boolean>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* noop */ }
}

const navCategories: NavCategory[] = [
  {
    label: "Recepção",
    icon: MonitorPlay,
    color: "text-teal-500",
    gradient: "from-teal-500 to-cyan-500",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard, resource: "dashboard" },
      { title: "Recepcao", href: "/recepcao", icon: MonitorPlay, resource: "agenda" },
      { title: "Agenda", href: "/agenda", icon: Calendar, resource: "agenda" },
      { title: "Painel TV", href: "/painel-chamada", icon: Tv, resource: "agenda", requiredFeature: "callPanel" },
      { title: "Lista de Espera", href: "/lista-espera", icon: ClockArrowUp, resource: "lista_espera", requiredFeature: "waitlist" },
      { title: "Retornos Pendentes", href: "/retornos-pendentes", icon: CalendarClock, resource: "agenda", requiredFeature: "returnReminders" },
      { title: "Disponibilidade", href: "/disponibilidade", icon: Clock, resource: "disponibilidade" },
    ],
  },
  {
    label: "Clínico",
    icon: Stethoscope,
    color: "text-blue-500",
    gradient: "from-blue-500 to-indigo-500",
    items: [
      { title: "Pacientes", href: "/pacientes", icon: Users, resource: "pacientes" },
      { title: "Triagem", href: "/triagem", icon: Activity, resource: "triagem", requiredFeature: "triage" },
      { title: "Prontuários", href: "/prontuarios", icon: ClipboardList, resource: "prontuarios" },
      { title: "Evoluções", href: "/evolucoes", icon: NotebookPen, resource: "evolucao_clinica", requiredFeature: "soapEvolutions" },
      { title: "Teleconsulta", href: "/teleconsulta", icon: Video, resource: "teleconsulta" },
      { title: "Chat Interno", href: "/chat", icon: MessageSquare, resource: "chat", requiredFeature: "internalChat" },
    ],
  },
  {
    label: "Documentos",
    icon: FileText,
    color: "text-violet-500",
    gradient: "from-violet-500 to-purple-500",
    items: [
      { title: "Receituários", href: "/receituarios", icon: FilePlus2, resource: "receituarios" },
      { title: "Atestados", href: "/atestados", icon: FileCheck2, resource: "atestados" },
      { title: "Laudos & Exames", href: "/laudos", icon: FlaskConical, resource: "laudos", requiredFeature: "reports" },
      { title: "Encaminhamentos", href: "/encaminhamentos", icon: ArrowRightLeft, resource: "encaminhamentos", requiredFeature: "referrals" },
      { title: "Termos & Contratos", href: "/contratos-termos", icon: FileSignature, resource: "contratos_termos", requiredFeature: "contracts" },
    ],
  },
  {
    label: "Odontologia",
    icon: Smile,
    color: "text-pink-500",
    gradient: "from-pink-500 to-rose-500",
    items: [
      { title: "Odontograma", href: "/odontograma", icon: Smile, resource: "odontograma", requiredFeature: "odontogram" },
      { title: "Periograma", href: "/periograma", icon: Activity, resource: "odontograma", requiredFeature: "periogram" },
      { title: "Planos de Tratamento", href: "/planos-tratamento", icon: ClipboardList, resource: "odontograma", requiredFeature: "treatmentPlans" },
    ],
  },
  {
    label: "Estética",
    icon: Gem,
    color: "text-fuchsia-500",
    gradient: "from-fuchsia-500 to-pink-500",
    items: [
      { title: "Mapeamento", href: "/estetica/mapeamento", icon: Gem, resource: "estetica", requiredFeature: "aestheticMapping" },
    ],
  },
  {
    label: "Financeiro",
    icon: DollarSign,
    color: "text-emerald-500",
    gradient: "from-emerald-500 to-green-500",
    items: [
      { title: "Visão Geral", href: "/financeiro", icon: DollarSign, resource: "financeiro" },
      { title: "Contas a Pagar", href: "/contas-pagar", icon: ArrowRightLeft, resource: "financeiro" },
      { title: "Contas a Receber", href: "/contas-receber", icon: ArrowRightLeft, resource: "financeiro" },
      { title: "Faturamento TISS", href: "/faturamento-tiss", icon: Calculator, resource: "faturamento_tiss", requiredFeature: "tissBilling" },
      { title: "Convênios", href: "/convenios", icon: Building2, resource: "convenios", requiredFeature: "insurancePlans" },
      { title: "Relatórios", href: "/relatorios", icon: BarChart3, resource: "relatorios" },
    ],
  },
  {
    label: "Repasses",
    icon: Wallet,
    color: "text-cyan-500",
    gradient: "from-cyan-500 to-teal-500",
    items: [
      { title: "Visão Geral", href: "/repasses", icon: Wallet, resource: "financeiro" },
      { title: "Comissões", href: "/repasses/comissoes", icon: Wallet, resource: "financeiro" },
      { title: "Salários", href: "/repasses/salarios", icon: DollarSign, resource: "financeiro" },
      { title: "Regras de Comissão", href: "/repasses/regras", icon: Settings, resource: "financeiro" },
    ],
  },
  {
    label: "Suprimentos",
    icon: Package,
    color: "text-amber-500",
    gradient: "from-amber-500 to-orange-500",
    items: [
      { title: "Insumos Médicos", href: "/produtos", icon: Package, resource: "produtos" },
      { title: "Compras", href: "/compras", icon: ShoppingCart, resource: "compras", requiredFeature: "purchases" },
      { title: "Fornecedores", href: "/fornecedores", icon: Truck, resource: "fornecedores", requiredFeature: "suppliers" },
    ],
  },
  {
    label: "Marketing",
    icon: Sparkles,
    color: "text-fuchsia-500",
    gradient: "from-fuchsia-500 to-pink-500",
    items: [
      { title: "Campanhas", href: "/campanhas", icon: Send, resource: "campanhas", requiredFeature: "campaigns" },
      { title: "Automações", href: "/automacoes", icon: Zap, resource: "automacoes", requiredFeature: "automations" },
      { title: "Clínica Autônoma", href: "/clinica-autonoma", icon: Bot, resource: "configuracoes", requiredFeature: "aiAgentChat" },
    ],
  },
  {
    label: "Administração",
    icon: Settings,
    color: "text-slate-500",
    gradient: "from-slate-500 to-gray-500",
    items: [
      { title: "Equipe", href: "/equipe", icon: UserCog, resource: "equipe", requiredFeature: "team" },
      { title: "Unidades", href: "/unidades", icon: Building, resource: "configuracoes", requiredFeature: "multiUnit" },
      { title: "Gestão de Salas", href: "/gestao-salas", icon: DoorOpen, resource: "gestao_salas", requiredFeature: "rooms" },
      { title: "Procedimentos", href: "/procedimentos", icon: Stethoscope, resource: "procedimentos" },
      { title: "Especialidades", href: "/especialidades", icon: HeartPulse, resource: "especialidades", requiredFeature: "specialties" },
      { title: "Modelos Prontuário", href: "/modelos-prontuario", icon: FileCode2, resource: "modelos_prontuario", requiredFeature: "recordTemplates" },
      { title: "Templates de Termos", href: "/termos-consentimento", icon: FileSignature, resource: "contratos_termos", requiredFeature: "contracts" },
      { title: "API Pública", href: "/api-docs", icon: Code2, resource: "api_docs", requiredFeature: "apiAccess" },
      { title: "Compliance & LGPD", href: "/compliance", icon: ShieldCheck, resource: "auditoria", requiredFeature: "compliance" },
      { title: "SNGPC/ANVISA", href: "/sngpc", icon: Shield, resource: "auditoria", requiredFeature: "sngpc" },
      { title: "Auditoria", href: "/auditoria", icon: Shield, resource: "auditoria", requiredFeature: "audit" },
      { title: "Configurações", href: "/configuracoes", icon: Settings, resource: "configuracoes" },
    ],
  },
  {
    label: "Minha Conta",
    icon: Users,
    color: "text-cyan-500",
    gradient: "from-cyan-500 to-teal-500",
    items: [
      { title: "Meu Financeiro", href: "/meu-financeiro", icon: Wallet, staffOnly: true },
    ],
  },
];

const prefetchByHref: Record<string, () => void> = {
  "/dashboard": () => void import("@/pages/Dashboard"),
  "/agenda": () => void import("@/pages/Agenda"),
  "/teleconsulta": () => void import("@/pages/Teleconsulta"),
  "/modelos-prontuario": () => void import("@/pages/ModelosProntuario"),
  "/faturamento-tiss": () => void import("@/pages/FaturamentoTISS"),
  "/chat": () => void import("@/pages/Chat"),
  "/unidades": () => void import("@/pages/Unidades"),
  "/disponibilidade": () => void import("@/pages/Disponibilidade"),
  "/procedimentos": () => void import("@/pages/Procedimentos"),
  "/pacientes": () => void import("@/pages/Pacientes"),
  "/prontuarios": () => void import("@/pages/Prontuarios"),
  "/triagem": () => void import("@/pages/Triagem"),
  "/receituarios": () => void import("@/pages/Receituarios"),
  "/laudos": () => void import("@/pages/Laudos"),
  "/atestados": () => void import("@/pages/Atestados"),
  "/encaminhamentos": () => void import("@/pages/Encaminhamentos"),
  "/lista-espera": () => void import("@/pages/ListaEspera"),
  "/especialidades": () => void import("@/pages/Especialidades"),
  "/convenios": () => void import("@/pages/Convenios"),
  "/financeiro": () => void import("@/pages/Financeiro"),
  "/repasses": () => void import("@/pages/Repasses"),
  "/repasses/comissoes": () => void import("@/pages/RepassesComissoes"),
  "/repasses/salarios": () => void import("@/pages/RepassesSalarios"),
  "/repasses/regras": () => void import("@/pages/repasses/ConfigurarRegras"),
  "/produtos": () => void import("@/pages/Produtos"),
  "/compras": () => void import("@/pages/Compras"),
  "/fornecedores": () => void import("@/pages/Fornecedores"),
  "/auditoria": () => void import("@/pages/Auditoria"),
  "/equipe": () => void import("@/pages/Equipe"),
  "/configuracoes": () => void import("@/pages/Configuracoes"),
  "/termos-consentimento": () => void import("@/pages/TermosConsentimento"),
  "/contratos-termos": () => void import("@/pages/ContratosTermos"),
  "/minhas-configuracoes": () => void import("@/pages/MinhasConfiguracoes"),
  "/notificacoes": () => void import("@/pages/Notificacoes"),
  "/assinatura": () => void import("@/pages/Assinatura"),
  "/assinatura/gerenciar": () => void import("@/pages/GerenciarAssinatura"),
  "/meu-financeiro": () => void import("@/pages/MeuFinanceiro"),
  "/campanhas": () => void import("@/pages/Campanhas"),
  "/automacoes": () => void import("@/pages/Automacoes"),
  "/relatorios": () => void import("@/pages/Relatorios"),
  "/ajuda": () => void import("@/pages/Ajuda"),
  "/suporte": () => void import("@/pages/Suporte"),
  "/odontograma": () => void import("@/pages/Odontograma"),
  "/evolucoes": () => void import("@/pages/Evolucoes"),
  "/estetica/mapeamento": () => void import("@/pages/estetica/EsteticaMapping"),
  "/gestao-salas": () => void import("@/pages/GestaoSalas"),
  "/api-docs": () => void import("@/pages/ApiDocumentation"),
  "/sngpc": () => void import("@/pages/TransmissaoSNGPC"),
  "/compliance": () => void import("@/pages/Compliance"),
  "/dashboard-ona": () => void import("@/pages/DashboardONA"),
  "/retornos-pendentes": () => void import("@/pages/RetornosPendentes"),
  "/recepcao/fila": () => void import("@/pages/recepcao/FilaAtendimento"),
  "/recepcao": () => void import("@/pages/recepcao/DashboardRecepcao"),
  "/painel-chamada": () => void import("@/pages/PainelChamada"),
};

function prefetchRoute(href: string) {
  try {
    prefetchByHref[href]?.();
  } catch {
    // no-op
  }
}

// Persist nav scroll position across re-renders / route changes
let savedNavScroll = 0;

function CategoryGroup({
  category,
  filteredItems,
  lockedItems,
  isCollapsed,
  isOpen,
  onToggle,
  location,
  onNavigate,
}: {
  category: NavCategory;
  filteredItems: NavItem[];
  lockedItems: NavItem[];
  isCollapsed: boolean;
  isOpen: boolean;
  onToggle: () => void;
  location: ReturnType<typeof useLocation>;
  onNavigate?: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const hasActiveChild = filteredItems.some((item) => location.pathname === item.href);
  const allItems = [...filteredItems, ...lockedItems];

  if (isCollapsed) {
    return (
      <div className="space-y-1 py-1">
        <div
          className={cn(
            "mx-auto mb-1.5 flex h-8 w-8 items-center justify-center rounded-lg transition-all",
            hasActiveChild ? `bg-gradient-to-br ${category.gradient} text-white shadow-md` : "bg-muted/50"
          )}
          title={category.label}
        >
          <category.icon className={cn("h-4 w-4", !hasActiveChild && category.color)} />
        </div>
        {filteredItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              onMouseEnter={() => prefetchRoute(item.href)}
              className={cn(
                "group flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? `bg-gradient-to-r ${category.gradient} text-white shadow-lg shadow-primary/20`
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={item.title}
            >
              <item.icon className={cn(
                "h-5 w-5 shrink-0 transition-transform duration-200",
                isActive && "scale-110",
                !isActive && "group-hover:scale-110"
              )} />
            </Link>
          );
        })}
        {lockedItems.map((item) => (
          <Link
            key={item.href}
            to="/assinatura"
            className="group flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground/50 transition-all duration-200 hover:bg-amber-50 dark:hover:bg-amber-950/20"
            title={`${item.title} - Upgrade necessário`}
          >
            <Lock className="h-4 w-4 shrink-0" />
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 mr-2 text-xs font-bold uppercase tracking-wider transition-all duration-200",
          hasActiveChild
            ? `bg-gradient-to-r ${category.gradient} text-white shadow-md`
            : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        )}
      >
        <div className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-all",
          hasActiveChild ? "bg-white/20" : "bg-muted"
        )}>
          <category.icon className={cn(
            "h-4 w-4 transition-transform group-hover:scale-110",
            hasActiveChild ? "text-white" : category.color
          )} />
        </div>
        <span className="flex-1 text-left">{category.label}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>

      <div
        ref={contentRef}
        className="overflow-hidden transition-all duration-300 ease-out"
        style={{
          maxHeight: isOpen ? `${allItems.length * 44 + 12}px` : "0px",
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div className="space-y-0.5 py-1 pl-3">
          {filteredItems.map((item) => {
            const isActive = location.pathname === item.href;
            const tourKey =
              item.href === "/dashboard" ? "sidebar-dashboard" :
              item.href === "/agenda" ? "sidebar-agenda" :
              item.href === "/pacientes" ? "sidebar-pacientes" :
              item.href === "/procedimentos" ? "sidebar-procedimentos" :
              item.href === "/produtos" ? "sidebar-produtos" :
              item.href === "/financeiro" ? "sidebar-financeiro" :
              item.href === "/minhas-comissoes" ? "sidebar-minhas-comissoes" :
              item.href === "/meus-salarios" ? "sidebar-meus-salarios" :
              item.href === "/ajuda" ? "sidebar-ajuda" :
              undefined;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={onNavigate}
                onMouseEnter={() => prefetchRoute(item.href)}
                data-tour={tourKey}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "seamless-tab-active"
                    : "rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground mr-2"
                )}
              >
                <item.icon className={cn(
                  "h-4 w-4 shrink-0 transition-all duration-200",
                  isActive ? "text-foreground" : category.color,
                  "group-hover:scale-110"
                )} />
                <span className="truncate">{item.title}</span>
                {item.badge && item.badge > 0 && (
                  <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </Link>
            );
          })}
          {lockedItems.map((item) => {
            const minTier = item.requiredFeature ? getMinTierForFeature(item.requiredFeature) : null;
            const tierName = minTier ? PLAN_CONFIG[minTier].name : 'Pro';
            return (
              <Link
                key={item.href}
                to="/assinatura"
                className="group relative flex items-center gap-3 rounded-lg px-3 py-2 mr-2 text-sm font-medium text-muted-foreground/60 transition-all duration-200 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                title={`Disponível no plano ${tierName}`}
              >
                <Lock className="h-4 w-4 shrink-0 text-amber-500/70" />
                <span className="truncate">{item.title}</span>
                <span className="ml-auto rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  {tierName}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SidebarContent({
  isCollapsed,
  onNavigate
}: {
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const { profile, tenant, signOut } = auth;
  const isAdmin = auth?.isAdmin ?? false;
  const { can, professionalType } = usePermissions();
  const { hasFeature } = usePlanFeatures();
  const { isFeatureEnabledByModule } = useEnabledModules();
  const { unreadCount: chatUnreadCount } = useUnreadChatCount();
  const { enabled: simpleModeEnabled } = useSimpleMode(profile?.tenant_id);
  const navRef = useRef<HTMLElement>(null);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => {
    const saved = loadOpenCategories();
    const defaults: Record<string, boolean> = {};
    navCategories.forEach((cat) => {
      defaults[cat.label] = saved[cat.label] ?? false;
    });
    defaults["Recepção"] = true;
    return defaults;
  });

  const toggleCategory = useCallback((label: string) => {
    setOpenCategories((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      saveOpenCategories(next);
      return next;
    });
  }, []);

  useEffect(() => {
    for (const category of navCategories) {
      const hasActive = category.items.some((item) => location.pathname === item.href);
      if (hasActive && !openCategories[category.label]) {
        setOpenCategories((prev) => {
          const next = { ...prev, [category.label]: true };
          saveOpenCategories(next);
          return next;
        });
        break;
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (navRef.current) {
      navRef.current.scrollTop = savedNavScroll;
    }
  });

  const handleNavScroll = useCallback(() => {
    if (navRef.current) {
      savedNavScroll = navRef.current.scrollTop;
    }
  }, []);

  const handleSignOut = async () => {
    onNavigate?.();
    await signOut();
    navigate("/", { replace: true });
  };

  const quickAccessItems = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Agenda", href: "/agenda", icon: Calendar },
    { title: "Pacientes", href: "/pacientes", icon: Users },
  ];

  return (
    <>
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border/50 px-4 mt-2">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
              <HeartPulse className="h-5 w-5 text-white" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
            </div>
            <div>
              <span className="font-display text-base font-bold text-foreground">
                {tenant?.name || "ClinicNest"}
              </span>
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Gestão Clínica
              </p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-500 shadow-lg shadow-teal-500/25">
            <HeartPulse className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Quick Access */}
      {!isCollapsed && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-1">
            {quickAccessItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium transition-all",
                    isActive
                      ? "bg-background text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Divider */}
      {!isCollapsed && (
        <div className="mx-3 mb-2 border-t border-border/50" />
      )}

      {/* Navigation */}
      <nav ref={navRef} onScroll={handleNavScroll} className="flex-1 space-y-1 overflow-y-auto pl-2 pr-0 pb-2 scrollbar-hide">
        {navCategories.map((category) => {
          const accessibleItems: NavItem[] = [];
          const lockedItems: NavItem[] = [];
          
          category.items.forEach((item) => {
            if (item.staffOnly && isAdmin) return;
            if (!item.staffOnly && !isAdmin && item.resource && !can(item.resource, 'view')) return;
            if (simpleModeEnabled && item.href === "/auditoria") return;
            
            if (item.requiredFeature && !hasFeature(item.requiredFeature)) {
              lockedItems.push(item);
            } else if (item.requiredFeature && !isFeatureEnabledByModule(item.requiredFeature)) {
              // Module disabled by admin — hide completely (don't show as locked)
              return;
            } else {
              const itemWithBadge = item.href === "/chat" && chatUnreadCount > 0
                ? { ...item, badge: chatUnreadCount }
                : item;
              accessibleItems.push(itemWithBadge);
            }
          });
          
          if (accessibleItems.length === 0 && lockedItems.length === 0) return null;
          
          return (
            <CategoryGroup
              key={category.label}
              category={category}
              filteredItems={accessibleItems}
              lockedItems={lockedItems}
              isCollapsed={isCollapsed}
              isOpen={openCategories[category.label] ?? true}
              onToggle={() => toggleCategory(category.label)}
              location={location}
              onNavigate={onNavigate}
            />
          );
        })}
      </nav>

      {/* Logout section */}
      <div className="border-t border-border/50 p-3">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start gap-3 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-all",
            isCollapsed && "justify-center px-3"
          )}
          onClick={handleSignOut}
          title={isCollapsed ? "Sair" : undefined}
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!isCollapsed && <span>Sair</span>}
        </Button>
      </div>
    </>
  );
}

export function Sidebar({ onCollapsedChange }: { onCollapsedChange?: (collapsed: boolean) => void } = {}) {
  const isMobile = useIsMobile();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const { tenant, profile, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Close mobile menu on route change
  const location = useLocation();
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Mobile: Sheet/Drawer
  if (isMobile) {
    return (
      <>
        {/* Mobile Header Bar - Modern Design */}
        <div className="fixed left-0 right-0 top-0 z-50 border-b border-border/50 bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
          {/* Main Header Row */}
          <div className="flex h-14 items-center justify-between px-4">
            {/* Left: Menu + Logo */}
            <div className="flex items-center gap-3">
              <Sheet open={isOpen} onOpenChange={setIsOpen}>
                <SheetTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-primary/10"
                    aria-label="Abrir menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-80 p-0 border-r border-border/50 bg-background">
                  <div className="flex h-full flex-col">
                    <SidebarContent isCollapsed={false} onNavigate={() => setIsOpen(false)} />
                  </div>
                </SheetContent>
              </Sheet>
              
              {/* Clinic Name or Logo */}
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 shadow-md shadow-teal-500/20">
                  <HeartPulse className="h-4 w-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate max-w-[140px]">
                    {tenant?.name || "ClinicNest"}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Quick Add Button */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-xl hover:bg-primary/10"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/agenda")}>
                    <Calendar className="mr-2 h-4 w-4" />
                    Novo agendamento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/pacientes")}>
                    <Users className="mr-2 h-4 w-4" />
                    Novo paciente
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/financeiro")}>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Nova transação
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* User Avatar */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-xl p-0 overflow-hidden"
                onClick={() => navigate("/minhas-configuracoes")}
              >
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || "Avatar"}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-cyan-500 to-teal-500 text-white text-sm font-bold">
                    {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
                  </div>
                )}
              </Button>
            </div>
          </div>

          {/* Quick Access Bar */}
          <div className="flex items-center gap-1 px-3 pb-2 overflow-x-auto scrollbar-hide">
            <Button
              variant={location.pathname === "/agenda" ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-full text-xs gap-1.5 shrink-0"
              onClick={() => navigate("/agenda")}
            >
              <Calendar className="h-3.5 w-3.5" />
              Agenda
            </Button>
            <Button
              variant={location.pathname === "/pacientes" ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-full text-xs gap-1.5 shrink-0"
              onClick={() => navigate("/pacientes")}
            >
              <Users className="h-3.5 w-3.5" />
              Pacientes
            </Button>
            <Button
              variant={location.pathname === "/financeiro" ? "default" : "outline"}
              size="sm"
              className="h-8 rounded-full text-xs gap-1.5 shrink-0"
              onClick={() => navigate("/financeiro")}
            >
              <DollarSign className="h-3.5 w-3.5" />
              Financeiro
            </Button>
            {isAdmin && (
              <Button
                variant={location.pathname === "/dashboard" ? "default" : "outline"}
                size="sm"
                className="h-8 rounded-full text-xs gap-1.5 shrink-0"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Button>
            )}
          </div>
        </div>
        {/* Spacer for fixed header */}
        <div className="h-[88px]" />
      </>
    );
  }

  // Desktop: Fixed Sidebar
  return (
    <aside
      className={cn(
        "fixed left-3 top-3 bottom-3 z-40 flex flex-col transition-all duration-300 ease-out overflow-hidden rounded-2xl",
        isCollapsed
          ? "bg-background/95 backdrop-blur-xl border border-border/50 shadow-xl"
          : "bg-[hsl(var(--sidebar-body))] shadow-xl shadow-black/10 border border-border/30",
        isCollapsed ? "w-20" : "w-72"
      )}
    >
      <SidebarContent isCollapsed={isCollapsed} />

      {/* Collapse Toggle — inside card, bottom */}
      <div className="flex items-center justify-center border-t border-border/30 py-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 rounded-lg text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-all"
          aria-label={isCollapsed ? "Expandir sidebar" : "Recolher sidebar"}
          onClick={() => {
            const next = !isCollapsed;
            setIsCollapsed(next);
            onCollapsedChange?.(next);
          }}
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

export function useSidebarWidth() {
  const isMobile = useIsMobile();
  return isMobile ? 0 : 300; // 72 * 4 = 288px (w-72) + 12px (left-3 margin)
}
