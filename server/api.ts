import { randomUUID } from "node:crypto";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import {
  auditEvents,
  chainTransactions,
  decisions,
  offers,
  orders,
  providers,
  verdicts,
} from "../drizzle/schema.js";
import { evaluateSubmission } from "../shared/verification.js";
import { applyOrderTransition, type TransitionAction } from "../shared/order-transition.js";
import { distributeSlash } from "../shared/economics.js";
import { databaseConfigured, db } from "./db.js";
import { verifyTestnetTransaction } from "./nearRpc.js";

export const apiRouter = Router();

apiRouter.get("/health", async (_request, response) => {
  if (!databaseConfigured) {
    response.status(503).json({ status: "degraded", database: "not configured", network: "testnet" });
    return;
  }
  try {
    await db.execute("SELECT 1");
    response.json({ status: "ok", database: "ready", network: "testnet" });
  } catch {
    response.status(503).json({ status: "degraded", database: "unavailable", network: "testnet" });
  }
});

apiRouter.use((_request, response, next) => {
  if (!databaseConfigured) {
    response.status(503).json({ error: "MySQL is not configured. Use the clearly labelled local demo snapshot or configure DATABASE_URL." });
    return;
  }
  next();
});

apiRouter.get("/dashboard", async (_request, response, next) => {
  try {
    const [providerRows, offerRows, orderRows, verdictRows, eventRows, transactionRows] = await Promise.all([
      db.select().from(providers).orderBy(desc(providers.reputation)).limit(50),
      db.select().from(offers).where(eq(offers.isActive, true)).limit(100),
      db.select().from(orders).orderBy(desc(orders.createdAt)).limit(50),
      db.select().from(verdicts).orderBy(desc(verdicts.createdAt)).limit(50),
      db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(100),
      db.select().from(chainTransactions).orderBy(desc(chainTransactions.createdAt)).limit(50),
    ]);

    const providerViews = providerRows.map((provider) => ({
      id: provider.id,
      accountId: provider.accountId,
      displayName: provider.displayName,
      persona: provider.persona,
      reputation: provider.reputation,
      bondYocto: provider.bondYocto,
      bondRatioPercent: provider.bondRatioPercent,
      status: provider.status,
    }));

    const openStatuses = new Set(["awaiting_escrow", "escrow_locked", "work_submitted", "under_review", "appeal_window"]);
    response.json({
      summary: {
        network: "testnet",
        contractId: process.env.BIL_BOND_CONTRACT_ID ?? null,
        providers: providerRows.length,
        activeOffers: offerRows.length,
        openOrders: orderRows.filter((order) => openStatuses.has(order.status)).length,
        pendingReviews: orderRows.filter((order) => ["work_submitted", "under_review"].includes(order.status)).length,
        pendingApprovals: orderRows.filter((order) => order.status === "appeal_window").length,
        publicLedgerNotice: "Testnet contract values and events are publicly visible on-chain.",
        intentsStatus: "not_used",
      },
      providers: providerViews,
      offers: offerRows.map((offer) => ({
        ...offer,
        criteria: Array.isArray(offer.criteria) ? offer.criteria : [],
        provider: providerViews.find((provider) => provider.id === offer.providerId),
      })),
      orders: orderRows,
      verdicts: verdictRows,
      auditEvents: eventRows,
      transactions: transactionRows,
    });
  } catch (error) {
    next(error);
  }
});

const orderSchema = z.object({
  offerId: z.string().min(1).max(80),
  buyerAccountId: z.string().min(1).max(64),
  scenario: z.enum(["standard", "honest", "dishonest"]),
  specification: z.string().min(20).max(4000),
});

apiRouter.post("/orders", async (request, response, next) => {
  try {
    const input = orderSchema.parse(request.body);
    const [offer] = await db.select().from(offers).where(eq(offers.id, input.offerId)).limit(1);
    if (!offer || !offer.isActive) {
      response.status(404).json({ error: "Offer not found or inactive." });
      return;
    }

    const [provider] = await db.select().from(providers).where(eq(providers.id, offer.providerId)).limit(1);
    if (!provider) {
      response.status(409).json({ error: "Offer has no registered provider." });
      return;
    }

    const id = `order-${randomUUID()}`;
    await db.insert(orders).values({
      id,
      offerId: offer.id,
      buyerAccountId: input.buyerAccountId,
      providerAccountId: provider.accountId,
      amountYocto: offer.priceYocto,
      status: "awaiting_escrow",
      scenario: input.scenario,
      specification: input.specification,
    });
    await db.insert(auditEvents).values({
      id: `event-${randomUUID()}`,
      orderId: id,
      actorAccountId: input.buyerAccountId,
      actorRole: "buyer-demo",
      eventType: "order_created",
      summary: "A demo order was created. No funds moved; escrow is not locked until a Testnet wallet transaction confirms it.",
      network: "testnet",
    });

    response.status(201).json({ orderId: id, status: "awaiting_escrow", network: "testnet", fundsMoved: false });
  } catch (error) {
    next(error);
  }
});

const submissionSchema = z.object({
  orderId: z.string().min(1).max(80),
  summary: z.string().max(4000).default(""),
  sources: z.array(z.string().max(1000)).max(20).default([]),
  claims: z.array(z.string().max(500)).max(20).default([]),
  fabricated: z.boolean().optional(),
});

apiRouter.post("/audit/evaluate", async (request, response, next) => {
  try {
    const input = submissionSchema.parse(request.body);
    const [order] = await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1);
    if (!order) {
      response.status(404).json({ error: "Order not found." });
      return;
    }

    const result = evaluateSubmission(input);
    const verdictId = `verdict-${randomUUID()}`;
    await db.insert(verdicts).values({
      id: verdictId,
      orderId: order.id,
      auditorAccountId: "auditor.demo",
      passed: result.passed,
      confidence: result.confidence,
      reasons: result.reasons,
      evidence: result.evidence,
    });
    await db.update(orders)
      .set({ status: "under_review", updatedAt: new Date() })
      .where(eq(orders.id, order.id));
    await db.insert(auditEvents).values({
      id: `event-${randomUUID()}`,
      orderId: order.id,
      actorAccountId: "auditor.demo",
      actorRole: "auditor-demo",
      eventType: "verdict_recorded",
      summary: `A deterministic demo verdict was recorded: ${result.passed ? "pass" : "fail"}, confidence ${result.confidence}%. This did not move funds.`,
      details: { verdictId, reasons: result.reasons, evidence: result.evidence },
      network: "testnet",
    });

    response.json({ ...result, verdictId, fundsMoved: false, network: "testnet" });
  } catch (error) {
    next(error);
  }
});

const transitionSchema = z.object({
  action: z.enum(["guardian_approve", "governance_approve", "provider_appeal", "governance_resolve_appeal", "finalize_slash"]),
  actorAccountId: z.string().min(2).max(64),
  reason: z.string().max(2000).default(""),
  upholdSlash: z.boolean().optional(),
});

apiRouter.post("/orders/:orderId/transition", async (request, response, next) => {
  try {
    const input = transitionSchema.parse(request.body);
    const orderId = z.string().min(1).max(80).parse(request.params.orderId);
    const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
    if (!order) {
      response.status(404).json({ error: "Order not found." });
      return;
    }
    const [verdict] = await db.select().from(verdicts).where(eq(verdicts.orderId, order.id)).orderBy(desc(verdicts.createdAt)).limit(1);
    if (!verdict) {
      response.status(409).json({ error: "A deterministic auditor verdict is required before this transition." });
      return;
    }
    const priorDecisions = await db.select().from(decisions).where(eq(decisions.orderId, order.id));
    const providerRows = await db.select().from(providers).where(eq(providers.accountId, order.providerAccountId)).limit(1);
    const provider = providerRows[0];
    if (!provider) {
      response.status(409).json({ error: "Provider state is unavailable." });
      return;
    }
    const configuredGuardian = process.env.BIL_BOND_GUARDIAN_ACCOUNT_ID ?? "guardian.demo";
    const configuredGovernance = process.env.BIL_BOND_GOVERNANCE_ACCOUNT_ID ?? "governance.demo";
    const expectedActor = input.action === "provider_appeal"
      ? order.providerAccountId
      : input.action === "guardian_approve"
        ? configuredGuardian
        : configuredGovernance;
    if (input.actorAccountId !== expectedActor) {
      response.status(403).json({ error: `Only the configured ${input.action === "provider_appeal" ? "provider" : input.action === "guardian_approve" ? "guardian" : "governance"} actor may perform this transition.` });
      return;
    }
    if (priorDecisions.some((decision) => decision.actorAccountId === input.actorAccountId && decision.decision === input.action)) {
      response.status(409).json({ error: "This actor has already recorded this transition." });
      return;
    }
    const actorRole = input.action === "provider_appeal" ? "provider" : input.action === "governance_approve" || input.action === "governance_resolve_appeal" ? "governance" : input.action === "guardian_approve" ? "guardian" : "settlement-keeper";
    const persistedSlash = BigInt(order.slashAmountYocto);
    const transition = applyOrderTransition({
      status: (order.status === "under_review" ? "verdict_recorded" : order.status) as "verdict_recorded" | "appeal_window" | "appealed" | "refunded" | "slashed",
      passed: verdict.passed,
      confidence: verdict.confidence,
      profile: "demo",
      appealUntilMs: order.appealUntil?.getTime() ?? null,
      slashAmountYocto: persistedSlash,
      reservedBondYocto: BigInt(provider.bondYocto),
      providerBondYocto: BigInt(provider.bondYocto),
      providerReputation: provider.reputation,
      auditorApproved: true,
      guardianApproved: priorDecisions.some((decision) => decision.actorRole === "guardian" && ["approve", "guardian_approve"].includes(decision.decision)),
      governanceApproved: priorDecisions.some((decision) => decision.actorRole === "governance" && ["approve", "governance_approve"].includes(decision.decision)),
      insurancePoolYocto: 0n,
      auditorHeldYocto: 0n,
    }, input.action as TransitionAction, { nowMs: Date.now(), upholdSlash: input.upholdSlash });

    const slashDistribution = distributeSlash(transition.slashAmountYocto);
    await db.insert(decisions).values({
      id: `decision-${randomUUID()}`,
      orderId: order.id,
      actorAccountId: input.actorAccountId,
      actorRole,
      decision: input.action,
      reason: input.reason || `State transition: ${input.action}`,
    });
    await db.update(orders).set({
      status: transition.status,
      appealUntil: transition.appealUntilMs === null ? null : new Date(transition.appealUntilMs),
      appealReason: input.action === "provider_appeal" ? input.reason : order.appealReason,
      appealResolved: input.action === "governance_resolve_appeal" ? true : order.appealResolved,
      slashAmountYocto: transition.slashAmountYocto.toString(),
      insuranceShareYocto: transition.status === "slashed" || (transition.status === "refunded" && input.action === "governance_resolve_appeal") ? slashDistribution.insurancePoolYocto.toString() : order.insuranceShareYocto,
      auditorShareYocto: transition.status === "slashed" ? slashDistribution.auditorHeldYocto.toString() : order.auditorShareYocto,
      settledAt: ["slashed", "refunded"].includes(transition.status) ? new Date() : order.settledAt,
      updatedAt: new Date(),
    }).where(eq(orders.id, order.id));
    await db.update(providers).set({
      bondYocto: transition.providerBondYocto.toString(),
      reputation: transition.providerReputation,
    }).where(eq(providers.accountId, order.providerAccountId));
    await db.insert(auditEvents).values({
      id: `event-${randomUUID()}`,
      orderId: order.id,
      actorAccountId: input.actorAccountId,
      actorRole,
      eventType: input.action,
      summary: `${input.action} applied to the demo state machine. No funds moved; a matching user-signed Testnet contract transaction is required for settlement.`,
      details: { status: transition.status, confidence: verdict.confidence, slashAmountYocto: transition.slashAmountYocto.toString() },
      network: "testnet",
    });
    response.json({ orderId: order.id, status: transition.status, network: "testnet", fundsMoved: false });
  } catch (error) {
    next(error);
  }
});

const txSchema = z.object({
  txHash: z.string().min(20).max(128),
  signerAccountId: z.string().min(2).max(64).regex(/^[a-z0-9._-]+\.testnet$/i),
  expectedContractId: z.string().min(2).max(64).regex(/^[a-z0-9._-]+\.testnet$/i),
  orderId: z.string().max(80).optional(),
  action: z.string().min(1).max(80),
});

apiRouter.post("/transactions/confirm", async (request, response, next) => {
  try {
    const input = txSchema.parse(request.body);
    const verification = await verifyTestnetTransaction(
      input.txHash,
      input.signerAccountId,
      input.expectedContractId,
    );
    if (!verification.success) {
      response.status(409).json({ error: verification.error, network: "testnet" });
      return;
    }

    await db.insert(chainTransactions).values({
      txHash: input.txHash,
      orderId: input.orderId ?? null,
      signerAccountId: input.signerAccountId,
      receiverAccountId: input.expectedContractId,
      action: input.action,
      status: "final",
      network: "testnet",
    }).onDuplicateKeyUpdate({ set: { status: "final" } });
    await db.insert(auditEvents).values({
      id: `event-${randomUUID()}`,
      orderId: input.orderId ?? null,
      actorAccountId: input.signerAccountId,
      actorRole: "wallet-signer",
      eventType: "testnet_transaction_confirmed",
      summary: `${input.action} confirmed on NEAR Testnet.`,
      txHash: input.txHash,
      network: "testnet",
    }).onDuplicateKeyUpdate({ set: { summary: `${input.action} confirmed on NEAR Testnet.` } });

    response.json({ status: "final", txHash: input.txHash, receiverId: input.expectedContractId, network: "testnet" });
  } catch (error) {
    next(error);
  }
});

apiRouter.get("/audit/export.csv", async (_request, response, next) => {
  try {
    const rows = await db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(1000);
    const cell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const header = ["timestamp", "actor", "role", "event", "order", "reason", "transaction_hash", "network"];
    const lines = [header.map(cell).join(",")];
    for (const row of rows) {
      lines.push([
        row.createdAt.toISOString(),
        row.actorAccountId,
        row.actorRole,
        row.eventType,
        row.orderId,
        row.summary,
        row.txHash,
        row.network,
      ].map(cell).join(","));
    }

    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", 'attachment; filename="bil-bond-audit.csv"');
    response.send(`\uFEFF${lines.join("\r\n")}`);
  } catch (error) {
    next(error);
  }
});

apiRouter.use((error: unknown, _request: unknown, response: { status: (code: number) => { json: (body: unknown) => void } }, _next: unknown) => {
  if (error instanceof z.ZodError) {
    response.status(400).json({ error: "Invalid request.", details: error.issues.map((issue) => issue.message) });
    return;
  }
  console.error("Bil Bond API request failed.", error);
  response.status(500).json({ error: "The request could not be completed." });
});
