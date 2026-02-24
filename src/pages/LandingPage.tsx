import {
  StatsSection,
  HowItWorksSection,
  BeforeAfterSection,
  FAQSection,
  GuaranteeSection,
  DevicesSection,
  UrgentCTASection,
  HeroSection,
  FeaturesSection,
  TestimonialsSection,
  PricingSection,
  SocialProofSection,
  ROICalculatorSection,
  DifferentialsSection,
  IntegrationsSection,
} from "@/components/landing";
import { LandingLayout } from "@/components/landing/LandingLayout";

export default function LandingPage() {
  return (
    <LandingLayout>
      <HeroSection />
      <StatsSection />
      <SocialProofSection />
      <DifferentialsSection />
      <FeaturesSection />
      <IntegrationsSection />
      <HowItWorksSection />
      <BeforeAfterSection />
      <TestimonialsSection />
      <ROICalculatorSection />
      <PricingSection />
      <FAQSection />
      <GuaranteeSection />
      <DevicesSection />
      <UrgentCTASection />
    </LandingLayout>
  );
}
