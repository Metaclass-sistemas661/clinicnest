import { describe, it, expect } from "vitest";
import { formatInAppTz, APP_TIMEZONE } from "@/lib/date";

describe("APP_TIMEZONE", () => {
  it("deve ser America/Sao_Paulo", () => {
    expect(APP_TIMEZONE).toBe("America/Sao_Paulo");
  });
});

describe("formatInAppTz", () => {
  it("formata data ISO para dd/MM/yyyy", () => {
    // UTC midnight = São Paulo -3h → 25/02 21h
    const result = formatInAppTz("2026-02-26T03:00:00.000Z", "dd/MM/yyyy");
    expect(result).toBe("26/02/2026");
  });

  it("formata data com hora", () => {
    const result = formatInAppTz("2026-02-26T15:30:00.000Z", "HH:mm");
    expect(result).toBe("12:30");
  });

  it("formata Date object", () => {
    const date = new Date("2026-01-15T12:00:00.000Z");
    const result = formatInAppTz(date, "yyyy-MM-dd");
    expect(result).toBe("2026-01-15");
  });

  it("formata com dia da semana em pt-BR", () => {
    // 26/02/2026 = quinta-feira
    const result = formatInAppTz("2026-02-26T12:00:00.000Z", "EEEE");
    expect(result.toLowerCase()).toContain("quinta");
  });

  it("formata mês por extenso em pt-BR", () => {
    const result = formatInAppTz("2026-02-26T12:00:00.000Z", "MMMM");
    expect(result.toLowerCase()).toBe("fevereiro");
  });
});
