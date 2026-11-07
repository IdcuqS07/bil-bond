import { describe, expect, it } from "vitest"
import { applyOrderTransition, type OrderTransitionState } from "../shared/order-transition.js"

const yocto = 10n ** 24n

function failedOrder(): OrderTransitionState {
  return {
    status: "verdict_recorded",
    passed: false,
    confidence: 92,
    profile: "demo",
    appealUntilMs: null,
    slashAmountYocto: 0n,
    reservedBondYocto: 5n * yocto,
    providerBondYocto: 5n * yocto,
    providerReputation: 60,
    auditorApproved: true,
    guardianApproved: false,
    governanceApproved: false,
    insurancePoolYocto: 0n,
    auditorHeldYocto: 0n,
  }
}

describe("order transition integration", () => {
  it("runs guardian approval, appeal expiry, and slash distribution", () => {
    const reviewed = applyOrderTransition(failedOrder(), "guardian_approve", { nowMs: 1_000 })
    expect(reviewed.status).toBe("appeal_window")
    expect(reviewed.slashAmountYocto).toBe(5n * yocto)
    expect(reviewed.appealUntilMs).toBe(61_000)

    const settled = applyOrderTransition(reviewed, "finalize_slash", { nowMs: 61_000 })
    expect(settled.status).toBe("slashed")
    expect(settled.providerBondYocto).toBe(0n)
    expect(settled.insurancePoolYocto).toBe(yocto)
    expect(settled.auditorHeldYocto).toBe(yocto / 2n)
    expect(settled.providerReputation).toBe(30)
  })

  it("allows a provider appeal before the deadline and refunds on overturn", () => {
    const reviewed = applyOrderTransition(failedOrder(), "guardian_approve", { nowMs: 1_000 })
    const appealed = applyOrderTransition(reviewed, "provider_appeal", { nowMs: 30_000 })
    expect(appealed.status).toBe("appealed")

    const overturned = applyOrderTransition(appealed, "governance_resolve_appeal", {
      nowMs: 40_000,
      upholdSlash: false,
    })
    expect(overturned.status).toBe("refunded")
    expect(overturned.reservedBondYocto).toBe(0n)
    expect(overturned.insurancePoolYocto).toBe(yocto / 2n)
    expect(overturned.providerBondYocto).toBe(5n * yocto)
  })

  it("rejects finalization while the appeal window remains open", () => {
    const reviewed = applyOrderTransition(failedOrder(), "guardian_approve", { nowMs: 1_000 })
    expect(() => applyOrderTransition(reviewed, "finalize_slash", { nowMs: 60_999 })).toThrow("still open")
  })
})
