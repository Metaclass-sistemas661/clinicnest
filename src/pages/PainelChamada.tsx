import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Volume2, VolumeX, Maximize, Users, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useWaitingQueue,
  useCurrentCall,
  useQueueStatistics,
  useQueueRealtime,
  PRIORITY_COLORS,
} from "@/hooks/usePatientQueue";

export default function PainelChamada() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [lastCalledId, setLastCalledId] = useState<string | null>(null);

  const { data: queue } = useWaitingQueue(10);
  const { data: currentCall } = useCurrentCall();
  const { data: stats } = useQueueStatistics();

  // Ativa realtime
  useQueueRealtime();

  // Atualiza relógio
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Text-to-Speech
  const speak = useCallback((text: string) => {
    if (!ttsEnabled || !("speechSynthesis" in window)) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    // Tenta usar voz brasileira
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

  // Chama quando muda o paciente atual
  useEffect(() => {
    if (currentCall && currentCall.call_id !== lastCalledId) {
      setLastCalledId(currentCall.call_id);
      
      const roomText = currentCall.room_name 
        ? `, ${currentCall.room_name}` 
        : "";
      
      speak(`${currentCall.client_name}${roomText}`);
    }
  }, [currentCall, lastCalledId, speak]);

  // Fullscreen
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">Painel de Chamada</h1>
          <div className="flex items-center gap-2 text-slate-400">
            <Users className="h-5 w-5" />
            <span>{stats?.waiting_count ?? 0} aguardando</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-3xl font-mono tabular-nums">
            {format(currentTime, "HH:mm:ss")}
          </div>
          <div className="text-slate-400">
            {format(currentTime, "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTtsEnabled(!ttsEnabled)}
            className="text-slate-400 hover:text-white"
          >
            {ttsEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-slate-400 hover:text-white"
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
                <div className="text-4xl md:text-5xl text-emerald-400 font-semibold">
                  {currentCall.room_name}
                </div>
              )}
              
              {currentCall.professional_name && (
                <div className="text-2xl text-slate-400 mt-4">
                  {currentCall.professional_name}
                </div>
              )}
              
              {currentCall.times_called > 1 && (
                <div className="mt-6 text-yellow-400 text-xl">
                  Chamada #{currentCall.times_called}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-slate-500">
              <Clock className="h-24 w-24 mx-auto mb-4 opacity-50" />
              <p className="text-3xl">Aguardando próximo paciente...</p>
            </div>
          )}
        </div>

        {/* Fila de Espera - 1/3 da tela */}
        <div className="flex-1 bg-slate-800/50 border-l border-slate-700 p-6 overflow-hidden">
          <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-5 w-5" />
            Fila de Espera
          </h3>
          
          {queue && queue.length > 0 ? (
            <div className="space-y-3">
              {queue.map((patient, index) => {
                const pColor = PRIORITY_COLORS[patient.priority as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS[5];
                
                return (
                  <div
                    key={patient.call_id}
                    className={cn(
                      "flex items-center gap-4 p-4 rounded-lg transition-all",
                      index === 0 
                        ? "bg-slate-700 border-l-4 border-emerald-500" 
                        : "bg-slate-800/50"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg",
                      pColor.bg,
                      pColor.text
                    )}>
                      {patient.call_number?.toString().padStart(2, "0")}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">
                        {patient.client_name}
                      </div>
                      <div className="text-sm text-slate-400 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        {patient.wait_time_minutes} min
                        {patient.priority_label && (
                          <span className={cn(
                            "px-2 py-0.5 rounded text-xs",
                            pColor.bg,
                            pColor.text
                          )}>
                            {patient.priority_label}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-2xl font-bold text-slate-500">
                      #{patient.position}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center text-slate-500 py-8">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum paciente aguardando</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer Stats */}
      <footer className="px-8 py-4 border-t border-slate-700 flex items-center justify-between text-sm text-slate-400">
        <div className="flex items-center gap-6">
          <span>Atendidos hoje: <strong className="text-white">{stats?.completed_count ?? 0}</strong></span>
          <span>Em atendimento: <strong className="text-emerald-400">{stats?.in_service_count ?? 0}</strong></span>
          <span>Não compareceram: <strong className="text-red-400">{stats?.no_show_count ?? 0}</strong></span>
        </div>
        <div>
          Tempo médio de espera: <strong className="text-white">
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
