import {
  boolean,
  int,
  json,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

export const providers = mysqlTable("providers", {
  id: varchar("id", { length: 80 }).primaryKey(),
  accountId: varchar("account_id", { length: 64 }).notNull().unique(),
  displayName: varchar("display_name", { length: 160 }).notNull(),
  persona: varchar("persona", { length: 32 }).notNull(),
  reputation: int("reputation").notNull().default(70),
  bondYocto: varchar("bond_yocto", { length: 80 }).notNull().default("0"),
  bondRatioPercent: int("bond_ratio_percent").notNull().default(100),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const offers = mysqlTable("offers", {
  id: varchar("id", { length: 80 }).primaryKey(),
  providerId: varchar("provider_id", { length: 80 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  serviceType: varchar("service_type", { length: 80 }).notNull(),
  priceYocto: varchar("price_yocto", { length: 80 }).notNull(),
  sla: varchar("sla", { length: 255 }).notNull(),
  criteria: json("criteria").$type<string[]>().notNull(),
  maxContractYocto: varchar("max_contract_yocto", { length: 80 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const orders = mysqlTable("orders", {
  id: varchar("id", { length: 80 }).primaryKey(),
  offerId: varchar("offer_id", { length: 80 }).notNull(),
  buyerAccountId: varchar("buyer_account_id", { length: 64 }).notNull(),
  providerAccountId: varchar("provider_account_id", { length: 64 }).notNull(),
  amountYocto: varchar("amount_yocto", { length: 80 }).notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  scenario: varchar("scenario", { length: 32 }).notNull().default("standard"),
  specification: text("specification").notNull(),
  appealUntil: timestamp("appeal_until"),
  appealReason: text("appeal_reason"),
  appealResolved: boolean("appeal_resolved").notNull().default(false),
  slashAmountYocto: varchar("slash_amount_yocto", { length: 80 }).notNull().default("0"),
  insuranceShareYocto: varchar("insurance_share_yocto", { length: 80 }).notNull().default("0"),
  auditorShareYocto: varchar("auditor_share_yocto", { length: 80 }).notNull().default("0"),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
});

export const verdicts = mysqlTable("verdicts", {
  id: varchar("id", { length: 80 }).primaryKey(),
  orderId: varchar("order_id", { length: 80 }).notNull(),
  auditorAccountId: varchar("auditor_account_id", { length: 64 }).notNull(),
  passed: boolean("passed").notNull(),
  confidence: int("confidence").notNull(),
  reasons: json("reasons").$type<string[]>().notNull(),
  evidence: json("evidence").$type<string[]>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const decisions = mysqlTable("decisions", {
  id: varchar("id", { length: 80 }).primaryKey(),
  orderId: varchar("order_id", { length: 80 }).notNull(),
  actorAccountId: varchar("actor_account_id", { length: 64 }).notNull(),
  actorRole: varchar("actor_role", { length: 32 }).notNull(),
  decision: varchar("decision", { length: 32 }).notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: varchar("id", { length: 80 }).primaryKey(),
  orderId: varchar("order_id", { length: 80 }),
  actorAccountId: varchar("actor_account_id", { length: 64 }).notNull(),
  actorRole: varchar("actor_role", { length: 32 }).notNull(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  summary: varchar("summary", { length: 500 }).notNull(),
  details: json("details").$type<Record<string, unknown>>(),
  txHash: varchar("tx_hash", { length: 128 }),
  network: varchar("network", { length: 16 }).notNull().default("testnet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const chainTransactions = mysqlTable("chain_transactions", {
  txHash: varchar("tx_hash", { length: 128 }).primaryKey(),
  orderId: varchar("order_id", { length: 80 }),
  signerAccountId: varchar("signer_account_id", { length: 64 }).notNull(),
  receiverAccountId: varchar("receiver_account_id", { length: 64 }).notNull(),
  action: varchar("action", { length: 80 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  network: varchar("network", { length: 16 }).notNull().default("testnet"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
