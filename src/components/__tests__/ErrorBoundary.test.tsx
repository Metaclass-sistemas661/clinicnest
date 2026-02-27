import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// Mock Sentry
vi.mock("@sentry/react", () => ({
  captureException: vi.fn(),
}));

// Mock logger 
vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

function ThrowError({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>Content rendered</div>;
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error from React's error boundary
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renderiza children normalmente quando não há erro", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText("Content rendered")).toBeDefined();
  });

  it("renderiza fallback de erro quando child lança exceção", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );

    // Should show error UI
    expect(screen.getByText("Algo deu errado")).toBeDefined();
  });

  it("captura erro no Sentry", async () => {
    const Sentry = await import("@sentry/react");
    
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );

    expect(Sentry.captureException).toHaveBeenCalled();
  });
});
