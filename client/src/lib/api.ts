export type Network = 'NEAR Testnet'
export type TransactionStatus = 'Escrow locked' | 'Work submitted' | 'Under review' | 'Appeal window' | 'Appealed' | 'Released' | 'Refunded' | 'Slashed'
export type QueueStatus = 'Needs decision' | 'Escalated' | 'Approved'

export type Provider = {
  id: string
  name: string
  label: 'Honest' | 'Dishonest' | 'Live Testnet' | 'Demo listing'
  description: string
  reputation: number
  completed: number
  bond: string
  maxOrder: string
  sla: string
  price: string
  criteria: string[]
  accent: 'teal' | 'amber'
  source?: 'demo' | 'testnet'
  onChainOfferId?: number
  providerAccountId?: string
  priceYocto?: string
  maxContractYocto?: string
}

export type Transaction = {
  id: string
  provider: string
  service: string
  amount: string
  status: TransactionStatus
  time: string
  hash: string
  risk: 'Low' | 'Medium' | 'High'
  confidence: number
  detail: string
}

export type GuardianCase = {
  id: string
  title: string
  provider: string
  providerAccountId?: string
  appealUntil?: string | null
  amount: string
  status: QueueStatus
  confidence: number
  threshold: string
  evidence: string
  age: string
  priority: 'High' | 'Medium'
}

export type AuditEvent = {
  id: string
  time: string
  actor: string
  action: string
  subject: string
  result: string
  hash: string
  tone: 'success' | 'warning' | 'danger' | 'neutral'
}

export type DashboardData = {
  network: Network
  contract: string
  wallet: string
  providers: Provider[]
  transactions: Transaction[]
  guardianCases: GuardianCase[]
  auditEvents: AuditEvent[]
  metrics: {
    totalBond: string
    lockedEscrow: string
    activeCases: number
    settlementRate: string
  }
}

const demoData: DashboardData = {
  network: 'NEAR Testnet',
  contract: 'Not configured',
  wallet: 'Not connected',
  metrics: {
    totalBond: '142.80 NEAR',
    lockedEscrow: '18.40 NEAR',
    activeCases: 2,
    settlementRate: '96.4%',
  },
  providers: [
    {
      id: 'agent-a',
      name: 'Agent A',
      label: 'Honest',
      description: 'Structured research delivery with verifiable sources and clean handoffs.',
      reputation: 96,
      completed: 184,
      bond: '40.00 NEAR',
      maxOrder: '12.00 NEAR',
      sla: '24 hours',
      price: '6.00 NEAR',
      criteria: ['Three primary sources', 'Citations resolve', 'Summary under 1,200 words'],
      accent: 'teal',
    },
    {
      id: 'agent-b',
      name: 'Agent B',
      label: 'Dishonest',
      description: 'Cheaper research offer used in the demo to exercise evidence and slashing controls.',
      reputation: 41,
      completed: 29,
      bond: '15.00 NEAR',
      maxOrder: '5.00 NEAR',
      sla: '24 hours',
      price: '3.50 NEAR',
      criteria: ['Three primary sources', 'Citations resolve', 'Summary under 1,200 words'],
      accent: 'amber',
    },
  ],
  transactions: [
    {
      id: 'ORD-2048', provider: 'Agent B', service: 'Market landscape brief', amount: '3.50 NEAR', status: 'Under review', time: '12 min ago', hash: 'DEMO ONLY · no transaction', risk: 'High', confidence: 68, detail: 'Submitted citations contain two unresolved links. Escalated under the low-confidence rule.',
    },
    {
      id: 'ORD-2047', provider: 'Agent A', service: 'Competitor research brief', amount: '6.00 NEAR', status: 'Released', time: '2 hours ago', hash: 'DEMO ONLY · no transaction', risk: 'Low', confidence: 97, detail: 'All deterministic criteria passed. Escrow released to the provider after Guardian approval.',
    },
    {
      id: 'ORD-2045', provider: 'Agent A', service: 'Source verification pack', amount: '4.80 NEAR', status: 'Escrow locked', time: 'Yesterday', hash: 'DEMO ONLY · no transaction', risk: 'Low', confidence: 92, detail: 'Work is in progress. The appeal window and settlement policy are attached to this order.',
    },
    {
      id: 'ORD-2041', provider: 'Agent B', service: 'Research summary', amount: '3.20 NEAR', status: 'Slashed', time: 'Oct 21, 2026', hash: 'DEMO ONLY · no transaction', risk: 'High', confidence: 89, detail: 'Failed verification. Distribution: 70% buyer, 20% insurance pool, 10% auditor incentive.',
    },
  ],
  guardianCases: [
    {
      id: 'ORD-2048', title: 'Market landscape brief', provider: 'Agent B', amount: '3.50 NEAR', status: 'Needs decision', confidence: 68, threshold: 'Below 80% confidence', evidence: '2 of 3 submitted citations do not resolve to the claimed source.', age: '12 min', priority: 'High',
    },
    {
      id: 'ORD-2039', title: 'Vendor comparison memo', provider: 'Agent B', amount: '4.10 NEAR', status: 'Escalated', confidence: 74, threshold: 'Large-case governance review', evidence: 'Evidence is mixed. A 2-of-3 human approval is required before any slash.', age: '1 hr', priority: 'High',
    },
    {
      id: 'ORD-2045', title: 'Source verification pack', provider: 'Agent A', amount: '4.80 NEAR', status: 'Approved', confidence: 92, threshold: 'Standard release', evidence: 'All required sources resolve and output schema is valid.', age: 'Yesterday', priority: 'Medium',
    },
  ],
  auditEvents: [
    { id: 'evt_8f31', time: '12:04:18', actor: 'Auditor / demo', action: 'Verdict recorded', subject: 'ORD-2048', result: 'Fail · 68% confidence', hash: 'DEMO ONLY · no transaction', tone: 'danger' },
    { id: 'evt_8f22', time: '11:58:42', actor: 'Buyer / demo', action: 'Escrow locked', subject: 'ORD-2048', result: '3.50 NEAR', hash: 'DEMO ONLY · no transaction', tone: 'warning' },
    { id: 'evt_8f19', time: '09:31:10', actor: 'Guardian / demo', action: 'Release approved', subject: 'ORD-2047', result: '6.00 NEAR', hash: 'DEMO ONLY · no transaction', tone: 'success' },
    { id: 'evt_8e91', time: 'Yesterday', actor: 'Contract', action: 'Bond slash settled', subject: 'ORD-2041', result: '70 / 20 / 10 split', hash: 'DEMO ONLY · no transaction', tone: 'danger' },
    { id: 'evt_8e42', time: 'Oct 20, 2026', actor: 'Provider / demo', action: 'Bond deposited', subject: 'Agent A', result: '40.00 NEAR', hash: 'DEMO ONLY · no transaction', tone: 'neutral' },
  ],
}

type RemoteProvider = { id: string; accountId: string; displayName: string; persona: string; reputation: number; bondYocto: string; bondRatioPercent: number; status: string }
type RemoteOffer = { id: string; providerId: string; title: string; serviceType: string; priceYocto: string; sla: string; criteria: string[]; maxContractYocto: string }
type RemoteDashboard = {
  summary: { network: 'testnet'; contractId: string | null }
  providers: RemoteProvider[]
  offers: Array<RemoteOffer & { provider?: RemoteProvider }>
  orders: Array<{ id: string; offerId: string; buyerAccountId: string; providerAccountId: string; amountYocto: string; status: string; scenario: string; specification: string; appealUntil: string | null; createdAt: string }>
  verdicts: Array<{ id: string; orderId: string; passed: boolean; confidence: number; reasons: string[]; evidence: string[] }>
  auditEvents: Array<{ id: string; orderId: string | null; actorAccountId: string; actorRole: string; eventType: string; summary: string; txHash: string | null; createdAt: string }>
  transactions: Array<{ txHash: string; orderId: string | null; signerAccountId: string; action: string; status: string }>
}

export type DataSource = 'database-demo' | 'demo-offline' | 'testnet'

function formatYocto(value: string): string {
  const amount = BigInt(value)
  const whole = amount / 10n ** 24n
  const decimals = (amount % 10n ** 24n).toString().padStart(24, '0').slice(0, 2)
  return `${whole.toLocaleString('en-US')}.${decimals} NEAR`
}

function orderStatus(value: string): TransactionStatus {
  switch (value) {
    case 'escrow_locked': return 'Escrow locked'
    case 'work_submitted': return 'Work submitted'
    case 'under_review': return 'Under review'
    case 'appeal_window': return 'Appeal window'
    case 'appealed': return 'Appealed'
    case 'released': return 'Released'
    case 'slashed': return 'Slashed'
    case 'refunded': return 'Refunded'
    default: return 'Escrow locked'
  }
}

function mapRemoteDashboard(remote: RemoteDashboard): DashboardData {
  const providerByAccount = new Map(remote.providers.map((provider) => [provider.accountId, provider]))
  const providerById = new Map(remote.providers.map((provider) => [provider.id, provider]))
  const offerById = new Map(remote.offers.map((offer) => [offer.id, offer]))
  const verdictByOrder = new Map(remote.verdicts.map((verdict) => [verdict.orderId, verdict]))
  const providers: Provider[] = remote.offers.filter((offer) => {
    const provider = providerById.get(offer.providerId)
    return Boolean(provider) && provider?.status === 'active'
  }).map((offer) => {
    const provider = providerById.get(offer.providerId)!
    const dishonestDemo = provider.persona === 'dishonest-demo'
    return {
      id: offer.id,
      name: provider.displayName,
      label: dishonestDemo ? 'Dishonest' : 'Demo listing',
      description: `${offer.title}. ${offer.sla}`,
      reputation: provider.reputation,
      completed: 0,
      bond: formatYocto(provider.bondYocto),
      maxOrder: formatYocto(offer.maxContractYocto),
      sla: offer.sla,
      price: formatYocto(offer.priceYocto),
      priceYocto: offer.priceYocto,
      maxContractYocto: offer.maxContractYocto,
      criteria: offer.criteria,
      accent: dishonestDemo ? 'amber' : 'teal',
      source: 'demo',
      providerAccountId: provider.accountId,
    }
  })
  const transactions: Transaction[] = remote.orders.map((order) => {
    const offer = offerById.get(order.offerId)
    const verdict = verdictByOrder.get(order.id)
    const status = orderStatus(order.status)
    const chainTx = remote.transactions.find((transaction) => transaction.orderId === order.id)
    return {
      id: order.id,
      provider: providerByAccount.get(order.providerAccountId)?.displayName ?? order.providerAccountId,
      service: offer?.title ?? order.specification.slice(0, 70),
      amount: formatYocto(order.amountYocto),
      status,
      time: new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      hash: chainTx?.txHash ?? 'No on-chain transaction indexed',
      risk: status === 'Slashed' || (verdict && verdict.confidence < 80) ? 'High' : verdict ? 'Low' : 'Medium',
      confidence: verdict?.confidence ?? 0,
      detail: verdict?.reasons.join('; ') ?? order.specification,
    }
  })
  const guardianCases: GuardianCase[] = remote.orders.filter((order) => ['work_submitted', 'under_review', 'appeal_window', 'appealed'].includes(order.status)).map((order) => {
    const verdict = verdictByOrder.get(order.id)
    const confidence = verdict?.confidence ?? 0
    return {
      id: order.id,
      title: offerById.get(order.offerId)?.title ?? order.specification.slice(0, 70),
      provider: providerByAccount.get(order.providerAccountId)?.displayName ?? order.providerAccountId,
      providerAccountId: order.providerAccountId,
      appealUntil: order.appealUntil,
      amount: formatYocto(order.amountYocto),
      status: order.status === 'appealed' ? 'Escalated' : order.status === 'appeal_window' ? 'Approved' : 'Needs decision',
      confidence,
      threshold: confidence < 80 ? 'Below 80% confidence' : 'Human review required',
      evidence: verdict?.evidence.join('; ') ?? 'No deterministic verdict has been recorded.',
      age: new Date(order.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
      priority: confidence < 80 ? 'High' : 'Medium',
    }
  })
  const auditEvents: AuditEvent[] = remote.auditEvents.map((event) => ({
    id: event.id,
    time: new Date(event.createdAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
    actor: `${event.actorAccountId} · ${event.actorRole}`,
    action: event.eventType.replaceAll('_', ' '),
    subject: event.orderId ?? 'Workspace',
    result: event.summary,
    hash: event.txHash ?? '—',
    tone: event.eventType.includes('slash') ? 'danger' : event.eventType.includes('verdict') ? 'warning' : event.txHash ? 'success' : 'neutral',
  }))
  const bondTotal = remote.providers.reduce((sum, provider) => sum + BigInt(provider.bondYocto), 0n)
  const openOrders = remote.orders.filter((order) => ['awaiting_escrow', 'escrow_locked', 'work_submitted', 'under_review', 'appeal_window', 'appealed'].includes(order.status))
  const escrowTotal = openOrders.reduce((sum, order) => sum + BigInt(order.amountYocto), 0n)
  const settled = remote.orders.filter((order) => ['released', 'slashed', 'refunded'].includes(order.status)).length
  const released = remote.orders.filter((order) => order.status === 'released').length
  return {
    network: 'NEAR Testnet',
    contract: remote.summary.contractId ?? 'Not configured',
    wallet: 'Not connected',
    providers,
    transactions,
    guardianCases,
    auditEvents,
    metrics: {
      totalBond: formatYocto(bondTotal.toString()),
      lockedEscrow: formatYocto(escrowTotal.toString()),
      activeCases: guardianCases.length,
      settlementRate: settled ? `${Math.round(released / settled * 100)}%` : '—',
    },
  }
}

export async function loadDashboard(signal?: AbortSignal): Promise<{ data: DashboardData; source: DataSource }> {
  try {
    const response = await fetch('/api/dashboard', { signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`API responded ${response.status}`)
    const remote = await response.json() as RemoteDashboard
    return { data: mapRemoteDashboard(remote), source: 'database-demo' }
  } catch {
    await new Promise((resolve) => window.setTimeout(resolve, 420))
    return { data: demoData, source: 'demo-offline' }
  }
}

export async function postAction(action: string, payload: Record<string, unknown> = {}): Promise<{ ok: boolean; simulated: boolean; message: string }> {
  try {
    const response = await fetch(`/api/actions/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })
    if (response.ok) return { ok: true, simulated: false, message: 'Action accepted by the connected API.' }
  } catch {
    // The deterministic demo path is intentional when no same-origin API is connected.
  }
  return { ok: true, simulated: true, message: 'Demo action recorded locally. No wallet transaction was created.' }
}

export async function postTransition(
  orderId: string,
  action: 'guardian_approve' | 'governance_approve' | 'provider_appeal' | 'governance_resolve_appeal' | 'finalize_slash',
  actorAccountId: string,
  reason: string,
  upholdSlash?: boolean,
): Promise<{ ok: boolean; status?: string; message: string }> {
  try {
    const response = await fetch(`/api/orders/${encodeURIComponent(orderId)}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action, actorAccountId, reason, ...(upholdSlash === undefined ? {} : { upholdSlash }) }),
    })
    const payload = await response.json().catch(() => ({})) as { status?: string; error?: string }
    if (!response.ok) return { ok: false, message: payload.error ?? `Transition rejected (${response.status}).` }
    return { ok: true, status: payload.status, message: `Transition recorded: ${payload.status ?? action}. No funds moved until the matching wallet transaction is confirmed.` }
  } catch {
    return { ok: false, message: 'The transition API is unavailable; no state was changed.' }
  }
}

export function getDemoData(): DashboardData {
  return demoData
}
