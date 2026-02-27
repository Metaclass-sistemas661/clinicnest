import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Volume2, VolumeX, Maximize, Users, Clock, CheckCircle, History, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWaitingQueue,
  useCurrentCall,
  useQueueStatistics,
  useQueueRealtime,
  PRIORITY_COLORS,
} from "@/hooks/usePatientQueue";
import { useAuth } from "@/contexts/AuthContext";

interface RecentCall {
  id: string;
  name: string;
  room: string | null;
  time: Date;
}

export default function PainelChamada() {
  const { tenant } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [welcomeMessage] = useState("Bem-vindo! Aguarde sua chamada.");

  const { data: queue } = useWaitingQueue(10);
  const { data: currentCall } = useCurrentCall();
  const { data: stats } = useQueueStatistics();

  useQueueRealtime();

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto dark/light mode based on time
  useEffect(() => {
    const hour = currentTime.getHours();
    const shouldBeDark = hour < 7 || hour >= 19;
    setIsDarkMode(shouldBeDark);
  }, [currentTime.getHours()]);

  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    const voices = speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang.startsWith("pt") && v.name.includes("Brazil")
    ) || voices.find((v) => v.lang.startsWith("pt"));
    
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    speechSynthesis.cancel();
    speechSynthesis.speak(utterance);
  }, [ttsEnabled]);

  useEffect(() => {
    if (currentCall && currentCall.call_id !== lastCalledId) {
      setLastCalledId(currentCall.call_id);
      
      // Add to recent calls
      setRecentCalls(prev => {
        const newCall: RecentCall = {
          id: currentCall.call_id,
          name: currentCall.client_name || "Paciente",
          room: currentCall.room_name,
          time: new Date(),
        };
        return [newCall, ...prev].slice(0, 5);
      });
      
      const roomText = currentCall.room_name 
        ? `, ${currentCall.room_name}` 
        : "";
      
      speak(`${currentCall.client_name}${roomText}`);
    }
  }, [currentCall, lastCalledId, speak]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const priorityColor = currentCall?.priority 
    ? PRIORITY_COLORS[currentCall.priority as keyof typeof PRIORITY_COLORS] 
    : PRIORITY_COLORS[5];

  const bgClass = isDarkMode 
    ? "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white"
    : "bg-gradient-to-br from-slate-100 via-white to-slate-100 text-slate-900";

  const headerBorderClass = isDarkMode ? "border-slate-700" : "border-slate-200";
  const cardBgClass = isDarkMode ? "bg-slate-800/50" : "bg-white/80 shadow-sm";
  const mutedTextClass = isDarkMode ? "text-slate-400" : "text-slate-500";

  return (
    <div className={cn("min-h-screen flex flex-col transition-colors duration-500", bgClass)}>
      {/* Header */}
      <header className={cn("flex items-center justify-between px-8 py-4 border-b", headerBorderClass)}>
        <div className="flex items-center gap-4">
          {/* Logo da Clínica */}
          {tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.name || "Logo"} className="h-10 w-auto" />
          ) : (
            <div className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center font-bold text-lg",
              isDarkMode ? "bg-teal-600 text-white" : "bg-teal-500 text-white"
            )}>
              {tenant?.name?.charAt(0) || "C"}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{tenant?.name || "Painel de Chamada"}</h1>
            <div className={cn("flex items-center gap-2 text-sm", mutedTextClass)}>
              <Users className="h-4 w-4" />
              <span>{stats?.waiting_count ?? 0} aguardando</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-3xl font-mono tabular-nums">
            {format(currentTime, "HH:mm:ss")}
          </div>
          <div className={mutedTextClass}>
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(mutedTextClass, "hover:text-current")}
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className={cn(mutedTextClass, "hover:text-current")}
          >
            {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className={cn(mutedTextClass, "hover:text-current")}
          >
            <Maximize className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex">
        {/* Chamada Atual - 2/3 da tela */}
        <div className="flex-[2] flex items-center justify-center p-8">
          {currentCall ? (
            <div className="text-center animate-pulse-slow">
              <div className="mb-4">
                <span className={cn(
                  "px-4 py-2 rounded-full text-lg font-semibold",
                  priorityColor.bg,
                  priorityColor.text
                )}>
                  Senha {currentCall.call_number?.toString().padStart(3, "0")}
                </span>
              </div>
              
              <h2 className="text-7xl md:text-8xl lg:text-9xl font-bold mb-8 tracking-tight">
                {currentCall.client_name?.split(" ").slice(0, 2).join(" ")}
              </h2>
              
              {currentCall.room_name && (
                <div className="text-4xl md:text-5xl text-emerald-500 font-semibold">
                  {currentCall.room_name}
                </div>
              )}
              
              {currentCall.professional_name && (
                <div className={cn("text-2xl mt-4", mutedTextClass)}>
                  {currentCall.professional_name}
                </div>
              )}
              
              {currentCall.times_called > 1 && (
                <div className="mt-6 text-yellow-500 text-xl">
                  Chamada #{currentCall.times_called}
                </div>
              )}
            </div>
          ) : (
            <div className={cn("text-center", mutedTextClass)}>
              <Clock className="h-24 w-24 mx-auto mb-4 opacity-50" />
              <p className="text-3xl">{welcomeMessage}</p>
            </div>
          )}
        </div>

        {/* Sidebar - 1/3 da tela */}
        <div className={cn("flex-1 border-l p-6 overflow-hidden flex flex-col gap-6", headerBorderClass, cardBgClass)}>
          {/* Fila de Espera */}
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="h-5 w-5" />
              Fila de Espera
            </h3>
            
            {queue && queue.length > 0 ? (
              <div className="space-y-2">
                {queue.slice(0, 6).map((patient, index) => {
                  const pColor = PRIORITY_COLORS[patient.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[5];
                  
                  return (
                    <div
                      key={patient.call_id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg transition-all",
                        index === 0 
                          ? isDarkMode ? "bg-slate-700 border-l-4 border-emerald-500" : "bg-emerald-50 border-l-4 border-emerald-500"
                          : isDarkMode ? "bg-slate-800/50" : "bg-slate-50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                        pColor.bg,
                        pColor.text
                      )}>
                        {patient.call_number?.toString().padStart(2, "0")}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-sm">
                          {patient.client_name}
                        </div>
                        <div className={cn("text-xs flex items-center gap-1", mutedTextClass)}>
                          <Clock className="h-3 w-3" />
                          {patient.wait_time_minutes} min
                        </div>
                      </div>
                      
                      <div className={cn("text-xl font-bold", mutedTextClass)}>
                        #{patient.queue_position}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className={cn("text-center py-6", mutedTextClass)}>
                <CheckCircle className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum paciente aguardando</p>
              </div>
            )}
          </div>

          {/* Histórico de Chamadas Recentes */}
          {recentCalls.length > 0 && (
            <div>
              <h3 className={cn("text-sm font-semibold mb-2 flex items-center gap-2", mutedTextClass)}>
                <History className="h-4 w-4" />
                Chamadas Recentes
              </h3>
              <div className="space-y-1">
                {recentCalls.map((call) => (
                  <div
                    key={call.id}
                    className={cn("flex items-center gap-2 text-xs p-2 rounded", isDarkMode ? "bg-slate-800/30" : "bg-slate-100")}
                  >
                    <span className="flex-1 truncate">{call.name}</span>
                    {call.room && <span className={mutedTextClass}>{call.room}</span>}
                    <span className={mutedTextClass}>{format(call.time, "HH:mm")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer Stats */}
      <footer className={cn("px-8 py-3 border-t flex items-center justify-between text-sm", headerBorderClass, mutedTextClass)}>
        <div className="flex items-center gap-6">
          <span>Atendidos: <strong className={isDarkMode ? "text-white" : "text-slate-900"}>{stats?.completed_count ?? 0}</strong></span>
          <span>Em atendimento: <strong className="text-emerald-500">{stats?.in_service_count ?? 0}</strong></span>
          <span>Não compareceram: <strong className="text-red-500">{stats?.no_show_count ?? 0}</strong></span>
        </div>
        <div>
          Tempo médio: <strong className={isDarkMode ? "text-white" : "text-slate-900"}>
            {stats?.avg_wait_time_minutes ? `${Math.round(stats.avg_wait_time_minutes)} min` : "—"}
          </strong>
        </div>
      </footer>

      <style>{`
        @keyframes pulse-slow {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .animate-pulse-slow {
          animation: pulse-slow 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
