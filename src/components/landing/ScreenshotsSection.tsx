import { Monitor, Sparkles } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Import screenshot mockups
import dashboardMockup from "@/assets/screenshots/dashboard-mockup.png";
import agendaMockup from "@/assets/screenshots/agenda-mockup.png";
import clientesMockup from "@/assets/screenshots/clientes-mockup.png";
import financeiroMockup from "@/assets/screenshots/financeiro-mockup.png";

const screenshots = [
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Visão geral com métricas e gráficos de performance",
    image: dashboardMockup,
  },
  {
    id: "agenda",
    name: "Agenda",
    description: "Calendário visual com todos os agendamentos",
    image: agendaMockup,
  },
  {
    id: "clientes",
    name: "Clientes",
    description: "CRM completo para gestão de clientes",
    image: clientesMockup,
  },
  {
    id: "financeiro",
    name: "Financeiro",
    description: "Controle total de receitas e despesas",
    image: financeiroMockup,
  },
];

export function ScreenshotsSection() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const activeScreenshot = screenshots.find((s) => s.id === activeTab);

  return (
    <section id="screenshots" className="py-20 sm:py-32 bg-gradient-to-b from-background to-violet-50/50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-violet-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-fuchsia-200/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <Monitor className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-medium text-violet-600">Veja o Sistema</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Interface{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              moderna e intuitiva
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Navegue pelas principais telas do sistema e veja como é fácil gerenciar seu salão.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-4 mb-8">
          {screenshots.map((screenshot) => (
            <button
              key={screenshot.id}
              onClick={() => setActiveTab(screenshot.id)}
              className={cn(
                "px-4 py-2 sm:px-6 sm:py-3 rounded-full text-sm sm:text-base font-medium transition-all duration-300",
                activeTab === screenshot.id
                  ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white shadow-lg shadow-violet-500/25"
                  : "bg-white border border-violet-200 text-muted-foreground hover:border-violet-400 hover:text-violet-600"
              )}
            >
              {screenshot.name}
            </button>
          ))}
        </div>

        {/* Screenshot Display */}
        <div className="max-w-6xl mx-auto">
          {/* Browser Frame */}
          <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl shadow-violet-500/20 border-2 border-violet-200/50 bg-slate-900">
            {/* Browser Top Bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-slate-800 border-b border-slate-700">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 rounded-md bg-slate-700/50 text-slate-400 text-xs sm:text-sm">
                  app.vynlobella.com/{activeTab}
                </div>
              </div>
              <div className="w-16" />
            </div>

            {/* Screenshot Image */}
            <div className="relative aspect-video bg-slate-900">
              {activeScreenshot && (
                <img
                  src={activeScreenshot.image}
                  alt={`Tela de ${activeScreenshot.name} do VynloBella`}
                  className="w-full h-full object-cover"
                />
              )}
              
              {/* Gradient overlay for depth */}
              <div className="absolute inset-0 bg-gradient-to-t from-violet-900/10 to-transparent pointer-events-none" />
            </div>
          </div>

          {/* Screenshot Description */}
          {activeScreenshot && (
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border shadow-sm">
                <Sparkles className="h-4 w-4 text-violet-600" />
                <span className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{activeScreenshot.name}:</strong> {activeScreenshot.description}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
