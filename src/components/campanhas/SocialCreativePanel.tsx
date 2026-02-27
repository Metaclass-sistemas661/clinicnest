/**
 * SocialCreativePanel
 * Renders campaign content as Instagram Stories, Feed and WhatsApp Status previews.
 * Provides a download-as-PNG button using html2canvas.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import type { BuilderState } from "./emailHtml";

type SocialFormat = "stories" | "feed" | "whatsapp";

// Aspect ratios
const FORMAT_META: Record<SocialFormat, { label: string; width: number; height: number; hint: string }> = {
  stories:  { label: "Stories",       width: 1080, height: 1920, hint: "Instagram Stories · 1080×1920" },
  feed:     { label: "Feed",           width: 1080, height: 1350, hint: "Instagram Feed 4:5 · 1080×1350" },
  whatsapp: { label: "Status",         width: 1080, height: 1920, hint: "WhatsApp Status · 1080×1920"   },
};

// Display width in pixels for the preview card
const PREVIEW_W = 260;

function calcDisplayHeight(format: SocialFormat) {
  const { width, height } = FORMAT_META[format];
  return Math.round((PREVIEW_W / width) * height);
}

// ─── Creative card (the visual rendered into canvas) ─────────────────────────

interface CardProps {
  state: BuilderState;
  format: SocialFormat;
  /** When true, uses absolute pixel sizes (for html2canvas capture) */
  forExport?: boolean;
}

function CreativeCard({ state, format, forExport = false }: CardProps) {
  const meta = FORMAT_META[format];
  const scale = forExport ? 1 : PREVIEW_W / meta.width;
  const w = forExport ? meta.width : PREVIEW_W;
  const h = forExport ? meta.height : calcDisplayHeight(format);

  const bg = state.useGradient
    ? `linear-gradient(160deg, ${state.primaryColor} 0%, ${state.secondaryColor} 100%)`
    : state.primaryColor;

  const fontSize = (base: number) => Math.round(base * scale);

  // Date label
  const dateLabel = (() => {
    const { startDate, endDate } = state;
    if (startDate && endDate) {
      const fmt = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
      return `📅 ${fmt(startDate)} até ${fmt(endDate)}`;
    }
    return "";
  })();

  return (
    <div
      style={{
        width: w,
        height: h,
        position: "relative",
        overflow: "hidden",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
        background: bg,
        borderRadius: forExport ? 0 : 12,
        flexShrink: 0,
      }}
    >
      {/* Top brand strip */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          padding: `${Math.round(22 * scale)}px ${Math.round(28 * scale)}px`,
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontSize: fontSize(28),
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -0.5,
            textShadow: "0 1px 4px rgba(0,0,0,0.3)",
          }}
        >
          {state.clinicName || "Sua Clínica"}
        </div>
        {format === "stories" || format === "whatsapp" ? (
          <div
            style={{
              display: "inline-block",
              marginTop: Math.round(8 * scale),
              background: "rgba(255,255,255,0.25)",
              color: "#fff",
              fontSize: fontSize(14),
              fontWeight: 700,
              padding: `${Math.round(3 * scale)}px ${Math.round(12 * scale)}px`,
              borderRadius: 40,
              letterSpacing: 1.2,
              textTransform: "uppercase" as const,
            }}
          >
            {format === "stories" ? "Stories" : "Status"}
          </div>
        ) : null}
      </div>

      {/* Banner image (upper half) */}
      {state.bannerUrl.trim().startsWith("http") ? (
        <img
          src={state.bannerUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: "absolute",
            top: "28%",
            left: 0,
            right: 0,
            width: "100%",
            height: "38%",
            objectFit: "cover",
          }}
        />
      ) : (
        /* Decorative placeholder circles when no image */
        <>
          <div
            style={{
              position: "absolute",
              top: "25%",
              right: "-10%",
              width: "55%",
              height: "55%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.10)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "15%",
              left: "-15%",
              width: "45%",
              height: "45%",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
            }}
          />
        </>
      )}

      {/* Content card (bottom portion) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          background: "#ffffff",
          borderRadius: `${Math.round(24 * scale)}px ${Math.round(24 * scale)}px 0 0`,
          padding: `${Math.round(28 * scale)}px ${Math.round(32 * scale)}px ${Math.round(36 * scale)}px`,
        }}
      >
        {/* Headline */}
        <div
          style={{
            fontSize: fontSize(38),
            fontWeight: 800,
            color: "#111827",
            lineHeight: 1.2,
            letterSpacing: -0.5,
            marginBottom: Math.round(12 * scale),
          }}
        >
          {state.headline || "Título da Campanha"}
        </div>

        {/* Subheadline */}
        {state.subheadline ? (
          <div
            style={{
              fontSize: fontSize(20),
              color: "#6b7280",
              lineHeight: 1.4,
              marginBottom: Math.round(16 * scale),
            }}
          >
            {state.subheadline}
          </div>
        ) : null}

        {/* Date badge */}
        {dateLabel ? (
          <div
            style={{
              fontSize: fontSize(16),
              color: "#9ca3af",
              marginBottom: Math.round(20 * scale),
            }}
          >
            {dateLabel}
          </div>
        ) : null}

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: `${state.primaryColor}30`,
            marginBottom: Math.round(20 * scale),
          }}
        />

        {/* CTA button */}
        <div
          style={{
            display: "inline-block",
            background: state.ctaColor,
            color: "#ffffff",
            fontSize: fontSize(20),
            fontWeight: 700,
            padding: `${Math.round(14 * scale)}px ${Math.round(36 * scale)}px`,
            borderRadius: 60,
            letterSpacing: 0.3,
          }}
        >
          {state.ctaText || "Agendar Agora"}
        </div>
      </div>
    </div>
  );
}

// ─── Download handler ─────────────────────────────────────────────────────────

async function downloadCreative(ref: React.RefObject<HTMLDivElement>, filename: string) {
  const html2canvas = (await import("html2canvas")).default;
  if (!ref.current) return;
  const canvas = await html2canvas(ref.current, {
    scale: 4,
    useCORS: true,
    allowTaint: false,
    backgroundColor: null,
    logging: false,
  });
  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

// ─── Format sub-tabs ──────────────────────────────────────────────────────────

const FORMATS: { id: SocialFormat; emoji: string; label: string }[] = [
  { id: "stories",  emoji: "📱", label: "Stories"  },
  { id: "feed",     emoji: "🖼️", label: "Feed 4:5" },
  { id: "whatsapp", emoji: "💬", label: "WhatsApp" },
];

// ─── Main panel ───────────────────────────────────────────────────────────────

interface SocialCreativePanelProps {
  state: BuilderState;
  format: "stories" | "feed" | "whatsapp";
}

export default function SocialCreativePanel({ state, format }: SocialCreativePanelProps) {
  const [activeFormat, setActiveFormat] = useState<SocialFormat>(format);
  const [isDownloading, setIsDownloading] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const meta = FORMAT_META[activeFormat];
  const displayH = calcDisplayHeight(activeFormat);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadCreative(previewRef as React.RefObject<HTMLDivElement>, `campanha-${activeFormat}.png`);
    } catch {
      // silent — user will see nothing downloaded
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-muted/20 overflow-auto">
      {/* Format sub-tabs */}
      <div className="flex items-center gap-1 px-4 pt-4 pb-2 flex-shrink-0">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setActiveFormat(f.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
              activeFormat === f.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:border-primary/50"
            }`}
          >
            {f.emoji} {f.label}
          </button>
        ))}
      </div>

      {/* Hint */}
      <p className="text-xs text-muted-foreground px-4 pb-3">{meta.hint}</p>

      {/* Preview */}
      <div className="flex-1 flex flex-col items-center overflow-auto pb-6 px-4 gap-4">
        <div
          ref={previewRef}
          style={{ width: PREVIEW_W, height: displayH, borderRadius: 12 }}
          className="shadow-xl flex-shrink-0"
        >
          <CreativeCard state={state} format={activeFormat} />
        </div>

        {/* Download button */}
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleDownload}
          disabled={isDownloading}
        >
          {isDownloading ? (
            <><Loader2 className="h-4 w-4 animate-spin" />Gerando...</>
          ) : (
            <><Download className="h-4 w-4" />Baixar PNG</>
          )}
        </Button>

        <p className="text-xs text-muted-foreground text-center max-w-[260px]">
          Baixe a imagem e publique no Instagram ou WhatsApp. Edite o conteúdo no painel esquerdo e a prévia atualiza automaticamente.
        </p>
      </div>
    </div>
  );
}
