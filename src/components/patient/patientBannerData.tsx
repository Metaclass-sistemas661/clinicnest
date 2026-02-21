import { Video, Calendar, FileText, Pill, ClipboardList, Heart, Shield, Smartphone, Clock, Stethoscope } from "lucide-react";
import type { BannerSlide } from "./PatientBannerCarousel";
import { createElement } from "react";

const icon = (Icon: React.ElementType) =>
  createElement(Icon, { className: "h-4.5 w-4.5 text-white" });

export const dashboardBanners: BannerSlide[] = [
  {
    title: "Bem-vindo ao seu Portal de Saúde",
    description:
      "Acesse consultas, exames, receitas e muito mais — tudo em um só lugar, com segurança e praticidade.",
    imageUrl:
      "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-teal-600 to-teal-500",
    icon: icon(Heart),
  },
  {
    title: "Teleconsulta: atendimento de onde você estiver",
    description:
      "Consulte-se por vídeo com seu profissional de saúde sem sair de casa. Rápido, seguro e confortável.",
    imageUrl:
      "https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-blue-600 to-cyan-500",
    icon: icon(Video),
  },
  {
    title: "Seus dados protegidos",
    description:
      "Todas as suas informações de saúde são armazenadas com criptografia e acessíveis somente por você e seus médicos.",
    imageUrl:
      "https://images.unsplash.com/photo-1563986768609-322da13575f2?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-indigo-600 to-purple-500",
    icon: icon(Shield),
  },
];

export const teleconsultaBanners: BannerSlide[] = [
  {
    title: "Consulta por vídeo ficou mais fácil!",
    description:
      "Agora é mais simples do que nunca. Basta clicar em "Entrar na Teleconsulta" quando chegar a hora e falar com seu médico em tempo real.",
    imageUrl:
      "https://images.unsplash.com/photo-1609220136736-443140cffec6?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-teal-600 to-emerald-500",
    icon: icon(Video),
  },
  {
    title: "Sem deslocamento, sem espera",
    description:
      "Evite filas e trânsito. Com a teleconsulta, você recebe atendimento médico de qualidade no conforto da sua casa.",
    imageUrl:
      "https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-blue-600 to-blue-500",
    icon: icon(Smartphone),
  },
  {
    title: "Atendimento humanizado por vídeo",
    description:
      "A tecnologia aproxima você do seu profissional de saúde. A teleconsulta mantém a mesma qualidade de um atendimento presencial.",
    imageUrl:
      "https://images.unsplash.com/photo-1666214280557-f1b5022eb634?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-cyan-600 to-teal-500",
    icon: icon(Stethoscope),
  },
];

export const consultasBanners: BannerSlide[] = [
  {
    title: "Suas consultas organizadas",
    description:
      "Acompanhe seus agendamentos futuros e histórico de consultas em um só lugar. Nunca mais perca uma consulta!",
    imageUrl:
      "https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-blue-600 to-indigo-500",
    icon: icon(Calendar),
  },
  {
    title: "Fique por dentro dos seus horários",
    description:
      "Veja data, horário, profissional e local de cada agendamento. Tudo claro e acessível para você.",
    imageUrl:
      "https://images.unsplash.com/photo-1504439468489-c8920d796a29?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-violet-600 to-blue-500",
    icon: icon(Clock),
  },
];

export const examesBanners: BannerSlide[] = [
  {
    title: "Resultados de exames na palma da mão",
    description:
      "Acesse seus laudos e resultados de exames de forma rápida e segura. Sem precisar ir ao laboratório buscar papel.",
    imageUrl:
      "https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-emerald-600 to-teal-500",
    icon: icon(FileText),
  },
  {
    title: "Histórico completo dos seus exames",
    description:
      "Todos os seus exames organizados por data. Compare resultados e acompanhe a evolução da sua saúde.",
    imageUrl:
      "https://images.unsplash.com/photo-1530497610245-94d3c16cda28?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-teal-600 to-cyan-500",
    icon: icon(FileText),
  },
];

export const receitasBanners: BannerSlide[] = [
  {
    title: "Receitas digitais sempre à mão",
    description:
      "Suas prescrições médicas ficam salvas aqui. Apresente na farmácia direto do celular, sem risco de perder o papel.",
    imageUrl:
      "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-orange-500 to-amber-500",
    icon: icon(Pill),
  },
  {
    title: "Controle suas medicações",
    description:
      "Veja o que foi prescrito, as instruções de uso e a validade de cada receita. Tudo organizado para seu bem-estar.",
    imageUrl:
      "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-rose-500 to-orange-500",
    icon: icon(Pill),
  },
];

export const atestadosBanners: BannerSlide[] = [
  {
    title: "Atestados e declarações digitais",
    description:
      "Todos os seus atestados médicos em um só lugar. Acesse quando precisar, sem risco de perder o documento.",
    imageUrl:
      "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-slate-600 to-slate-500",
    icon: icon(ClipboardList),
  },
  {
    title: "Documentos médicos seguros",
    description:
      "Declarações de comparecimento, laudos e relatórios ficam salvos com segurança para quando você precisar.",
    imageUrl:
      "https://images.unsplash.com/photo-1554734867-bf3c00a49371?auto=format&fit=crop&w=600&q=80",
    gradient: "bg-gradient-to-r from-gray-700 to-slate-600",
    icon: icon(Shield),
  },
];
