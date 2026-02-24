import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  CalendarPlus,
  Video,
  FileText,
  Pill,
  Clock,
  Stethoscope,
  ArrowRight,
  Heart,
  AlertCircle,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { PatientBannerCarousel } from "@/components/patient/PatientBannerCarousel";
import { dashboardBanners } from "@/components/patient/patientBannerData";
import { supabasePatient } from "@/integrations/supabase/client";
import { format, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatScheduledAt(scheduledAt: string | null | undefined): string {
  if (!scheduledAt) return "Data não disponível";
  const date = parseISO(scheduledAt);
  if (!isValid(date)) return "Data inválida";
  return format(date, "dd/MM 'às' HH:mm", { locale: ptBR });
}
import { OnboardingTour, useOnboardingTour } from "@/components/patient/OnboardingTour";
import { useAppointmentRating } from "@/components/patient/AppointmentRating";
import { logger } from "@/lib/logger";

interface UpcomingAppointment {
  id: string;
  scheduled_at: string;
  service_name: string;
  professional_name: string;
  clinic_name: string;
  telemedicine: boolean;
}

interface DashboardData {
  isLinked: boolean;
  clinicName: string | null;
  upcomingAppointments: UpcomingAppointment[];
  upcomingTeleconsultas: UpcomingAppointment[];
}

export default function PatientDashboard() {
  const [userName, setUserName] = useState("Paciente");
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    isLinked: false,
    clinicName: null,
    upcomingAppointments: [],
    upcomingTeleconsultas: [],
  });
  const { showTour, completeTour, skipTour } = useOnboardingTour();
  const { RatingPrompt } = useAppointmentRating();

  useEffect(() => {
    const load = async () => {
      try {
        const { data: userData } = await supabasePatient.auth.getUser();
        setUserName(userData.user?.user_metadata?.full_name ?? "Paciente");

        // Check if patient is linked and get dashboard data
        const { data: dashData, error } = await (supabasePatient as any).rpc("get_patient_dashboard_summary");
        
        if (!error && dashData) {
          setDashboardData({
            isLinked: dashData.is_linked ?? false,
            clinicName: dashData.clinic_name ?? null,
            upcomingAppointments: dashData.upcoming_appointments ?? [],
            upcomingTeleconsultas: dashData.upcoming_teleconsultas ?? [],
          });
        }
      } catch (err) {
        logger.error("PatientDashboard load error:", err);
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
  };

  const quickActions = [
    {
      label: "Agendar Consulta",
      description: "Marque um horário",
      icon: CalendarPlus,
      href: "/paciente/agendar",
      color: "bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400",
      iconBg: "bg-teal-100 dark:bg-teal-900",
    },
    {
      label: "Minhas Consultas",
      description: "Veja seus agendamentos",
      icon: Calendar,
      href: "/paciente/consultas",
      color: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
      iconBg: "bg-blue-100 dark:bg-blue-900",
    },
    {
      label: "Teleconsulta",
      description: "Atendimento por vídeo",
      icon: Video,
      href: "/paciente/teleconsulta",
      color: "bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-400",
      iconBg: "bg-violet-100 dark:bg-violet-900",
    },
    {
      label: "Exames e Laudos",
      description: "Resultados e documentos",
      icon: FileText,
      href: "/paciente/exames",
      color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
      iconBg: "bg-emerald-100 dark:bg-emerald-900",
    },
    {
      label: "Receitas",
      description: "Prescrições médicas",
      icon: Pill,
      href: "/paciente/receitas",
      color: "bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400",
      iconBg: "bg-orange-100 dark:bg-orange-900",
    },
  ];

  return (
    <PatientLayout title={`${greeting()}, ${userName.split(" ")[0]}!`} subtitle="Bem-vindo ao seu portal de saúde">
      {/* Onboarding Tour */}
      {showTour && <OnboardingTour onComplete={completeTour} onSkip={skipTour} />}
      
      {/* Rating Prompt */}
      {RatingPrompt}

      <PatientBannerCarousel slides={dashboardBanners} />

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.href} to={action.href}>
              <Card className="hover:shadow-md transition-all duration-200 hover:scale-[1.02] cursor-pointer h-full">
                <CardContent className="p-5">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.iconBg} mb-3`}>
                    <Icon className={`h-5 w-5 ${action.color.split(" ")[1]}`} />
                  </div>
                  <h3 className="font-semibold text-sm mb-0.5">{action.label}</h3>
                  <p className="text-xs text-muted-foreground">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Info card - different based on link status */}
      {!dashboardData.isLinked ? (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 mb-8">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900 flex-shrink-0 mt-0.5">
                <AlertCircle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-amber-800 dark:text-amber-200 mb-1">
                  Cadastro ainda não vinculado
                </h3>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/80 leading-relaxed mb-2">
                  Seu cadastro ainda não está vinculado a uma clínica. Para ter acesso completo ao seu histórico de consultas, 
                  exames e receitas, entre em contato com sua clínica e informe seu <strong>código de acesso</strong> ou <strong>CPF</strong>.
                </p>
                <p className="text-xs text-amber-700/60 dark:text-amber-300/60">
                  Assim que a clínica vincular seu cadastro, você poderá ver todas as suas informações aqui.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30 mb-8">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900 flex-shrink-0 mt-0.5">
                <CheckCircle2 className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-teal-800 dark:text-teal-200 mb-1 flex items-center gap-2">
                  Vinculado a {dashboardData.clinicName}
                  <Badge variant="secondary" className="text-[10px] bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300">
                    <Building2 className="h-2.5 w-2.5 mr-1" />
                    Ativo
                  </Badge>
                </h3>
                <p className="text-xs text-teal-700/80 dark:text-teal-300/80 leading-relaxed">
                  Você tem acesso completo ao seu histórico de consultas, exames, receitas e atestados.
                  Agende consultas, acesse teleconsultas e acompanhe sua saúde.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                Próximas Consultas
              </CardTitle>
              <Link to="/paciente/consultas">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : dashboardData.upcomingAppointments.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.upcomingAppointments.slice(0, 3).map((appt) => (
                  <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900 flex-shrink-0">
                      <Stethoscope className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appt.service_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {appt.professional_name} • {formatScheduledAt(appt.scheduled_at)}
                      </p>
                    </div>
                    {appt.telemedicine && (
                      <Badge variant="outline" className="text-[10px] text-teal-600 border-teal-200">
                        <Video className="h-3 w-3 mr-1" />
                        Online
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma consulta agendada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {dashboardData.isLinked 
                    ? "Agende uma consulta para começar." 
                    : "Vincule seu cadastro para ver suas consultas."}
                </p>
                {dashboardData.isLinked && (
                  <Link to="/paciente/agendar" className="mt-3">
                    <Button size="sm" variant="outline" className="text-xs gap-1">
                      <CalendarPlus className="h-3 w-3" />
                      Agendar agora
                    </Button>
                  </Link>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                Teleconsultas
              </CardTitle>
              <Link to="/paciente/teleconsulta">
                <Button variant="ghost" size="sm" className="text-xs gap-1">
                  Ver todas <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
              </div>
            ) : dashboardData.upcomingTeleconsultas.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.upcomingTeleconsultas.slice(0, 2).map((appt) => (
                  <div key={appt.id} className="flex items-center gap-3 p-3 rounded-lg bg-violet-50/50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900 flex-shrink-0">
                      <Video className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{appt.service_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {appt.professional_name} • {formatScheduledAt(appt.scheduled_at)}
                      </p>
                    </div>
                    <Link to="/paciente/teleconsulta">
                      <Button size="sm" className="text-xs bg-violet-600 hover:bg-violet-700">
                        Entrar
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Video className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma teleconsulta agendada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Quando houver teleconsultas, você poderá entrar na videochamada por aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
