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
  ProductShowcaseSection,
  SocialProofSection,
  ROICalculatorSection,
} from "@/components/landing";
import { LandingLayout } from "@/components/landing/LandingLayout";

// Main Landing Page - COMPLETE STRUCTURE
export default function LandingPage() {
  return (
    <LandingLayout>
      <HeroSection />
      <StatsSection />
      <SocialProofSection />
      <ProductShowcaseSection />
      <HowItWorksSection />
      <FeaturesSection />
      <BeforeAfterSection />
      <TestimonialsSection />
      <ROICalculatorSection />
      <FAQSection />
      <PricingSection />
      <GuaranteeSection />
      <DevicesSection />
      <UrgentCTASection />
    </LandingLayout>
  );
}
