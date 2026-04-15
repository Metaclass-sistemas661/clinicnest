/**
 * ToothAttachments — Upload de radiografias e fotos intraorais (F1/F17)
 *
 * Usa Cloud Storage para upload de imagens vinculadas ao dente.
 */
import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ImagePlus, Trash2, X, ZoomIn, Camera } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "dental-attachments";

interface Props {
  toothNumber: number;
  patientId: string;
  tenantId: string;
  attachmentUrls: string[];
  onUrlsChanged: (urls: string[]) => void;
}

export function ToothAttachments({
  toothNumber,
  patientId,
  tenantId,
  attachmentUrls,
  onUrlsChanged,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato não suportado. Use JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Arquivo muito grande. Máximo 5MB.");
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${tenantId}/${patientId}/tooth_${toothNumber}/${Date.now()}.${ext}`;

      const { error: uploadError } = await api.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = api.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = urlData.publicUrl;

      onUrlsChanged([...attachmentUrls, publicUrl]);
      toast.success("Imagem adicionada");
    } catch (err) {
      logger.error("Erro no upload:", err);
      toast.error("Erro ao fazer upload da imagem");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const handleRemove = async (url: string) => {
    try {
      // Extract path from public URL for deletion
      const bucketUrl = api.storage.from(BUCKET).getPublicUrl("").data.publicUrl;
      const path = url.replace(bucketUrl, "");
      if (path) {
        await api.storage.from(BUCKET).remove([path]);
      }
      onUrlsChanged(attachmentUrls.filter((u) => u !== url));
      toast.success("Imagem removida");
    } catch (err) {
      logger.error("Erro ao remover imagem:", err);
      toast.error("Erro ao remover imagem");
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Camera className="h-4 w-4" />
            Radiografias / Fotos — Dente {toothNumber}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {attachmentUrls.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {attachmentUrls.map((url, idx) => (
                <div
                  key={idx}
                  className="relative group rounded-lg overflow-hidden border aspect-square bg-muted"
                >
                  <img
                    src={url}
                    alt={`Dente ${toothNumber} - ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-white/20"
                      onClick={() => setPreviewUrl(url)}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-white hover:bg-red-500/50"
                      onClick={() => handleRemove(url)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileSelect}
          />
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4 mr-2" />
            {uploading ? "Enviando..." : "Adicionar Imagem"}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Dente {toothNumber}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img
              src={previewUrl}
              alt={`Dente ${toothNumber}`}
              className="w-full rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
