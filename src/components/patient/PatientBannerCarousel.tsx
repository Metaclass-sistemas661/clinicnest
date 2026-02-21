import { useCallback, useEffect, useState } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

export interface BannerSlide {
  title: string;
  description: string;
  imageUrl: string;
  gradient: string;
  icon?: React.ReactNode;
  accent?: string;
}

interface PatientBannerCarouselProps {
  slides: BannerSlide[];
  className?: string;
  autoPlayMs?: number;
}

export function PatientBannerCarousel({
  slides,
  className,
  autoPlayMs = 5000,
}: PatientBannerCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    onSelect();
    api.on("select", onSelect);
    return () => { api.off("select", onSelect); };
  }, [api, onSelect]);

  useEffect(() => {
    if (!api || slides.length <= 1) return;
    const interval = setInterval(() => api.scrollNext(), autoPlayMs);
    return () => clearInterval(interval);
  }, [api, autoPlayMs, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div className={cn("mb-6", className)}>
      <Carousel
        setApi={setApi}
        opts={{ loop: true, align: "start" }}
        className="w-full"
      >
        <CarouselContent>
          {slides.map((slide, idx) => (
            <CarouselItem key={idx}>
              <div
                className={cn(
                  "relative overflow-hidden rounded-2xl",
                  slide.gradient
                )}
              >
                <div className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                  }}
                />

                <div className="relative flex flex-col sm:flex-row items-center gap-4 sm:gap-6 p-5 sm:p-6 lg:p-8">
                  <div className="flex-1 text-white space-y-2 text-center sm:text-left">
                    <div className="flex items-center gap-2 justify-center sm:justify-start">
                      {slide.icon && (
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm flex-shrink-0">
                          {slide.icon}
                        </span>
                      )}
                      <h3 className="text-lg sm:text-xl font-bold leading-tight">
                        {slide.title}
                      </h3>
                    </div>
                    <p className="text-sm sm:text-base text-white/90 leading-relaxed max-w-lg">
                      {slide.description}
                    </p>
                  </div>

                  <div className="flex-shrink-0 w-full sm:w-auto">
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      className="w-full sm:w-44 lg:w-52 h-32 sm:h-28 lg:h-32 object-cover rounded-xl shadow-lg border-2 border-white/20"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {slides.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => api?.scrollTo(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                current === idx
                  ? "w-6 bg-teal-600 dark:bg-teal-400"
                  : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/40"
              )}
              aria-label={`Ir para slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
