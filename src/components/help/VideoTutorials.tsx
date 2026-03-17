import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Play, CheckCircle2, Clock, PlayCircle, X, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoTutorial {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  category: string;
  feature_key: string | null;
}

interface VideoProgress {
  video_id: string;
  watched_seconds: number;
  completed: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Começando": "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  "Agenda": "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "Pacientes": "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "Clínico": "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  "Financeiro": "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "Relatórios": "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "Portal": "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function VideoTutorials() {
  const { user } = useAuth();
  const [tutorials, setTutorials] = useState<VideoTutorial[]>([]);
  const [progress, setProgress] = useState<Record<string, VideoProgress>>({});
  const [loading, setLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<VideoTutorial | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [user?.id]);

  async function loadData() {
    setLoading(true);
    try {
      const [tutorialsRes, progressRes] = await Promise.all([
        supabase.from("video_tutorials").select("*").eq("is_active", true).order("sort_order"),
        user?.id ? supabase.from("user_video_progress").select("video_id, watched_seconds, completed").eq("user_id", user.id) : Promise.resolve({ data: [] }),
      ]);

      if (tutorialsRes.data) setTutorials(tutorialsRes.data);
      if (progressRes.data) {
        const progressMap: Record<string, VideoProgress> = {};
        progressRes.data.forEach((p: any) => { progressMap[p.video_id] = p; });
        setProgress(progressMap);
      }
    } catch (e) {
      console.error("Error loading tutorials:", e);
    } finally {
      setLoading(false);
    }
  }

  async function markAsWatched(videoId: string) {
    if (!user?.id) return;
    
    try {
      await supabase.from("user_video_progress").upsert({
        user_id: user.id,
        video_id: videoId,
        completed: true,
        completed_at: new Date().toISOString(),
        last_watched_at: new Date().toISOString(),
      }, { onConflict: "user_id,video_id" });

      setProgress(prev => ({
        ...prev,
        [videoId]: { video_id: videoId, watched_seconds: 0, completed: true },
      }));
    } catch (e) {
      console.error("Error marking video as watched:", e);
    }
  }

  const categories = [...new Set(tutorials.map(t => t.category))];
  const filteredTutorials = selectedCategory
    ? tutorials.filter(t => t.category === selectedCategory)
    : tutorials;

  const completedCount = Object.values(progress).filter(p => p.completed).length;
  const totalCount = tutorials.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner size="lg" className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">Seu Progresso</h3>
              <p className="text-sm text-muted-foreground">
                {completedCount} de {totalCount} tutoriais assistidos
              </p>
            </div>
            <div className="text-2xl font-bold text-primary">{progressPercent}%</div>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={selectedCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setSelectedCategory(null)}
        >
          Todos
        </Button>
        {categories.map(cat => (
          <Button
            key={cat}
            variant={selectedCategory === cat ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Video Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTutorials.map(video => {
          const videoProgress = progress[video.id];
          const isCompleted = videoProgress?.completed;

          return (
            <Card
              key={video.id}
              className={cn(
                "cursor-pointer transition-all hover:shadow-md hover:border-primary/40 group",
                isCompleted && "bg-muted/30"
              )}
              onClick={() => setSelectedVideo(video)}
            >
              <CardContent className="p-0">
                {/* Thumbnail */}
                <div className="relative aspect-video bg-muted rounded-t-lg overflow-hidden">
                  {video.thumbnail_url ? (
                    <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-accent/20">
                      <PlayCircle className="h-12 w-12 text-primary/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="h-12 w-12 text-white" />
                  </div>
                  {isCompleted && (
                    <div className="absolute top-2 right-2">
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Assistido
                      </Badge>
                    </div>
                  )}
                  {video.duration_seconds && (
                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                      {formatDuration(video.duration_seconds)}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-4">
                  <Badge variant="secondary" className={cn("mb-2 text-xs", CATEGORY_COLORS[video.category])}>
                    {video.category}
                  </Badge>
                  <h4 className="font-medium line-clamp-1">{video.title}</h4>
                  {video.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{video.description}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTutorials.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <PlayCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum tutorial encontrado</p>
        </div>
      )}

      {/* Video Player Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-4xl p-0">
          <DialogHeader className="p-4 pb-0">
            <div className="flex items-start justify-between">
              <div>
                <Badge variant="secondary" className={cn("mb-2 text-xs", CATEGORY_COLORS[selectedVideo?.category || ""])}>
                  {selectedVideo?.category}
                </Badge>
                <DialogTitle>{selectedVideo?.title}</DialogTitle>
                {selectedVideo?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedVideo.description}</p>
                )}
              </div>
            </div>
          </DialogHeader>
          
          <div className="aspect-video bg-black">
            {selectedVideo && (
              <iframe
                src={selectedVideo.video_url}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>

          <div className="p-4 flex items-center justify-between border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDuration(selectedVideo?.duration_seconds || null)}
            </div>
            <div className="flex items-center gap-2">
              {selectedVideo && !progress[selectedVideo.id]?.completed && (
                <Button variant="outline" onClick={() => { markAsWatched(selectedVideo.id); setSelectedVideo(null); }}>
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Marcar como Assistido
                </Button>
              )}
              <Button onClick={() => setSelectedVideo(null)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Compact version for contextual help
export function VideoTutorialButton({ featureKey, className }: { featureKey: string; className?: string }) {
  const [video, setVideo] = useState<VideoTutorial | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    supabase
      .from("video_tutorials")
      .select("*")
      .eq("feature_key", featureKey)
      .eq("is_active", true)
      .single()
      .then(({ data }) => { if (data) setVideo(data); });
  }, [featureKey]);

  if (!video) return null;

  return (
    <>
      <Button variant="ghost" size="sm" className={className} onClick={() => setOpen(true)}>
        <PlayCircle className="h-4 w-4 mr-1" /> Tutorial
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>{video.title}</DialogTitle>
          </DialogHeader>
          <div className="aspect-video bg-black">
            <iframe
              src={video.video_url}
              className="w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
          <div className="p-4 flex justify-end border-t">
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
