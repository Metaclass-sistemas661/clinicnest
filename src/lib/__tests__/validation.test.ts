import { describe, it, expect } from "vitest";
import {
  financialTransactionFormSchema,
  safeNumber,
  safeArray,
  isValidPositiveNumber,
  extractNumber,
} from "@/lib/validation";

describe("financialTransactionFormSchema", () => {
  it("aceita transação de entrada válida", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "Consulta",
      amount: "150.00",
      description: "Consulta particular",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(true);
  });

  it("aceita transação de saída válida", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "expense",
      category: "Material",
      amount: "50",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(true);
  });

  it("rejeita tipo inválido", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "invalid",
      category: "Teste",
      amount: "10",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita valor zero", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "Consulta",
      amount: "0",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita valor negativo", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "Consulta",
      amount: "-50",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita categoria vazia", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "",
      amount: "100",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita data vazia", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "Consulta",
      amount: "100",
      transaction_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejeita valor não-numérico", () => {
    const result = financialTransactionFormSchema.safeParse({
      type: "income",
      category: "Consulta",
      amount: "abc",
      transaction_date: "2026-02-26",
    });
    expect(result.success).toBe(false);
  });
});

describe("safeNumber", () => {
  it("converte string numérica", () => {
    expect(safeNumber("42")).toBe(42);
  });

  it("retorna default para NaN", () => {
    expect(safeNumber("abc")).toBe(0);
  });

  it("retorna 0 para null (Number(null) === 0)", () => {
    expect(safeNumber(null, -1)).toBe(0);
  });

  it("converte float", () => {
    expect(safeNumber("3.14")).toBeCloseTo(3.14);
  });

  it("retorna 0 para undefined", () => {
    expect(safeNumber(undefined)).toBe(0);
  });
});

describe("safeArray", () => {
  it("retorna array se for array", () => {
    expect(safeArray([1, 2, 3])).toEqual([1, 2, 3]);
  });

  it("retorna default para null", () => {
    expect(safeArray(null)).toEqual([]);
  });

  it("retorna default para string", () => {
    expect(safeArray("not an array")).toEqual([]);
  });

  it("retorna default customizado", () => {
    expect(safeArray(undefined, [0])).toEqual([0]);
  });
});

describe("isValidPositiveNumber", () => {
  it("aceita zero", () => {
    expect(isValidPositiveNumber(0)).toBe(true);
  });

  it("aceita positivo", () => {
    expect(isValidPositiveNumber(100)).toBe(true);
  });

  it("rejeita negativo", () => {
    expect(isValidPositiveNumber(-1)).toBe(false);
  });

  it("rejeita NaN", () => {
    expect(isValidPositiveNumber("abc")).toBe(false);
  });

  it("aceita string numérica", () => {
    expect(isValidPositiveNumber("42")).toBe(true);
  });
});

describe("extractNumber", () => {
  it("extrai número de objeto", () => {
    expect(extractNumber({ price: 100 }, "price")).toBe(100);
  });

  it("retorna default para chave inexistente", () => {
    expect(extractNumber({ a: 1 }, "b")).toBe(0);
  });

  it("retorna default para null", () => {
    expect(extractNumber(null, "a")).toBe(0);
  });

  it("retorna default customizado", () => {
    expect(extractNumber({}, "x", 42)).toBe(42);
  });
});
