import { appealWindowMs, approvalRequirement, distributeSlash, reputationAfterProviderOutcome } from "./economics.js"

export type TransitionAction =
  | "guardian_approve"
  | "governance_approve"
  | "provider_appeal"
  | "governance_resolve_appeal"
  | "finalize_slash"

export type TransitionStatus =
  | "verdict_recorded"
  | "appeal_window"
  | "appealed"
  | "refunded"
  | "slashed"

export interface OrderTransitionState {
  status: TransitionStatus
  passed: boolean
  confidence: number
  profile: "demo" | "production"
  appealUntilMs: number | null
  slashAmountYocto: bigint
  reservedBondYocto: bigint
  providerBondYocto: bigint
  providerReputation: number
  auditorApproved: boolean
  guardianApproved: boolean
  governanceApproved: boolean
  insurancePoolYocto: bigint
  auditorHeldYocto: bigint
}

export interface TransitionContext {
  nowMs: number
  upholdSlash?: boolean
}

export function applyOrderTransition(
  input: OrderTransitionState,
  action: TransitionAction,
  context: TransitionContext,
): OrderTransitionState {
  const state = { ...input }
  const now = context.nowMs

  if (action === "guardian_approve") {
    assertState(state, "verdict_recorded")
    state.guardianApproved = true
    state.status = "appeal_window"
    if (!state.passed) state.slashAmountYocto = state.reservedBondYocto
    state.appealUntilMs = now + appealWindowMs(state.profile)
    return state
  }

  if (action === "governance_approve") {
    assertState(state, "verdict_recorded", "appeal_window")
    const requirement = approvalRequirement(state.slashAmountYocto || state.reservedBondYocto, state.confidence)
    if (requirement.requirement !== "guardian-auditor-governance") {
      throw new Error("This order does not require governance escalation.")
    }
    state.governanceApproved = true
    if (state.status === "verdict_recorded") {
      state.status = "appeal_window"
      if (!state.passed) state.slashAmountYocto = state.reservedBondYocto
      state.appealUntilMs = now + appealWindowMs(state.profile)
    }
    return state
  }

  if (action === "provider_appeal") {
    assertState(state, "appeal_window")
    if (state.passed) throw new Error("A successful verdict cannot be appealed.")
    if (state.appealUntilMs === null || now >= state.appealUntilMs) throw new Error("The appeal window has closed.")
    state.status = "appealed"
    return state
  }

  if (action === "governance_resolve_appeal") {
    assertState(state, "appealed")
    if (context.upholdSlash) {
      state.status = "appeal_window"
      state.appealUntilMs = now
      return state
    }
    const pendingAuditorShare = distributeSlash(state.slashAmountYocto).auditorHeldYocto
    state.insurancePoolYocto += pendingAuditorShare
    state.reservedBondYocto = 0n
    state.status = "refunded"
    return state
  }

  assertState(state, "appeal_window")
  if (state.passed) throw new Error("A passing verdict cannot be slashed.")
  if (state.appealUntilMs === null || now < state.appealUntilMs) throw new Error("The appeal window is still open.")
  const requirement = approvalRequirement(state.slashAmountYocto, state.confidence)
  const hasRequiredApprovals = requirement.requirement === "guardian-auditor"
    ? state.auditorApproved && state.guardianApproved
    : state.governanceApproved && (state.auditorApproved || state.guardianApproved)
  if (!hasRequiredApprovals) throw new Error("Required slash approvals are missing.")
  if (state.providerBondYocto < state.slashAmountYocto) throw new Error("Provider bond is insufficient for the slash.")

  const distribution = distributeSlash(state.slashAmountYocto)
  state.providerBondYocto -= state.slashAmountYocto
  state.reservedBondYocto = 0n
  state.insurancePoolYocto += distribution.insurancePoolYocto
  state.auditorHeldYocto += distribution.auditorHeldYocto
  state.providerReputation = reputationAfterProviderOutcome(state.providerReputation, "slash", state.profile)
  state.status = "slashed"
  return state
}

function assertState(state: OrderTransitionState, ...allowed: TransitionStatus[]): void {
  if (!allowed.includes(state.status)) {
    throw new Error(`Transition is not valid from ${state.status}.`)
  }
}
