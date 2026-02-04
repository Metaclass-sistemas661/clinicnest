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
  ScreenshotsSection,
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
      <ScreenshotsSection />
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
