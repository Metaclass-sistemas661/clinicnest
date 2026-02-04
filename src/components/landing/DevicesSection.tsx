import { Monitor, Tablet, Smartphone, Globe, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

const devices = [
  {
    icon: Monitor,
    name: "Desktop",
    description: "Gestão completa no computador"
  },
  {
    icon: Tablet,
    name: "Tablet",
    description: "Perfeito para o balcão do salão"
  },
  {
    icon: Smartphone,
    name: "Celular",
    description: "Controle na palma da mão"
  },
];

export function DevicesSection() {
  return (
    <section className="py-20 sm:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-violet-50/30 to-transparent" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <Globe className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-600">Compatibilidade</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Funciona em{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              qualquer dispositivo
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Acesse seu salão de qualquer lugar, em qualquer dispositivo. 100% online, sem instalação.
          </p>
        </div>

        {/* Devices Display */}
        <div className="relative max-w-4xl mx-auto">
          {/* Connection lines - Desktop only */}
          <div className="hidden md:block absolute top-1/2 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-violet-200 via-fuchsia-300 to-violet-200 -translate-y-1/2" />
          
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {devices.map((device, index) => {
              const Icon = device.icon;
              return (
                <div 
                  key={device.name}
                  className="relative group"
                >
                  <div className="flex flex-col items-center p-8 rounded-3xl bg-white border-2 border-violet-100 shadow-lg hover:shadow-2xl hover:border-violet-300 transition-all duration-300 hover:-translate-y-2 h-full">
                    {/* Device Frame */}
                    <div className="relative mb-6 flex-shrink-0">
                      {/* Outer glow */}
                      <div className="absolute inset-0 bg-gradient-to-br from-violet-400 to-fuchsia-400 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity" />
                      
                      {/* Device icon container */}
                      <div className="relative h-32 w-32 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center">
                        <Icon className="h-16 w-16 text-violet-600 group-hover:scale-110 transition-transform duration-300" aria-hidden="true" />
                        
                        {/* Online indicator */}
                        <div className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-green-500 flex items-center justify-center border-2 border-white" aria-label="Online">
                          <Wifi className="h-3 w-3 text-white" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center text-center">
                      <h3 className="font-display text-xl font-semibold mb-2">
                        {device.name}
                      </h3>
                      <p className="text-muted-foreground">
                        {device.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Browser compatibility note */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-white border shadow-sm">
            <Globe className="h-5 w-5 text-violet-600" />
            <span className="text-sm text-muted-foreground">
              Funciona em Chrome, Safari, Firefox, Edge e todos os navegadores modernos
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
