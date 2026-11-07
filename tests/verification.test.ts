import { describe, expect, it } from "vitest";
import {
  approvalRequirement,
  appealWindowMs,
  auditorReputationAfterOverturnedVerdict,
  canClaimSlash,
  distributeSlash,
  minimumBondRatioPercent,
  reputationAfterProviderOutcome,
} from "../shared/economics.js";
import { evaluateSubmission } from "../shared/verification.js";

describe("evaluateSubmission", () => {
  it("passes a complete, verifiable research submission deterministically", () => {
    const submission = {
      summary: "A sourced market brief with enough detail to audit every quantified statement and compare claims against the listed source material.",
      sources: [
        "https://example.com/market-report",
        "https://example.org/company-data",
        "https://example.net/filing",
      ],
      claims: ["Market size", "Company revenue", "Growth rate"],
    };

    expect(evaluateSubmission(submission)).toEqual(evaluateSubmission(submission));
    expect(evaluateSubmission(submission).passed).toBe(true);
  });

  it("flags a fabricated result with high confidence and clear evidence", () => {
    const result = evaluateSubmission({
      summary: "This fabricated brief relies on invented source data and cannot be validated against the requested criteria.",
      sources: ["not-a-url"],
      claims: ["Unsupported market claim"],
      fabricated: true,
    });

    expect(result.passed).toBe(false);
    expect(result.confidence).toBe(96);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.evidence.some((entry) => entry.includes("fabrication marker"))).toBe(true);
  });
});

describe("economic policy", () => {
  it("clamps reputation and calculates the approved bond ratio", () => {
    expect(minimumBondRatioPercent(0)).toBe(100);
    expect(minimumBondRatioPercent(100)).toBe(25);
    expect(minimumBondRatioPercent(140)).toBe(25);
    expect(reputationAfterProviderOutcome(95, "success", "demo")).toBe(100);
    expect(reputationAfterProviderOutcome(10, "slash")).toBe(0);
  });

  it("splits slash proceeds 70/20/10 and retains the auditor share", () => {
    expect(distributeSlash(10n * 10n ** 24n)).toEqual({
      buyerCompensationYocto: 7n * 10n ** 24n,
      insurancePoolYocto: 2n * 10n ** 24n,
      auditorHeldYocto: 1n * 10n ** 24n,
      totalYocto: 10n * 10n ** 24n,
    });
    expect(auditorReputationAfterOverturnedVerdict(15)).toBe(0);
  });

  it("escalates only large or low-confidence slash cases", () => {
    expect(approvalRequirement(10n * 10n ** 24n, 80).requirement).toBe("guardian-auditor");
    expect(approvalRequirement(10n * 10n ** 24n + 1n, 90).requirement).toBe("guardian-auditor-governance");
    expect(approvalRequirement(1n, 79).requirement).toBe("guardian-auditor-governance");
  });

  it("enforces the three-claims-per-pair rolling 24-hour cap", () => {
    const now = Date.UTC(2026, 9, 22, 12);
    expect(canClaimSlash([now - 1_000, now - 2_000], now)).toBe(true);
    expect(canClaimSlash([now - 1_000, now - 2_000, now - 3_000], now)).toBe(false);
    expect(canClaimSlash([now - 25 * 60 * 60 * 1000, now - 26 * 60 * 60 * 1000, now - 27 * 60 * 60 * 1000], now)).toBe(true);
  });

  it("keeps demo and production appeal windows separate", () => {
    expect(appealWindowMs("demo")).toBe(60_000);
    expect(appealWindowMs("production")).toBe(600_000);
  });
});
