import { closeDatabase, pool } from "./db.js";

const demoProviders = [
  {
    id: "demo-agent-a",
    accountId: "agent-a.demo",
    displayName: "Agent A · Verified Researcher",
    persona: "honest",
    reputation: 94,
    bondYocto: "5000000000000000000000000",
    bondRatioPercent: 25,
  },
  {
    id: "demo-agent-b",
    accountId: "agent-b.demo",
    displayName: "Agent B · Low-Cost Analyst",
    persona: "dishonest-demo",
    reputation: 61,
    bondYocto: "2000000000000000000000000",
    bondRatioPercent: 100,
  },
];

const demoOffers = [
  {
    id: "offer-agent-a-research",
    providerId: "demo-agent-a",
    title: "Verified market research brief",
    serviceType: "Research",
    priceYocto: "400000000000000000000000",
    sla: "Deliver within 10 minutes; include at least three verifiable sources.",
    criteria: JSON.stringify([
      "At least three source URLs are included",
      "All figures cite a source and date",
      "Summary is consistent with the source material",
    ]),
    maxContractYocto: "400000000000000000000000",
  },
  {
    id: "offer-agent-b-research",
    providerId: "demo-agent-b",
    title: "Fast market research brief",
    serviceType: "Research",
    priceYocto: "280000000000000000000000",
    sla: "Deliver within 5 minutes; include sources for key claims.",
    criteria: JSON.stringify([
      "At least three source URLs are included",
      "All figures cite a source and date",
      "Summary is consistent with the source material",
    ]),
    maxContractYocto: "280000000000000000000000",
  },
];

const demoEvents = [
  ["event-demo-01", "demo-agent-a", "provider", "provider_registered", "Agent A listed a verified research offer."],
  ["event-demo-02", "demo-agent-b", "provider", "provider_registered", "Agent B listed a lower-priced research offer."],
  ["event-demo-03", "auditor.demo", "auditor", "verdict_recorded", "A deterministic review flagged missing source evidence in the replayable fraud scenario."],
] as const;

async function seed(): Promise<void> {
  try {
    if (!pool) throw new Error("DATABASE_URL is required before the Bil Bond demo seed can run.");
    for (const provider of demoProviders) {
      await pool.query(
        `INSERT IGNORE INTO providers
          (id, account_id, display_name, persona, reputation, bond_yocto, bond_ratio_percent, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
        [
          provider.id,
          provider.accountId,
          provider.displayName,
          provider.persona,
          provider.reputation,
          provider.bondYocto,
          provider.bondRatioPercent,
        ],
      );
    }

    for (const offer of demoOffers) {
      await pool.query(
        `INSERT IGNORE INTO offers
          (id, provider_id, title, service_type, price_yocto, sla, criteria, max_contract_yocto, is_active)
         VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON), ?, TRUE)`,
        [
          offer.id,
          offer.providerId,
          offer.title,
          offer.serviceType,
          offer.priceYocto,
          offer.sla,
          offer.criteria,
          offer.maxContractYocto,
        ],
      );
    }

    for (const [id, actor, role, eventType, summary] of demoEvents) {
      await pool.query(
        `INSERT IGNORE INTO audit_events
          (id, actor_account_id, actor_role, event_type, summary, network)
         VALUES (?, ?, ?, ?, ?, 'testnet')`,
        [id, actor, role, eventType, summary],
      );
    }

    console.info("Bil Bond demo seed is present; existing rows were left unchanged.");
  } finally {
    await closeDatabase();
  }
}

seed().catch((error: unknown) => {
  console.error("Demo seed failed.", error);
  process.exitCode = 1;
});
