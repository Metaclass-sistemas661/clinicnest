import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LandingLayout } from "@/components/landing/LandingLayout";
import { WHATSAPP_SALES_URL } from "@/lib/whatsapp-url";
import {
  Calendar,
  Clock,
  Video,
  CheckCircle2,
  Users,
  Stethoscope,
  Smile,
  Brain,
  Activity,
  Sparkles,
  Building2,
  Phone,
  Mail,
  ArrowRight,
  Shield,
  Zap,
  HeadphonesIcon,
} from "lucide-react";
import { toast } from "sonner";

const specialties = [
  { value: "clinica-medica", label: "Clínica Médica", icon: Stethoscope },
  { value: "odontologia", label: "Odontologia", icon: Smile },
  { value: "psicologia", label: "Psicologia/Psiquiatria", icon: Brain },
  { value: "fisioterapia", label: "Fisioterapia", icon: Activity },
  { value: "estetica", label: "Estética", icon: Sparkles },
  { value: "multiprofissional", label: "Multiprofissional", icon: Users },
  { value: "outra", label: "Outra", icon: Building2 },
];

const teamSizes = [
  { value: "1", label: "Apenas eu" },
  { value: "2-5", label: "2 a 5 profissionais" },
  { value: "6-10", label: "6 a 10 profissionais" },
  { value: "11-20", label: "11 a 20 profissionais" },
  { value: "20+", label: "Mais de 20 profissionais" },
];

const benefits = [
  {
    icon: Video,
    title: "Demonstração Personalizada",
    description: "Apresentação focada nas necessidades da sua clínica",
  },
  {
    icon: Clock,
    title: "30 Minutos",
    description: "Tempo suficiente para conhecer todos os recursos",
  },
  {
    icon: HeadphonesIcon,
    title: "Especialista Dedicado",
    description: "Atendimento com consultor especializado na sua área",
  },
  {
    icon: Shield,
    title: "Sem Compromisso",
    description: "Conheça o sistema sem nenhuma obrigação",
  },
];

const features = [
  "Agenda inteligente com confirmação automática",
  "Prontuário eletrônico completo (SOAP)",
  "Módulo odontológico com odontograma",
  "Faturamento TISS integrado",
  "Portal do paciente",
  "Teleconsulta integrada",
  "Relatórios e dashboards",
  "Controle financeiro completo",
];

export default function AgendarDemonstracaoPage() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    clinicName: "",
    specialty: "",
    teamSize: "",
    currentSystem: "",
    message: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simular envio do formulário
    await new Promise((resolve) => setTimeout(resolve, 1500));

    toast.success("Solicitação enviada com sucesso!", {
      description: "Nossa equipe entrará em contato em até 24 horas úteis.",
    });

    setFormData({
      name: "",
      email: "",
      phone: "",
      clinicName: "",
      specialty: "",
      teamSize: "",
      currentSystem: "",
      message: "",
    });
    setIsSubmitting(false);
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950 py-16 sm:py-20">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-400/30">
              <Calendar className="h-3 w-3 mr-1" />
              Demonstração Gratuita
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Agende uma demonstração{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">
                personalizada
              </span>
            </h1>
            <p className="mt-4 text-lg text-white/70">
              Conheça o ClinicNest em uma apresentação exclusiva, focada nas 
              necessidades específicas da sua clínica.
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-16 sm:py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
            {/* Form */}
            <div>
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">Solicitar Demonstração</CardTitle>
                  <CardDescription>
                    Preencha o formulário e nossa equipe entrará em contato para agendar 
                    o melhor horário para você.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome completo *</Label>
                        <Input
                          id="name"
                          placeholder="Seu nome"
                          value={formData.name}
                          onChange={(e) => handleChange("name", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail *</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="seu@email.com"
                          value={formData.email}
                          onChange={(e) => handleChange("email", e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone/WhatsApp *</Label>
                        <Input
                          id="phone"
                          placeholder="(11) 99999-9999"
                          value={formData.phone}
                          onChange={(e) => handleChange("phone", e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="clinicName">Nome da clínica</Label>
                        <Input
                          id="clinicName"
                          placeholder="Nome da sua clínica"
                          value={formData.clinicName}
                          onChange={(e) => handleChange("clinicName", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="specialty">Especialidade *</Label>
                        <Select
                          value={formData.specialty}
                          onValueChange={(value) => handleChange("specialty", value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {specialties.map((spec) => (
                              <SelectItem key={spec.value} value={spec.value}>
                                <div className="flex items-center gap-2">
                                  <spec.icon className="h-4 w-4" />
                                  {spec.label}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="teamSize">Tamanho da equipe *</Label>
                        <Select
                          value={formData.teamSize}
                          onValueChange={(value) => handleChange("teamSize", value)}
                          required
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {teamSizes.map((size) => (
                              <SelectItem key={size.value} value={size.value}>
                                {size.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="currentSystem">Sistema atual (opcional)</Label>
                      <Input
                        id="currentSystem"
                        placeholder="Ex: Planilhas, outro software, nenhum..."
                        value={formData.currentSystem}
                        onChange={(e) => handleChange("currentSystem", e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">Mensagem (opcional)</Label>
                      <Textarea
                        id="message"
                        placeholder="Conte-nos mais sobre suas necessidades ou dúvidas..."
                        value={formData.message}
                        onChange={(e) => handleChange("message", e.target.value)}
                        rows={4}
                      />
                    </div>

                    <Button
                      type="submit"
                      size="lg"
                      className="w-full bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-600 hover:to-cyan-500 text-white font-semibold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        "Enviando..."
                      ) : (
                        <>
                          Solicitar Demonstração
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>

                    <p className="text-xs text-center text-muted-foreground">
                      Ao enviar, você concorda com nossa{" "}
                      <Link to="/politica-de-privacidade" className="underline hover:text-foreground">
                        Política de Privacidade
                      </Link>
                      .
                    </p>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Benefits & Info */}
            <div className="space-y-8">
              {/* Benefits */}
              <div>
                <h2 className="text-2xl font-bold mb-6">O que você vai ver na demonstração</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  {benefits.map((benefit, idx) => {
                    const Icon = benefit.icon;
                    return (
                      <Card key={idx} className="border hover:border-teal-200 transition-colors">
                        <CardContent className="pt-6">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                            <Icon className="h-5 w-5 text-teal-600" />
                          </div>
                          <h3 className="mt-3 font-semibold">{benefit.title}</h3>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {benefit.description}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>

              {/* Features Preview */}
              <Card className="bg-muted/30 border-2 border-dashed">
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-teal-600" />
                    Recursos que você vai conhecer
                  </h3>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-teal-600 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Contact Info */}
              <Card>
                <CardContent className="pt-6">
                  <h3 className="font-semibold mb-4">Prefere falar diretamente?</h3>
                  <div className="space-y-3">
                    <a
                      href={WHATSAPP_SALES_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                        <Phone className="h-4 w-4 text-green-600" />
                      </div>
                      <span>Fale conosco no WhatsApp</span>
                    </a>
                    <a
                      href="mailto:comercial@clinicnest.com.br"
                      className="flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                        <Mail className="h-4 w-4 text-blue-600" />
                      </div>
                      <span>comercial@clinicnest.com.br</span>
                    </a>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Atendimento: Segunda a Sexta, 8h às 18h
                  </p>
                </CardContent>
              </Card>

              {/* Trust Badge */}
              <div className="flex items-center justify-center gap-4 p-4 bg-teal-50 rounded-lg border border-teal-100">
                <Shield className="h-8 w-8 text-teal-600" />
                <div>
                  <p className="font-semibold text-teal-900">Seus dados estão seguros</p>
                  <p className="text-sm text-teal-700">
                    Não compartilhamos suas informações com terceiros.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Alternative CTA */}
      <section className="py-16 bg-muted/30 border-t">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold">Prefere testar por conta própria?</h2>
            <p className="mt-2 text-muted-foreground">
              Crie sua conta gratuita e explore o sistema por 14 dias, sem compromisso.
            </p>
            <div className="mt-6">
              <Link to="/cadastro">
                <Button size="lg" variant="outline" className="border-teal-200 hover:bg-teal-50">
                  Começar Teste Grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
