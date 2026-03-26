import { describe, it, expect } from "vitest";
import { normalizeError, toastError } from "@/utils/errorMessages";

describe("normalizeError", () => {
  it("normalizes network errors", () => {
    expect(normalizeError("Failed to fetch")).toContain("conexão");
    expect(normalizeError(new Error("NetworkError"))).toContain("conexão");
  });

  it("normalizes timeout errors", () => {
    expect(normalizeError("Request timed out")).toContain("demorou");
    expect(normalizeError("statement timeout")).toContain("demorou");
  });

  it("normalizes auth errors", () => {
    expect(normalizeError("JWT expired")).toContain("sessão expirou");
    expect(normalizeError("token invalid")).toContain("sessão expirou");
  });

  it("normalizes permission errors", () => {
    expect(normalizeError("permission denied")).toContain("permissão");
    expect(normalizeError("row-level security")).toContain("negado");
  });

  it("normalizes duplicate key errors", () => {
    expect(normalizeError("duplicate key value violates unique constraint")).toContain("já existe");
    expect(normalizeError("23505")).toContain("já existe");
  });

  it("normalizes file upload errors", () => {
    expect(normalizeError("file too large")).toContain("grande");
    expect(normalizeError("413")).toContain("grande");
  });

  it("normalizes rate limit errors", () => {
    expect(normalizeError("rate limit exceeded")).toContain("tentativas");
    expect(normalizeError("429")).toContain("tentativas");
  });

  it("returns Portuguese text as-is", () => {
    const ptMsg = "Paciente não encontrado";
    expect(normalizeError(ptMsg)).toBe(ptMsg);
  });

  it("returns fallback for unmapped English errors", () => {
    expect(normalizeError("something weird", "Fallback")).toBe("Fallback");
  });

  it("returns default fallback for empty/null", () => {
    expect(normalizeError(null)).toContain("inesperado");
    expect(normalizeError("")).toContain("inesperado");
  });

  it("extracts message from Error objects", () => {
    expect(normalizeError(new Error("permission denied"))).toContain("permissão");
  });

  it("extracts message from plain objects", () => {
    expect(normalizeError({ message: "timeout" })).toContain("demorou");
    expect(normalizeError({ error: "JWT expired" })).toContain("sessão");
  });
});

describe("toastError", () => {
  it("returns title and normalized description", () => {
    const result = toastError("Erro", new Error("Failed to fetch"));
    expect(result.title).toBe("Erro");
    expect(result.description).toContain("conexão");
  });

  it("includes fallback description for unknown errors", () => {
    const result = toastError("Falha", "unknown_error_xyz");
    expect(result.description).toContain("suporte");
  });
});
