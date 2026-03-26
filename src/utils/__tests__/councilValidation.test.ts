import { describe, it, expect } from "vitest";
import {
  requiresCouncil,
  getCouncilType,
  validateCouncilFormat,
  validateCouncilState,
} from "@/utils/councilValidation";

describe("requiresCouncil", () => {
  it("returns true for medical professionals", () => {
    expect(requiresCouncil("medico")).toBe(true);
    expect(requiresCouncil("dentista")).toBe(true);
    expect(requiresCouncil("enfermeiro")).toBe(true);
  });

  it("returns false for non-clinical types", () => {
    expect(requiresCouncil("secretaria" as any)).toBe(false);
    expect(requiresCouncil("recepcionista" as any)).toBe(false);
  });
});

describe("getCouncilType", () => {
  it("returns correct council for each type", () => {
    expect(getCouncilType("medico")).toBe("CRM");
    expect(getCouncilType("dentista")).toBe("CRO");
    expect(getCouncilType("enfermeiro")).toBe("COREN");
    expect(getCouncilType("psicologo")).toBe("CRP");
  });

  it("returns null for unknown types", () => {
    expect(getCouncilType("secretaria" as any)).toBeNull();
  });
});

describe("validateCouncilFormat", () => {
  it("accepts valid CRM numbers", () => {
    const r = validateCouncilFormat("CRM", "123456");
    expect(r.valid).toBe(true);
    expect(r.message).toBe("");
  });

  it("rejects too-short CRM", () => {
    const r = validateCouncilFormat("CRM", "12");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("inválido");
  });

  it("rejects empty number", () => {
    const r = validateCouncilFormat("CRM", "");
    expect(r.valid).toBe(false);
    expect(r.message).toContain("obrigatório");
  });

  it("accepts valid CRP format (XX/XXXXX)", () => {
    const r = validateCouncilFormat("CRP", "06/12345");
    expect(r.valid).toBe(true);
  });

  it("rejects invalid CRP format", () => {
    const r = validateCouncilFormat("CRP", "12345");
    expect(r.valid).toBe(false);
  });

  it("accepts unknown council type with any value", () => {
    const r = validateCouncilFormat("UNKNOWN", "anything");
    expect(r.valid).toBe(true);
  });
});

describe("validateCouncilState", () => {
  it("accepts valid Brazilian states", () => {
    expect(validateCouncilState("SP")).toBe(true);
    expect(validateCouncilState("RJ")).toBe(true);
    expect(validateCouncilState("DF")).toBe(true);
  });

  it("accepts lowercase states", () => {
    expect(validateCouncilState("sp")).toBe(true);
  });

  it("rejects invalid states", () => {
    expect(validateCouncilState("XX")).toBe(false);
    expect(validateCouncilState("")).toBe(false);
  });
});
