import { describe, it, expect } from "vitest";
import { formatCurrency } from "@/lib/formatCurrency";

describe("formatCurrency", () => {
  it("formata valor positivo em BRL", () => {
    const result = formatCurrency(1500.5);
    expect(result).toContain("1.500,50");
    expect(result).toContain("R$");
  });

  it("formata zero", () => {
    const result = formatCurrency(0);
    expect(result).toContain("0,00");
  });

  it("formata valor negativo", () => {
    const result = formatCurrency(-250.99);
    expect(result).toContain("250,99");
  });

  it("formata centavos corretamente", () => {
    const result = formatCurrency(0.01);
    expect(result).toContain("0,01");
  });

  it("formata valores grandes (milhões)", () => {
    const result = formatCurrency(1234567.89);
    expect(result).toContain("1.234.567,89");
  });
});
