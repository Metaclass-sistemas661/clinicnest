import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Calendar,
  Video,
  FileText,
  Pill,
  Clock,
  Stethoscope,
  ArrowRight,
  Heart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PatientDashboard() {
  const [userName, setUserName] = useState("Paciente");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.auth.getUser();
      setUserName(data.user?.user_metadata?.full_name ?? "Paciente");
      setIsLoading(false);
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
      color: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
      iconBg: "bg-purple-100 dark:bg-purple-900",
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
      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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

      {/* Info card */}
      <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30 mb-8">
        <CardContent className="py-4 px-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900 flex-shrink-0 mt-0.5">
              <Heart className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-purple-800 dark:text-purple-200 mb-1">
                Bem-vindo ao Portal do Paciente
              </h3>
              <p className="text-xs text-purple-700/80 dark:text-purple-300/80 leading-relaxed">
                Aqui você pode acessar suas consultas, teleconsultas, exames, receitas e atestados.
                Em breve, sua clínica poderá vincular seu cadastro para que você tenha acesso completo ao seu histórico.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma consulta agendada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Suas consultas aparecerão aqui quando a clínica vincular seu cadastro.
              </p>
            </div>
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
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Video className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Nenhuma teleconsulta agendada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Quando houver teleconsultas, você poderá entrar na videochamada por aqui.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
