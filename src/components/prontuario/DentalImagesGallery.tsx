import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Camera, Image as ImageIcon, Upload, Trash2, Loader2, 
  ZoomIn, ZoomOut, RotateCw, Download, X, Eye, FileX2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const IMAGE_TYPES = {
  intraoral: [
    { value: "intraoral_frontal", label: "Frontal" },
    { value: "intraoral_lateral_direita", label: "Lateral Direita" },
    { value: "intraoral_lateral_esquerda", label: "Lateral Esquerda" },
    { value: "intraoral_oclusal_superior", label: "Oclusal Superior" },
    { value: "intraoral_oclusal_inferior", label: "Oclusal Inferior" },
    { value: "intraoral_outro", label: "Outro" },
  ],
  radiografia: [
    { value: "rx_panoramica", label: "Panorâmica" },
    { value: "rx_periapical", label: "Periapical" },
    { value: "rx_interproximal", label: "Interproximal (Bite-wing)" },
    { value: "rx_oclusal", label: "Oclusal" },
    { value: "tomografia", label: "Tomografia" },
    { value: "outro", label: "Outro" },
  ],
};

interface DentalImage {
  id: string;
  image_type: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  tooth_numbers: number[] | null;
  description: string | null;
  clinical_notes: string | null;
  rx_technique: string | null;
  captured_at: string;
  professional_name: string | null;
}

interface Props {
  tenantId: string;
  patientId: string;
  professionalId: string;
  medicalRecordId?: string | null;
  appointmentId?: string | null;
  readOnly?: boolean;
}

function getImageTypeLabel(type: string): string {
  const all = [...IMAGE_TYPES.intraoral, ...IMAGE_TYPES.radiografia];
  return all.find(t => t.value === type)?.label || type;
}

function isRadiografia(type: string): boolean {
  return type.startsWith("rx_") || type === "tomografia" || type === "outro";
}

export function DentalImagesGallery({ 
  tenantId, 
  patientId, 
  professionalId, 
  medicalRecordId,
  appointmentId,
  readOnly = false 
}: Props) {
  const [images, setImages] = useState<DentalImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [viewerDialog, setViewerDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<DentalImage | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  
  const [uploadForm, setUploadForm] = useState({
    file: null as File | null,
    image_type: "intraoral_frontal",
    description: "",
    clinical_notes: "",
    tooth_numbers: "",
    rx_technique: "",
  });

  const fetchImages = useCallback(async () => {
    if (!tenantId || !patientId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_client_dental_images', {
        p_tenant_id: tenantId,
        p_client_id: patientId,
      });
      if (error) throw error;
      setImages((data || []) as DentalImage[]);
    } catch (err) {
      console.error('Erro ao carregar imagens:', err);
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, patientId]);

  useEffect(() => {
    void fetchImages();
  }, [fetchImages]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast.error("Arquivo muito grande. Máximo: 50MB");
        return;
      }
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async () => {
    if (!uploadForm.file) {
      toast.error("Selecione um arquivo");
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = uploadForm.file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${tenantId}/${patientId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('dental-images')
        .upload(filePath, uploadForm.file);

      if (uploadError) throw uploadError;

      const toothNumbers = uploadForm.tooth_numbers
        ? uploadForm.tooth_numbers.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
        : null;

      const { error: insertError } = await supabase
        .from('dental_images')
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          professional_id: professionalId,
          medical_record_id: medicalRecordId || null,
          appointment_id: appointmentId || null,
          image_type: uploadForm.image_type,
          file_name: uploadForm.file.name,
          file_path: filePath,
          file_size: uploadForm.file.size,
          mime_type: uploadForm.file.type,
          description: uploadForm.description || null,
          clinical_notes: uploadForm.clinical_notes || null,
          tooth_numbers: toothNumbers,
          rx_technique: uploadForm.rx_technique || null,
          created_by: professionalId,
        });

      if (insertError) throw insertError;

      toast.success("Imagem enviada com sucesso");
      setUploadDialog(false);
      setUploadForm({
        file: null,
        image_type: "intraoral_frontal",
        description: "",
        clinical_notes: "",
        tooth_numbers: "",
        rx_technique: "",
      });
      await fetchImages();
    } catch (err: any) {
      console.error('Erro ao enviar imagem:', err);
      toast.error(err.message || "Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleViewImage = async (image: DentalImage) => {
    setSelectedImage(image);
    setZoom(1);
    setRotation(0);
    
    try {
      const { data } = await supabase.storage
        .from('dental-images')
        .createSignedUrl(image.file_path, 3600);
      
      if (data?.signedUrl) {
        setViewerUrl(data.signedUrl);
        setViewerDialog(true);
      }
    } catch (err) {
      console.error('Erro ao carregar imagem:', err);
      toast.error("Erro ao carregar imagem");
    }
  };

  const handleDeleteImage = async (image: DentalImage) => {
    if (!confirm("Deseja realmente excluir esta imagem?")) return;

    try {
      await supabase.storage.from('dental-images').remove([image.file_path]);
      await supabase.from('dental_images').delete().eq('id', image.id);
      toast.success("Imagem excluída");
      await fetchImages();
    } catch (err: any) {
      console.error('Erro ao excluir:', err);
      toast.error(err.message || "Erro ao excluir imagem");
    }
  };

  const handleDownload = async () => {
    if (!selectedImage || !viewerUrl) return;
    const link = document.createElement('a');
    link.href = viewerUrl;
    link.download = selectedImage.file_name;
    link.click();
  };

  const intraoralImages = images.filter(img => img.image_type.startsWith('intraoral'));
  const radiografiaImages = images.filter(img => isRadiografia(img.image_type));

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-muted-foreground">Carregando imagens...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Imagens Odontológicas
              </CardTitle>
              <CardDescription>Fotos intraorais e radiografias do paciente</CardDescription>
            </div>
            {!readOnly && (
              <Button size="sm" onClick={() => setUploadDialog(true)}>
                <Upload className="h-3 w-3 mr-1" />
                Enviar Imagem
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="intraoral">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="intraoral" className="gap-1">
                <Camera className="h-3 w-3" />
                Fotos Intraorais ({intraoralImages.length})
              </TabsTrigger>
              <TabsTrigger value="radiografia" className="gap-1">
                <ImageIcon className="h-3 w-3" />
                Radiografias ({radiografiaImages.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="intraoral" className="mt-4">
              {intraoralImages.length === 0 ? (
                <div className="text-center py-8">
                  <Camera className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma foto intraoral registrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {intraoralImages.map(img => (
                    <ImageCard 
                      key={img.id} 
                      image={img} 
                      onView={() => handleViewImage(img)}
                      onDelete={() => handleDeleteImage(img)}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="radiografia" className="mt-4">
              {radiografiaImages.length === 0 ? (
                <div className="text-center py-8">
                  <FileX2 className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Nenhuma radiografia registrada</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {radiografiaImages.map(img => (
                    <ImageCard 
                      key={img.id} 
                      image={img} 
                      onView={() => handleViewImage(img)}
                      onDelete={() => handleDeleteImage(img)}
                      readOnly={readOnly}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar Imagem Odontológica</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de Imagem</Label>
              <Select 
                value={uploadForm.image_type} 
                onValueChange={v => setUploadForm(prev => ({ ...prev, image_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">Fotos Intraorais</div>
                  {IMAGE_TYPES.intraoral.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-xs font-semibold text-muted-foreground mt-2">Radiografias</div>
                  {IMAGE_TYPES.radiografia.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Arquivo</Label>
              <Input 
                type="file" 
                accept="image/*,.dcm"
                onChange={handleFileChange}
              />
              {uploadForm.file && (
                <p className="text-xs text-muted-foreground">
                  {uploadForm.file.name} ({(uploadForm.file.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Dentes Relacionados (opcional)</Label>
              <Input
                value={uploadForm.tooth_numbers}
                onChange={e => setUploadForm(prev => ({ ...prev, tooth_numbers: e.target.value }))}
                placeholder="Ex: 11, 12, 21"
              />
            </div>

            {isRadiografia(uploadForm.image_type) && (
              <div className="space-y-2">
                <Label>Técnica Radiográfica</Label>
                <Input
                  value={uploadForm.rx_technique}
                  onChange={e => setUploadForm(prev => ({ ...prev, rx_technique: e.target.value }))}
                  placeholder="Ex: Paralelismo, Bissetriz..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={uploadForm.description}
                onChange={e => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Breve descrição da imagem"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações Clínicas</Label>
              <Textarea
                value={uploadForm.clinical_notes}
                onChange={e => setUploadForm(prev => ({ ...prev, clinical_notes: e.target.value }))}
                placeholder="Achados clínicos relevantes..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(false)}>Cancelar</Button>
            <Button onClick={handleUpload} disabled={isUploading || !uploadForm.file}>
              {isUploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Viewer Dialog */}
      <Dialog open={viewerDialog} onOpenChange={setViewerDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedImage && (
                <>
                  <Badge variant="outline">{getImageTypeLabel(selectedImage.image_type)}</Badge>
                  <span className="text-sm font-normal text-muted-foreground">
                    {new Date(selectedImage.captured_at).toLocaleDateString("pt-BR")}
                  </span>
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ minHeight: "400px" }}>
            {viewerUrl && (
              <img
                src={viewerUrl}
                alt={selectedImage?.description || "Imagem odontológica"}
                className="w-full h-full object-contain transition-transform"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  maxHeight: "60vh",
                }}
              />
            )}
            
            {/* Viewer Controls */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/70 rounded-lg p-2">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={() => setRotation(r => r + 90)}>
                <RotateCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white" onClick={handleDownload}>
                <Download className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {selectedImage && (
            <div className="space-y-2 text-sm">
              {selectedImage.description && (
                <p><span className="font-medium">Descrição:</span> {selectedImage.description}</p>
              )}
              {selectedImage.clinical_notes && (
                <p><span className="font-medium">Observações:</span> {selectedImage.clinical_notes}</p>
              )}
              {selectedImage.tooth_numbers && selectedImage.tooth_numbers.length > 0 && (
                <p><span className="font-medium">Dentes:</span> {selectedImage.tooth_numbers.join(", ")}</p>
              )}
              {selectedImage.rx_technique && (
                <p><span className="font-medium">Técnica:</span> {selectedImage.rx_technique}</p>
              )}
              {selectedImage.professional_name && (
                <p className="text-xs text-muted-foreground">Registrado por: {selectedImage.professional_name}</p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ImageCard({ image, onView, onDelete, readOnly }: { 
  image: DentalImage; 
  onView: () => void; 
  onDelete: () => void;
  readOnly: boolean;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    const loadThumb = async () => {
      try {
        const { data } = await supabase.storage
          .from('dental-images')
          .createSignedUrl(image.file_path, 3600);
        if (data?.signedUrl) setThumbUrl(data.signedUrl);
      } catch (err) {
        console.error('Erro ao carregar thumbnail:', err);
      }
    };
    void loadThumb();
  }, [image.file_path]);

  return (
    <div className="group relative rounded-lg border overflow-hidden bg-muted/30">
      <div className="aspect-square relative">
        {thumbUrl ? (
          <img 
            src={thumbUrl} 
            alt={image.description || "Imagem"} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={onView}>
            <Eye className="h-4 w-4" />
          </Button>
          {!readOnly && (
            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={onDelete}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      
      <div className="p-2">
        <Badge variant="outline" className="text-[10px] mb-1">
          {getImageTypeLabel(image.image_type)}
        </Badge>
        <p className="text-[10px] text-muted-foreground truncate">
          {new Date(image.captured_at).toLocaleDateString("pt-BR")}
        </p>
      </div>
    </div>
  );
}
