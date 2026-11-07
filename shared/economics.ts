export type PolicyProfile = "demo" | "production"

export type ApprovalRequirement = "guardian-auditor" | "guardian-auditor-governance"

export interface SlashDistribution {
  buyerCompensationYocto: bigint
  insurancePoolYocto: bigint
  auditorHeldYocto: bigint
  totalYocto: bigint
}

export interface SlashPolicyDecision {
  requirement: ApprovalRequirement
  largeSlash: boolean
  lowConfidence: boolean
  thresholdYocto: bigint
}

export const LARGE_SLASH_THRESHOLD_YOCTO = 10n * 10n ** 24n
export const LOW_CONFIDENCE_THRESHOLD = 80
export const MAX_SLASH_CLAIMS_PER_PAIR_24H = 3

/** Minimum provider bond ratio: 100% at reputation 0, 25% at reputation 100. */
export function minimumBondRatioPercent(reputation: number): number {
  const clamped = Math.max(0, Math.min(100, Math.trunc(reputation)))
  return Math.max(25, Math.min(100, Math.round(100 - 0.75 * clamped)))
}

export function reputationAfterProviderOutcome(
  reputation: number,
  outcome: "success" | "slash" | "sla-timeout",
  profile: PolicyProfile = "demo",
): number {
  const delta = outcome === "slash"
    ? -30
    : outcome === "sla-timeout"
      ? -10
      : profile === "demo" ? 10 : 2
  return Math.max(0, Math.min(100, Math.trunc(reputation) + delta))
}

export function auditorReputationAfterOverturnedVerdict(reputation: number): number {
  return Math.max(0, Math.min(100, Math.trunc(reputation) - 20))
}

/** Split slash proceeds using integer yoctoNEAR; remainder stays with the auditor share. */
export function distributeSlash(totalYocto: bigint): SlashDistribution {
  if (totalYocto < 0n) throw new Error("Slash amount cannot be negative.")
  const buyerCompensationYocto = totalYocto * 70n / 100n
  const insurancePoolYocto = totalYocto * 20n / 100n
  const auditorHeldYocto = totalYocto - buyerCompensationYocto - insurancePoolYocto
  return { buyerCompensationYocto, insurancePoolYocto, auditorHeldYocto, totalYocto }
}

export function approvalRequirement(
  slashAmountYocto: bigint,
  confidence: number,
): SlashPolicyDecision {
  const lowConfidence = confidence < LOW_CONFIDENCE_THRESHOLD
  const largeSlash = slashAmountYocto > LARGE_SLASH_THRESHOLD_YOCTO
  return {
    requirement: largeSlash || lowConfidence ? "guardian-auditor-governance" : "guardian-auditor",
    largeSlash,
    lowConfidence,
    thresholdYocto: LARGE_SLASH_THRESHOLD_YOCTO,
  }
}

export function canClaimSlash(claimTimestampsMs: number[], nowMs: number): boolean {
  const windowStart = nowMs - 24 * 60 * 60 * 1000
  return claimTimestampsMs.filter((timestamp) => timestamp >= windowStart && timestamp <= nowMs).length < MAX_SLASH_CLAIMS_PER_PAIR_24H
}

export function appealWindowMs(profile: PolicyProfile): number {
  return profile === "demo" ? 60_000 : 10 * 60_000
}
