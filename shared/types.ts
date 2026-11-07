export type DemoRole =
  | "buyer"
  | "provider"
  | "auditor"
  | "guardian"
  | "governance"
  | "external-auditor";

export type OrderStatus =
  | "draft"
  | "awaiting_escrow"
  | "escrow_locked"
  | "work_submitted"
  | "under_review"
  | "appeal_window"
  | "released"
  | "refunded"
  | "slashed";

export interface DashboardSummary {
  network: "testnet";
  contractId: string | null;
  providers: number;
  activeOffers: number;
  openOrders: number;
  pendingReviews: number;
  pendingApprovals: number;
  publicLedgerNotice: string;
  intentsStatus: "simulated";
}

export interface ProviderView {
  id: string;
  accountId: string;
  displayName: string;
  persona: string;
  reputation: number;
  bondYocto: string;
  bondRatioPercent: number;
  status: string;
}

export interface OfferView {
  id: string;
  providerId: string;
  title: string;
  serviceType: string;
  priceYocto: string;
  sla: string;
  criteria: string[];
  maxContractYocto: string;
  provider?: ProviderView;
}

export interface OrderView {
  id: string;
  offerId: string;
  buyerAccountId: string;
  providerAccountId: string;
  amountYocto: string;
  status: OrderStatus | string;
  scenario: string;
  specification: string;
  appealUntil: string | null;
  createdAt: string;
}

export interface VerdictView {
  id: string;
  orderId: string;
  auditorAccountId: string;
  passed: boolean;
  confidence: number;
  reasons: string[];
  evidence: string[];
  createdAt: string;
}

export interface AuditEventView {
  id: string;
  orderId: string | null;
  actorAccountId: string;
  actorRole: string;
  eventType: string;
  summary: string;
  txHash: string | null;
  network: "testnet";
  createdAt: string;
}

export interface ChainTransactionView {
  txHash: string;
  orderId: string | null;
  signerAccountId: string;
  receiverAccountId: string;
  action: string;
  status: string;
  network: "testnet";
  createdAt: string;
}

export interface DashboardPayload {
  summary: DashboardSummary;
  providers: ProviderView[];
  offers: OfferView[];
  orders: OrderView[];
  verdicts: VerdictView[];
  auditEvents: AuditEventView[];
  transactions: ChainTransactionView[];
}
