import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Paperclip, X, FileIcon, ImageIcon, Loader2 } from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";

export interface Attachment {
  name: string;
  size: number;
  type: string;
  url: string;
}

interface AttachmentUploadProps {
  attachments: Attachment[];
  onAttachmentsChange: (attachments: Attachment[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isImageType(type: string): boolean {
  return type.startsWith("image/");
}

export function AttachmentUpload({
  attachments,
  onAttachmentsChange,
  maxFiles = 5,
  maxSizeMB = 10,
  disabled,
}: AttachmentUploadProps) {
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0 || !profile?.tenant_id) return;

      const remainingSlots = maxFiles - attachments.length;
      if (remainingSlots <= 0) {
        toast.error(`Máximo de ${maxFiles} arquivos permitido`);
        return;
      }

      const filesToUpload = Array.from(files).slice(0, remainingSlots);
      const maxSizeBytes = maxSizeMB * 1024 * 1024;

      setIsUploading(true);
      const newAttachments: Attachment[] = [];

      for (const file of filesToUpload) {
        if (!ALLOWED_TYPES.includes(file.type)) {
          toast.error(`Tipo de arquivo não permitido: ${file.name}`);
          continue;
        }

        if (file.size > maxSizeBytes) {
          toast.error(`Arquivo muito grande: ${file.name} (máx ${maxSizeMB}MB)`);
          continue;
        }

        try {
          const fileName = `${profile.tenant_id}/chat/${Date.now()}_${file.name}`;
          const { data, error } = await api.storage
            .from("attachments")
            .upload(fileName, file, {
              cacheControl: "3600",
              upsert: false,
            });

          if (error) throw error;

          const { data: urlData } = api.storage
            .from("attachments")
            .getPublicUrl(data.path);

          newAttachments.push({
            name: file.name,
            size: file.size,
            type: file.type,
            url: urlData.publicUrl,
          });
        } catch (err) {
          logger.error("AttachmentUpload error:", err);
          toast.error(`Erro ao enviar: ${file.name}`);
        }
      }

      if (newAttachments.length > 0) {
        onAttachmentsChange([...attachments, ...newAttachments]);
      }

      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [attachments, maxFiles, maxSizeMB, onAttachmentsChange, profile?.tenant_id]
  );

  const removeAttachment = (index: number) => {
    const newAttachments = attachments.filter((_, i) => i !== index);
    onAttachmentsChange(newAttachments);
  };

  return (
    <div className="space-y-2">
      <Input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_TYPES.join(",")}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading || attachments.length >= maxFiles}
        className="h-8 px-2"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>

      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((attachment, index) => (
            <div
              key={index}
              className={cn(
                "relative group flex items-center gap-2 px-2 py-1 rounded-md border bg-muted/50",
                "text-xs max-w-[200px]"
              )}
            >
              {isImageType(attachment.type) ? (
                <ImageIcon className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              ) : (
                <FileIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="truncate">{attachment.name}</span>
              <span className="text-muted-foreground flex-shrink-0">
                ({formatFileSize(attachment.size)})
              </span>
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
