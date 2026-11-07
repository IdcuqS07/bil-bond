import type { AuditEvent, DashboardData, GuardianCase, Provider, Transaction } from "./api";
import { readTestnetView } from "./nearWallet";

const YOCTO_PER_NEAR = 10n ** 24n;
const PAGE_SIZE = 50;

interface OnChainProvider {
  account_id: string;
  bond: string;
  reputation: number;
  registered_at: string;
  successful_orders: string;
  slashed_orders: string;
}

interface OnChainOffer {
  id: number;
  provider_id: string;
  service_type: string;
  price: string;
  sla: string;
  verification_criteria: string;
  max_contract_amount: string;
  active: boolean;
}

interface OnChainVerdict {
  auditor_id: string;
  passed: boolean;
  confidence: number;
  evidence: string;
  reasons: string;
  recorded_at: string;
}

interface OnChainOrder {
  id: number;
  offer_id: number;
  provider_id: string;
  buyer_id: string;
  auditor_id: string;
  amount: string;
  specification: string;
  verification_criteria: string;
  created_at: string;
  status: string;
  work_reference: string | null;
  verdict: OnChainVerdict | null;
  guardian_id: string | null;
  guardian_approved: boolean;
  appeal_deadline: string | null;
  appeal_reason: string | null;
  approvals: { guardian: boolean; auditor: boolean; governance: boolean };
  slash_amount: string;
  appeal_status: "none" | "pending" | "upheld" | "overturned";
}

interface OnChainAuditEvent {
  sequence: string;
  kind: string;
  actor: string;
  order_id: number | null;
  timestamp: string;
  details: string;
}

export type AppealStatus = "none" | "pending" | "upheld" | "overturned";

export function deriveAppealStatuses(events: OnChainAuditEvent[]): Map<number, AppealStatus> {
  const statuses = new Map<number, AppealStatus>();
  for (const event of [...events].sort((a, b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1)) {
    if (event.order_id === null) continue;
    if (event.kind === "appeal_submitted") statuses.set(event.order_id, "pending");
    if (event.kind === "appeal_upheld") statuses.set(event.order_id, "upheld");
    if (event.kind === "appeal_overturned") statuses.set(event.order_id, "overturned");
  }
  return statuses;
}

export interface OnChainRoles {
  owner_id: string;
  auditor_id: string | null;
  guardian_id: string | null;
  governance_signer: string | null;
  governance_signers: string[];
  low_confidence_threshold: number;
  large_slash_threshold: string;
  appeal_window_ns: string;
}

interface OnChainPolicy {
  low_confidence_threshold: number;
  large_slash_threshold: string;
  demo_appeal_window_ns: string;
  production_appeal_window_ns: string;
  reputation_profile: "demo" | "production";
}

export interface TestnetContractSnapshot {
  contractId: string;
  providers: OnChainProvider[];
  offers: OnChainOffer[];
  orders: OnChainOrder[];
  auditEvents: OnChainAuditEvent[];
  roles: OnChainRoles;
  insurancePool: string;
}

export function formatYoctoNear(input: string | bigint): string {
  const value = BigInt(input);
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / YOCTO_PER_NEAR;
  const fractional = (absolute % YOCTO_PER_NEAR).toString().padStart(24, "0").slice(0, 2);
  return `${negative ? "−" : ""}${whole.toLocaleString("en-US")}.${fractional} NEAR`;
}

export function parseNearToYocto(input: string): string {
  const value = input.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,24})?$/.test(value)) {
    throw new Error("Enter a positive NEAR amount with up to 24 decimal places.");
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * YOCTO_PER_NEAR + BigInt((fraction + "0".repeat(24)).slice(0, 24));
  if (amount <= 0n) throw new Error("The amount must be greater than zero.");
  return amount.toString();
}

function parseCriteria(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    if (Array.isArray(parsed) && parsed.every((item) => typeof item === "string")) return parsed;
  } catch {
    // Older offers may store one plain-text criterion rather than a JSON array.
  }
  return value.split(/\n|;(?=\s*\S)/).map((item) => item.trim()).filter(Boolean);
}

function formatTimestampNs(value: string): string {
  try {
    const milliseconds = Number(BigInt(value) / 1_000_000n);
    if (!Number.isFinite(milliseconds)) return "Timestamp unavailable";
    return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(milliseconds));
  } catch {
    return "Timestamp unavailable";
  }
}

function statusLabel(status: string): Transaction["status"] {
  switch (status.toLowerCase()) {
    case "escrowlocked": return "Escrow locked";
    case "worksubmitted": return "Work submitted";
    case "verdictrecorded": return "Under review";
    case "appealwindow": return "Appeal window";
    case "appealed": return "Appealed";
    case "released": return "Released";
    case "slashed": return "Slashed";
    case "refunded": return "Refunded";
    case "guardianrejected": return "Refunded";
    default: return "Escrow locked";
  }
}

function isOpenOrder(status: string): boolean {
  return ["escrowlocked", "worksubmitted", "verdictrecorded", "appealwindow", "appealed"].includes(status.toLowerCase());
}

function toProvider(offer: OnChainOffer, provider?: OnChainProvider): Provider {
  return {
    id: String(offer.id),
    name: provider?.account_id ?? offer.provider_id,
    label: "Live Testnet",
    description: `${offer.service_type} offer from ${offer.provider_id}. On-chain offer #${offer.id}.`,
    reputation: provider?.reputation ?? 0,
    completed: provider ? Number(provider.successful_orders) : 0,
    bond: provider ? formatYoctoNear(provider.bond) : "Not available",
    maxOrder: formatYoctoNear(offer.max_contract_amount),
    sla: offer.sla,
    price: formatYoctoNear(offer.price),
    priceYocto: offer.price,
    maxContractYocto: offer.max_contract_amount,
    criteria: parseCriteria(offer.verification_criteria),
    accent: provider && provider.reputation >= 70 ? "teal" : "amber",
    source: "testnet",
    onChainOfferId: offer.id,
    providerAccountId: offer.provider_id,
  };
}

function toTransaction(order: OnChainOrder, providerName: string): Transaction {
  const confidence = order.verdict?.confidence ?? 0;
  const highRisk = order.status === "Slashed" || (order.verdict !== null && confidence < 80);
  return {
    id: `ORD-${order.id}`,
    provider: providerName,
    service: order.specification.slice(0, 70) || `Offer #${order.offer_id}`,
    amount: formatYoctoNear(order.amount),
    status: statusLabel(order.status),
    time: formatTimestampNs(order.created_at),
    hash: "No transaction hash indexed",
    risk: highRisk ? "High" : order.verdict ? "Low" : "Medium",
    confidence,
    detail: order.verdict?.reasons ?? order.specification,
  };
}

function toGuardianCase(order: OnChainOrder, providerName: string, largeSlashThreshold: string): GuardianCase {
  const confidence = order.verdict?.confidence ?? 0;
  const escalated = BigInt(order.slash_amount) >= BigInt(largeSlashThreshold) || confidence < 80;
  const status: GuardianCase["status"] = order.status.toLowerCase() === "appealed" ? "Escalated" : order.guardian_approved ? "Approved" : "Needs decision";
  return {
    id: `ORD-${order.id}`,
    title: order.specification.slice(0, 70) || `Order #${order.id}`,
    provider: providerName,
    amount: formatYoctoNear(order.amount),
    status,
    confidence,
    threshold: confidence < 80 ? "Below low-confidence threshold" : escalated ? "Large-case governance review" : "Guardian review required",
    evidence: order.verdict?.evidence ?? order.work_reference ?? "No work evidence has been submitted yet.",
    age: formatTimestampNs(order.created_at),
    priority: confidence < 80 || escalated ? "High" : "Medium",
  };
}

function toAuditEvent(event: OnChainAuditEvent): AuditEvent {
  const tone: AuditEvent["tone"] = event.kind.includes("slash") || event.kind.includes("failed")
    ? "danger"
    : event.kind.includes("release") || event.kind.includes("success")
      ? "success"
      : event.kind.includes("appeal") || event.kind.includes("review")
        ? "warning"
        : "neutral";
  return {
    id: `evt-${event.sequence}`,
    time: formatTimestampNs(event.timestamp),
    actor: event.actor,
    action: event.kind.replaceAll("_", " "),
    subject: event.order_id === null ? "Contract" : `ORD-${event.order_id}`,
    result: event.details,
    hash: "—",
    tone,
  };
}

export async function loadTestnetContractSnapshot(contractId: string, signal?: AbortSignal): Promise<TestnetContractSnapshot> {
  const [providerCount, offerCount, orderCount, providers, offers, orders, auditEvents, roleView, policy, insurancePool] = await Promise.all([
    readTestnetView<number>(contractId, "get_provider_count", {}, signal),
    readTestnetView<number>(contractId, "get_offer_count", {}, signal),
    readTestnetView<number>(contractId, "get_order_count", {}, signal),
    readTestnetView<OnChainProvider[]>(contractId, "get_providers", { start: 0, limit: PAGE_SIZE }, signal),
    readTestnetView<OnChainOffer[]>(contractId, "get_offers", { start: 0, limit: PAGE_SIZE }, signal),
    readTestnetView<OnChainOrder[]>(contractId, "get_orders", { start: 0, limit: PAGE_SIZE }, signal),
    readTestnetView<OnChainAuditEvent[]>(contractId, "get_audit_events", { start: 0, limit: PAGE_SIZE }, signal),
    readTestnetView<{ owner_id: string; auditor_id: string | null; guardian_id: string | null; governance_signer: string | null }>(contractId, "get_roles", {}, signal),
    readTestnetView<OnChainPolicy>(contractId, "get_policy", {}, signal),
    readTestnetView<string>(contractId, "get_insurance_pool", {}, signal),
  ]);
  if (providers.length > providerCount || offers.length > offerCount || orders.length > orderCount) {
    throw new Error("The Testnet contract returned inconsistent list counts.");
  }
  const roles: OnChainRoles = {
    ...roleView,
    governance_signers: roleView.governance_signer ? [roleView.governance_signer] : [],
    low_confidence_threshold: policy.low_confidence_threshold,
    large_slash_threshold: policy.large_slash_threshold,
    appeal_window_ns: policy.reputation_profile === "production" ? policy.production_appeal_window_ns : policy.demo_appeal_window_ns,
  };
  const appealStatuses = deriveAppealStatuses(auditEvents);
  const normalizedOrders = orders.map((order) => ({
    ...order,
    appeal_status: appealStatuses.get(order.id) ?? order.appeal_status,
  }));
  return { contractId, providers, offers, orders: normalizedOrders, auditEvents, roles, insurancePool };
}

export function buildLiveDashboard(
  snapshot: TestnetContractSnapshot,
  walletAccountId: string | null,
  fallback: DashboardData,
): DashboardData {
  const providersById = new Map(snapshot.providers.map((provider) => [provider.account_id, provider]));
  const offerRows = snapshot.offers.filter((offer) => offer.active);
  const providers = offerRows.map((offer) => toProvider(offer, providersById.get(offer.provider_id)));
  const providerNames = new Map(providers.map((provider) => [provider.providerAccountId ?? provider.name, provider.name]));
  const transactions = snapshot.orders.map((order) => toTransaction(order, providerNames.get(order.provider_id) ?? order.provider_id));
  const guardianCases = snapshot.orders
    .filter((order) => order.status.toLowerCase() === "verdictrecorded" && !order.guardian_approved)
    .map((order) => toGuardianCase(order, providerNames.get(order.provider_id) ?? order.provider_id, snapshot.roles.large_slash_threshold));
  const auditEvents = snapshot.auditEvents.map(toAuditEvent).reverse();
  const totalBondYocto = snapshot.providers.reduce((total, provider) => total + BigInt(provider.bond), 0n);
  const lockedEscrowYocto = snapshot.orders
    .filter((order) => isOpenOrder(order.status))
    .reduce((total, order) => total + BigInt(order.amount), 0n);
  const settledOrders = snapshot.orders.filter((order) => ["released", "slashed", "refunded", "guardianrejected"].includes(order.status.toLowerCase()));
  const successfulOrders = settledOrders.filter((order) => order.status.toLowerCase() === "released").length;
  const settlementRate = settledOrders.length ? `${Math.round(successfulOrders / settledOrders.length * 100)}%` : "—";

  return {
    ...fallback,
    network: "NEAR Testnet",
    contract: snapshot.contractId,
    wallet: walletAccountId ?? "Not connected",
    providers,
    transactions,
    guardianCases,
    auditEvents,
    metrics: {
      totalBond: formatYoctoNear(totalBondYocto),
      lockedEscrow: formatYoctoNear(lockedEscrowYocto),
      activeCases: guardianCases.length,
      settlementRate,
    },
  };
}
