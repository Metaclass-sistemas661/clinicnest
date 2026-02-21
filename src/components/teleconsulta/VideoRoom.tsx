import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  MessageSquare,
  Smile,
  Send,
  Maximize2,
  Minimize2,
  X,
  Clock,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import TwilioVideo from "twilio-video";
import type {
  Room,
  LocalParticipant,
  RemoteParticipant,
  LocalTrackPublication,
  RemoteTrackPublication,
  LocalVideoTrack,
  LocalAudioTrack,
  LocalDataTrack,
  RemoteDataTrack,
} from "twilio-video";
import { logger } from "@/lib/logger";

// ---------- Types ----------

type AttachableTrack = {
  attach: () => HTMLElement;
  detach: () => HTMLElement[];
  kind: string;
};

function isAttachableTrack(track: unknown): track is AttachableTrack {
  if (!track || typeof track !== "object") return false;
  const t = track as Record<string, unknown>;
  return typeof t.attach === "function" && typeof t.detach === "function";
}

interface ChatMessage {
  id: string;
  sender: "me" | "remote";
  text: string;
  timestamp: Date;
}

interface VideoRoomProps {
  token: string;
  roomName: string;
  identity: string;
  appointmentLabel: string;
  patientName: string;
  onDisconnect: () => void;
}

// ---------- Emoji Picker ----------

const EMOJI_CATEGORIES = [
  {
    label: "Rostos",
    emojis: ["😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "😊", "😇", "🥰", "😍", "🤩", "😘", "😗", "😋", "😛", "😜", "🤪", "😝", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏", "😒", "🙄", "😬", "😮‍💨", "🤥"],
  },
  {
    label: "Gestos",
    emojis: ["👍", "👎", "👋", "🤝", "👏", "🙌", "👐", "🤲", "🤞", "✌️", "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆", "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "💪"],
  },
  {
    label: "Saúde",
    emojis: ["❤️", "🩺", "💊", "🩹", "🏥", "🧑‍⚕️", "💉", "🩻", "🧬", "🔬", "🌡️", "😷", "🤒", "🤕", "🤢", "🤮", "🤧", "🥴", "😵", "🤯"],
  },
  {
    label: "Objetos",
    emojis: ["📋", "📄", "📝", "✅", "❌", "⚠️", "ℹ️", "❓", "❗", "💬", "🔔", "📞", "📱", "💻", "⏰", "📅"],
  },
];

function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  return (
    <div className="w-72 max-h-64 overflow-y-auto p-2 space-y-3">
      {EMOJI_CATEGORIES.map((cat) => (
        <div key={cat.label}>
          <div className="text-xs font-medium text-muted-foreground mb-1.5">{cat.label}</div>
          <div className="flex flex-wrap gap-1">
            {cat.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSelect(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-accent transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Chat Panel ----------

function ChatPanel({
  messages,
  onSend,
  isOpen,
  onClose,
  unreadCount,
}: {
  messages: ChatMessage[];
  onSend: (text: string) => void;
  isOpen: boolean;
  onClose: () => void;
  unreadCount: number;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="flex flex-col h-full w-full sm:w-80 bg-background border-l border-border">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          <span className="font-medium text-sm">Chat</span>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 min-w-5 text-xs px-1.5">
              {unreadCount}
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-3" ref={scrollRef as any}>
        <div className="space-y-3">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Nenhuma mensagem ainda. Envie uma mensagem para iniciar a conversa.
            </p>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex flex-col max-w-[85%] gap-0.5",
                msg.sender === "me" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-3 py-2 text-sm break-words",
                  msg.sender === "me"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted rounded-bl-md"
                )}
              >
                {msg.text}
              </div>
              <span className="text-[10px] text-muted-foreground px-1">
                {msg.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-3 border-t">
        <div className="flex items-center gap-1.5">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <Smile className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" align="start" className="p-0 w-auto">
              <EmojiPicker onSelect={(emoji) => setText((prev) => prev + emoji)} />
            </PopoverContent>
          </Popover>
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma mensagem..."
            className="h-8 text-sm"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={handleSend}
            disabled={!text.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------- Video Room ----------

export function VideoRoom({
  token,
  roomName,
  identity,
  appointmentLabel,
  patientName,
  onDisconnect,
}: VideoRoomProps) {
  const [room, setRoom] = useState<Room | null>(null);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [remoteConnected, setRemoteConnected] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const callStartRef = useRef<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dataTrackRef = useRef<LocalDataTrack | null>(null);
  const isChatOpenRef = useRef(isChatOpen);

  // Keep ref in sync so the DataTrack listener can read current state
  useEffect(() => { isChatOpenRef.current = isChatOpen; }, [isChatOpen]);

  // Duration timer
  useEffect(() => {
    callStartRef.current = new Date();
    timerRef.current = setInterval(() => {
      if (callStartRef.current) {
        setCallDuration(Math.floor((Date.now() - callStartRef.current.getTime()) / 1000));
      }
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // Attach a single track to a container
  const attachTrack = useCallback((track: AttachableTrack, container: HTMLDivElement) => {
    try {
      const el = track.attach();
      el.style.width = "100%";
      el.style.height = "100%";
      el.style.objectFit = "cover";
      el.style.borderRadius = "12px";
      container.appendChild(el);
    } catch (e) {
      logger.error("attachTrack error:", e);
    }
  }, []);

  // Detach all elements of a track
  const detachTrack = useCallback((track: AttachableTrack) => {
    try {
      track.detach().forEach((el) => el.remove());
    } catch (e) {
      void e;
    }
  }, []);

  // Attach local participant tracks
  const attachLocalTracks = useCallback(
    (participant: LocalParticipant) => {
      if (!localVideoRef.current) return;
      localVideoRef.current.innerHTML = "";
      participant.tracks.forEach((pub: LocalTrackPublication) => {
        if (pub.track && isAttachableTrack(pub.track)) {
          attachTrack(pub.track, localVideoRef.current!);
        }
      });
    },
    [attachTrack]
  );

  // Attach remote participant tracks
  const attachRemoteTracks = useCallback(
    (participant: RemoteParticipant) => {
      if (!remoteVideoRef.current) return;
      participant.tracks.forEach((pub: RemoteTrackPublication) => {
        if (pub.isSubscribed && pub.track && isAttachableTrack(pub.track)) {
          attachTrack(pub.track, remoteVideoRef.current!);
        }
      });

      participant.on("trackSubscribed", (track: unknown) => {
        if (isAttachableTrack(track) && remoteVideoRef.current) {
          attachTrack(track, remoteVideoRef.current);
        }
      });

      participant.on("trackUnsubscribed", (track: unknown) => {
        if (isAttachableTrack(track)) detachTrack(track);
      });
    },
    [attachTrack, detachTrack]
  );

  // Subscribe to remote DataTrack messages
  const subscribeToDataTrack = useCallback((track: RemoteDataTrack) => {
    track.on("message", (data: string) => {
      try {
        const parsed = JSON.parse(data) as { text: string; sender: string };
        const msg: ChatMessage = {
          id: `${Date.now()}-${Math.random()}`,
          sender: "remote",
          text: parsed.text,
          timestamp: new Date(),
        };
        setChatMessages((prev) => [...prev, msg]);
        if (!isChatOpenRef.current) {
          setUnreadCount((prev) => prev + 1);
        }
      } catch {
        // ignore non-JSON messages
      }
    });
  }, []);

  // Listen for DataTracks on a remote participant
  const listenForDataTracks = useCallback(
    (participant: RemoteParticipant) => {
      participant.on("trackSubscribed", (track: unknown) => {
        if (track && typeof track === "object" && "kind" in (track as any) && (track as any).kind === "data") {
          subscribeToDataTrack(track as RemoteDataTrack);
        }
      });
      // Also check already-subscribed tracks
      participant.tracks.forEach((pub: RemoteTrackPublication) => {
        if (pub.isSubscribed && pub.track && (pub.track as any).kind === "data") {
          subscribeToDataTrack(pub.track as unknown as RemoteDataTrack);
        }
      });
    },
    [subscribeToDataTrack]
  );

  // Connect to Twilio room
  useEffect(() => {
    let mounted = true;
    let connectedRoom: Room | null = null;

    const connect = async () => {
      try {
        // Create a LocalDataTrack for chat
        const dataTrack = new TwilioVideo.LocalDataTrack();
        dataTrackRef.current = dataTrack as unknown as LocalDataTrack;

        const r = await TwilioVideo.connect(token, {
          name: roomName,
          audio: true,
          video: { width: 1280, height: 720, frameRate: 24 },
          dominantSpeaker: true,
          networkQuality: { local: 1, remote: 1 },
          tracks: [dataTrack],
        });

        if (!mounted) {
          r.disconnect();
          return;
        }

        connectedRoom = r;
        setRoom(r);
        setIsConnecting(false);

        // Attach local tracks
        attachLocalTracks(r.localParticipant);

        // Handle local track published (for tracks that arrive after connect)
        r.localParticipant.on("trackPublished", () => {
          attachLocalTracks(r.localParticipant);
        });

        // Attach existing remote participants
        r.participants.forEach((p) => {
          setRemoteConnected(true);
          attachRemoteTracks(p);
          listenForDataTracks(p);
        });

        // New remote participant
        r.on("participantConnected", (p: RemoteParticipant) => {
          setRemoteConnected(true);
          attachRemoteTracks(p);
          listenForDataTracks(p);
        });

        // Remote participant left
        r.on("participantDisconnected", (p: RemoteParticipant) => {
          p.tracks.forEach((pub: RemoteTrackPublication) => {
            if (pub.track && isAttachableTrack(pub.track)) detachTrack(pub.track);
          });
          if (r.participants.size === 0) setRemoteConnected(false);
        });

        // Room disconnected
        r.on("disconnected", () => {
          if (mounted) {
            setRoom(null);
            onDisconnect();
          }
        });
      } catch (err) {
        logger.error("Twilio connect error:", err);
        if (mounted) {
          setIsConnecting(false);
          onDisconnect();
        }
      }
    };

    void connect();

    return () => {
      mounted = false;
      dataTrackRef.current = null;
      if (connectedRoom) {
        connectedRoom.disconnect();
      }
    };
  }, [token, roomName, attachLocalTracks, attachRemoteTracks, detachTrack, onDisconnect, listenForDataTracks]);

  // Toggle audio
  const toggleAudio = () => {
    if (!room) return;
    room.localParticipant.audioTracks.forEach((pub) => {
      const track = pub.track as LocalAudioTrack | null;
      if (track) {
        if (track.isEnabled) {
          track.disable();
          setIsAudioEnabled(false);
        } else {
          track.enable();
          setIsAudioEnabled(true);
        }
      }
    });
  };

  // Toggle video
  const toggleVideo = () => {
    if (!room) return;
    room.localParticipant.videoTracks.forEach((pub) => {
      const track = pub.track as LocalVideoTrack | null;
      if (track) {
        if (track.isEnabled) {
          track.disable();
          setIsVideoEnabled(false);
        } else {
          track.enable();
          setIsVideoEnabled(true);
        }
      }
    });
  };

  // Fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (e) {
      void e;
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Chat via Twilio DataTrack
  const sendChatMessage = (text: string) => {
    const msg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      sender: "me",
      text,
      timestamp: new Date(),
    };
    setChatMessages((prev) => [...prev, msg]);

    // Publish via DataTrack so the remote participant receives it
    if (dataTrackRef.current) {
      try {
        (dataTrackRef.current as any).send(JSON.stringify({ text, sender: identity }));
      } catch (e) {
        logger.error("DataTrack send error:", e);
      }
    }
  };

  // Toggle chat
  const toggleChat = () => {
    if (!isChatOpen) setUnreadCount(0);
    setIsChatOpen((prev) => !prev);
  };

  // Disconnect
  const handleDisconnect = () => {
    if (room) {
      room.disconnect();
    }
    onDisconnect();
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col bg-gray-950 text-white overflow-hidden",
        isFullscreen ? "fixed inset-0 z-[100]" : "rounded-xl border border-border"
      )}
      style={{ height: isFullscreen ? "100vh" : "calc(100vh - 200px)", minHeight: "500px" }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/80 backdrop-blur-sm border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-400">AO VIVO</span>
          </div>
          <span className="text-sm font-medium text-gray-300">{appointmentLabel}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-gray-400">
            <Clock className="h-3.5 w-3.5" />
            <span className="text-xs font-mono">{formatDuration(callDuration)}</span>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 relative">
          {/* Remote video (main) */}
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            {isConnecting ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center animate-pulse">
                  <VideoIcon className="h-8 w-8 text-gray-500" />
                </div>
                <span className="text-sm text-gray-400">Conectando...</span>
              </div>
            ) : !remoteConnected ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                  <User className="h-10 w-10 text-gray-500" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-300">{patientName}</p>
                  <p className="text-xs text-gray-500 mt-1">Aguardando paciente entrar...</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            ) : null}
            <div
              ref={remoteVideoRef}
              className={cn(
                "absolute inset-0 overflow-hidden rounded-none",
                !remoteConnected && "hidden"
              )}
            />
          </div>

          {/* Local video (PiP) */}
          <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-gray-700 bg-gray-800 shadow-2xl z-10 group">
            {!isVideoEnabled && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-800 z-10">
                <VideoOff className="h-6 w-6 text-gray-500" />
              </div>
            )}
            <div ref={localVideoRef} className="w-full h-full" />
            <div className="absolute bottom-1.5 left-2 text-[10px] text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
              Você
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <ChatPanel
          messages={chatMessages}
          onSend={sendChatMessage}
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          unreadCount={unreadCount}
        />
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-gray-900/80 backdrop-blur-sm border-t border-gray-800 shrink-0">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAudioEnabled ? "secondary" : "destructive"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleAudio}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isAudioEnabled ? "Desativar microfone" : "Ativar microfone"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoEnabled ? "secondary" : "destructive"}
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={toggleVideo}
              >
                {isVideoEnabled ? <VideoIcon className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isVideoEnabled ? "Desativar câmera" : "Ativar câmera"}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="icon"
                className="h-14 w-14 rounded-full"
                onClick={handleDisconnect}
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Encerrar chamada</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="relative">
                <Button
                  variant={isChatOpen ? "default" : "secondary"}
                  size="icon"
                  className="h-12 w-12 rounded-full"
                  onClick={toggleChat}
                >
                  <MessageSquare className="h-5 w-5" />
                </Button>
                {unreadCount > 0 && !isChatOpen && (
                  <span className="absolute -top-1 -right-1 h-5 min-w-5 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                    {unreadCount}
                  </span>
                )}
              </div>
            </TooltipTrigger>
            <TooltipContent>Chat</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-full"
                onClick={() => void toggleFullscreen()}
              >
                {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{isFullscreen ? "Sair da tela cheia" : "Tela cheia"}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
