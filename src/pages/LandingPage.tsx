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
} from "@/components/landing";
import { LandingLayout } from "@/components/landing/LandingLayout";

// Main Landing Page - COMPLETE STRUCTURE
export default function LandingPage() {
  return (
    <LandingLayout>
      <HeroSection />
      <StatsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <BeforeAfterSection />
      <TestimonialsSection />
      <FAQSection />
      <PricingSection />
      <GuaranteeSection />
      <DevicesSection />
      <UrgentCTASection />
    </LandingLayout>
  );
}
