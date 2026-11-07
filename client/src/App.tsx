import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeCheck, Bell, BookOpen, Check, ChevronDown, ChevronRight,
  CircleAlert, ClipboardCheck, Clock3, Coins, Download, ExternalLink, FileCheck2, Filter, Gavel, Globe2,
  HelpCircle, LayoutDashboard, LockKeyhole, Menu, MoreHorizontal, Network, PanelLeftClose, RefreshCw,
  Scale, Search, ShieldCheck, Sparkles, SquareArrowOutUpRight, Tag, Users, WalletCards, X, XCircle,
} from 'lucide-react'
import { getDemoData, loadDashboard, postAction, postTransition, type AuditEvent, type DashboardData, type DataSource, type GuardianCase, type Provider, type Transaction } from './lib/api'
import { callBilBondContract, checkTestnetRpc, connectTestnetWallet, detectWallets, disconnectTestnetWallet, subscribeToTestnetWallet, type ContractMethod, type DetectedWallet } from './lib/nearWallet'
import { buildLiveDashboard, formatYoctoNear, loadTestnetContractSnapshot, parseNearToYocto, type TestnetContractSnapshot } from './lib/testnet-contract'
import { canGuardianDecide, getGuardianAuthorization, guardianAuthorizationMessage } from './lib/guardian-authorization'
import { getConfiguredContractId } from '../../shared/network'

type View = 'overview' | 'marketplace' | 'transactions' | 'guardian' | 'audit'
type Role = 'Buyer' | 'Provider' | 'Auditor' | 'Guardian' | 'Governance' | 'External auditor'

type IconProps = { size?: number; strokeWidth?: number }
const iconFor: Record<View, (props: IconProps) => ReactNode> = {
  overview: (props) => <LayoutDashboard {...props} />,
  marketplace: (props) => <Sparkles {...props} />,
  transactions: (props) => <ArrowDownRight {...props} />,
  guardian: (props) => <ShieldCheck {...props} />,
  audit: (props) => <BookOpen {...props} />,
}

function App() {
  const [view, setView] = useState<View>('overview')
  const [data, setData] = useState<DashboardData>(getDemoData())
  const [source, setSource] = useState<DataSource>('demo-offline')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selectedOffer, setSelectedOffer] = useState<Provider | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const [role, setRole] = useState<Role>('Buyer')
  const [mobileNav, setMobileNav] = useState(false)
  const [notice, setNotice] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [walletBusy, setWalletBusy] = useState(false)
  const [walletAccountId, setWalletAccountId] = useState<string | null>(null)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const [detectedWallets, setDetectedWallets] = useState<DetectedWallet[]>([])
  const [rpcStatus, setRpcStatus] = useState<'checking' | 'reachable' | 'unavailable'>('checking')
  const [contractStatus, setContractStatus] = useState<'not-configured' | 'invalid' | 'loading' | 'connected' | 'unavailable'>('not-configured')
  const [contractError, setContractError] = useState('')
  const [contractConfig] = useState(() => {
    try { return { id: getConfiguredContractId(), error: '' } }
    catch (error) { return { id: null, error: error instanceof Error ? error.message : 'Invalid Testnet contract configuration.' } }
  })
  const [testnetSnapshot, setTestnetSnapshot] = useState<TestnetContractSnapshot | null>(null)
  const [refreshRevision, setRefreshRevision] = useState(0)
  const [orderSpec, setOrderSpec] = useState('Deliver the research brief with at least three verifiable sources and cited figures.')
  const snapshotRef = useRef<TestnetContractSnapshot | null>(null)
  const walletAccountRef = useRef<string | null>(null)
  const contractId = contractConfig.id
  const guardianAuthorization = getGuardianAuthorization(walletAccountId, testnetSnapshot?.roles.guardian_id)
  const canDecideOnTestnet = canGuardianDecide(source, contractStatus === 'connected', walletAccountId, testnetSnapshot?.roles.guardian_id)

  const refresh = () => { setLoading(true); setRefreshRevision((revision) => revision + 1) }

  useEffect(() => {
    const controller = new AbortController()
    loadDashboard(controller.signal)
      .then((result) => {
        const currentSnapshot = snapshotRef.current
        if (currentSnapshot) {
          setData(buildLiveDashboard(currentSnapshot, walletAccountRef.current, result.data))
          setSource('testnet')
        } else {
          setData(result.data)
          setSource(result.source)
        }
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError(true) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [refreshRevision])

  useEffect(() => {
    const controller = new AbortController()
    let disposed = false
    let unsubscribe: (() => void) | undefined
    checkTestnetRpc(controller.signal).then((reachable) => {
      if (!disposed) setRpcStatus(reachable ? 'reachable' : 'unavailable')
    })
    subscribeToTestnetWallet((snapshot) => {
      walletAccountRef.current = snapshot.accountId
      setWalletAccountId(snapshot.accountId)
    }).then((stop) => { if (disposed) stop(); else unsubscribe = stop })
      .catch(() => { if (!disposed) setWalletAccountId(null) })
    return () => { disposed = true; controller.abort(); unsubscribe?.() }
  }, [])

  useEffect(() => {
    if (contractConfig.error) {
      setContractStatus('invalid')
      setContractError(contractConfig.error)
      return
    }
    if (!contractId) {
      setContractStatus('not-configured')
      setTestnetSnapshot(null)
      snapshotRef.current = null
      return
    }
    const controller = new AbortController()
    setContractStatus('loading')
    setContractError('')
    loadTestnetContractSnapshot(contractId, controller.signal)
      .then((snapshot) => {
        snapshotRef.current = snapshot
        setTestnetSnapshot(snapshot)
        setContractStatus('connected')
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        snapshotRef.current = null
        setTestnetSnapshot(null)
        setContractStatus('unavailable')
        setContractError(error instanceof Error ? error.message : 'The Testnet contract could not be read.')
      })
    return () => controller.abort()
  }, [contractId, contractConfig.error, refreshRevision])

  useEffect(() => {
    walletAccountRef.current = walletAccountId
    if (testnetSnapshot) {
      snapshotRef.current = testnetSnapshot
      setData((current) => buildLiveDashboard(testnetSnapshot, walletAccountId, current))
      setSource('testnet')
    }
  }, [testnetSnapshot, walletAccountId])

  useEffect(() => { if (notice) { const timer = window.setTimeout(() => setNotice(''), 3600); return () => window.clearTimeout(timer) } }, [notice])

  const executeContractCall = async (method: ContractMethod, args: Record<string, unknown> = {}, depositYocto = '0', orderId?: string) => {
    if (contractStatus !== 'connected') { setNotice('A readable NEAR Testnet contract is required before signing.'); return }
    setActionBusy(true)
    try {
      const result = await callBilBondContract(method, args, depositYocto, orderId)
      if (result.txHash) {
        setNotice(`Testnet transaction: ${result.txHash}${result.indexed ? ' · audit index updated' : ' · contract state will refresh; database index unavailable'}`)
        setRefreshRevision((revision) => revision + 1)
      } else {
        setNotice('The wallet opened. Review and sign the Testnet transaction there; verify wallet activity before retrying.')
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The wallet transaction could not be completed.')
    } finally {
      setActionBusy(false)
    }
  }

  const runAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (action === 'sync') { refresh(); setNotice('Refreshing database snapshot and NEAR Testnet contract state.'); return }
    if (action === 'approve-review') {
      const id = String(payload.id ?? '')
      if (!id) { setNotice('A valid order is required before recording a Guardian decision.'); return }
      if (/^\d+$/.test(id)) {
        if (!canDecideOnTestnet) {
          setNotice(guardianAuthorizationMessage(guardianAuthorization))
          return
        }
        await executeContractCall('guardian_decide', { id: Number(id), approve: true }, '0', id)
        return
      }
      setActionBusy(true)
      const result = await postTransition(id, 'guardian_approve', walletAccountId ?? 'guardian.demo', 'Guardian reviewed the deterministic evidence and approved the policy path.')
      setActionBusy(false)
      setNotice(result.message)
      if (result.ok) refresh()
      return
    }
    if (action === 'provider-appeal') {
      const id = String(payload.id ?? '')
      setActionBusy(true)
      const result = await postTransition(id, 'provider_appeal', walletAccountId ?? String(payload.providerAccountId ?? ''), String(payload.reason ?? 'Provider submitted an appeal with additional context.'))
      setActionBusy(false)
      setNotice(result.message)
      if (result.ok) refresh()
      return
    }
    if (action === 'lock-escrow') {
      if (source !== 'testnet' || selectedOffer?.source !== 'testnet' || selectedOffer.onChainOfferId === undefined || !selectedOffer.priceYocto) {
        setNotice('This is a demo offer. No Testnet transaction was created. Select an offer registered on the configured contract to lock escrow.')
        return
      }
      if (orderSpec.trim().length < 20) { setNotice('Add a specific order description of at least 20 characters before locking escrow.'); return }
      await executeContractCall('lock_escrow', { offer_id: selectedOffer.onChainOfferId, specification: orderSpec.trim() }, selectedOffer.priceYocto)
      return
    }
    if (action === 'reject-review') {
      const orderId = String(payload.id ?? '').replace(/^ORD-/, '')
      if (!/^\d+$/.test(orderId)) { setNotice('This review case is a demo scenario, not a live Testnet order.'); return }
      if (!canDecideOnTestnet) {
        setNotice(guardianAuthorizationMessage(guardianAuthorization))
        return
      }
      await executeContractCall('guardian_decide', {
        id: Number(orderId),
        approve: false,
      }, '0', orderId)
      return
    }
    setActionBusy(true)
    const result = await postAction(action, payload)
    setActionBusy(false)
    setNotice(result.message)
  }

  const toggleWallet = async () => {
    if (walletAccountId) {
      setWalletBusy(true)
      try { await disconnectTestnetWallet() }
      catch (error) { setNotice(error instanceof Error ? error.message : 'The Testnet wallet could not be disconnected.') }
      finally { setWalletBusy(false) }
      return
    }
    setWalletBusy(true)
    try {
      const wallets = await detectWallets()
      setDetectedWallets(wallets)
      setWalletModalOpen(true)
      if (wallets.length === 0) setNotice('No supported wallet extension detected. Please open this app in Chrome or Brave with Meteor or Nightly enabled.')
    }
    catch (error) { setNotice(error instanceof Error ? error.message : 'The Testnet wallet could not be opened.') }
    finally { setWalletBusy(false) }
  }

  const selectWallet = async (provider: DetectedWallet) => {
    setWalletBusy(true)
    try {
      await connectTestnetWallet(provider)
      setWalletModalOpen(false)
    } catch (error) {
      console.error('[wallet] connect failed', {
        provider,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
      })
      setNotice(error instanceof Error ? error.message : 'The wallet extension could not open the Testnet connection request.')
    } finally { setWalletBusy(false) }
  }

  const checkWalletsAgain = async () => {
    setWalletBusy(true)
    const wallets = await detectWallets(500)
    setDetectedWallets(wallets)
    if (wallets.length === 0) setNotice('No supported wallet extension detected. Please open this app in Chrome or Brave with Meteor or Nightly enabled.')
    setWalletBusy(false)
  }

  const currentProvider = testnetSnapshot?.providers.find((provider) => provider.account_id === walletAccountId) ?? null

  const navigate = (next: View) => { setView(next); setMobileNav(false); setSelectedTransaction(null) }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true"><span /><span /><b /></div>
          <div><div className="brand-name">Bil Bond</div><div className="brand-tagline">Agent accountability</div></div>
          <button className="icon-button mobile-close" onClick={() => setMobileNav(false)} aria-label="Close navigation"><PanelLeftClose size={18} /></button>
        </div>
        <div className="side-section-label">Operations</div>
        <nav className="primary-nav" aria-label="Primary navigation">
          {(['overview', 'marketplace', 'transactions', 'guardian', 'audit'] as View[]).map((item) => (
            <button key={item} className={`nav-item ${view === item ? 'active' : ''}`} onClick={() => navigate(item)}>
              {iconFor[item]({ size: 17, strokeWidth: 1.8 })}<span>{item === 'guardian' ? 'Guardian queue' : item === 'audit' ? 'Audit log' : item[0].toUpperCase() + item.slice(1)}</span>
              {item === 'guardian' && <span className="nav-count">{data.guardianCases.length}</span>}
            </button>
          ))}
        </nav>
        <div className="side-spacer" />
        <div className="network-card">
          <div className="network-card-title"><span className="live-dot" /> Network</div>
          <strong>NEAR Testnet</strong>
          <span className="mono">{contractId ?? 'Contract not configured'}</span>
          <div className="network-rule" />
          <div className="network-mini"><span>RPC status</span><b>{rpcStatus === 'reachable' ? 'Reachable' : rpcStatus === 'checking' ? 'Checking' : 'Unavailable'}</b></div>
          <div className="network-mini"><span>Contract</span><b>{contractStatus === 'connected' ? 'Readable' : contractStatus === 'loading' ? 'Checking' : contractStatus === 'invalid' ? 'Invalid config' : contractStatus === 'unavailable' ? 'Unavailable' : 'Not set'}</b></div>
          <div className="network-mini"><span>Intents</span><b className="amber-text">Simulated</b></div>
        </div>
        <div className="sidebar-footer"><span className="brand-mark small" aria-hidden="true"><span /><span /><b /></span><span>Control room v0.1</span></div>
      </aside>

      <main className="main-canvas">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu size={19} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><strong>{view === 'guardian' ? 'Guardian queue' : view[0].toUpperCase() + view.slice(1)}</strong></div>
          <div className="topbar-actions">
            <div className="role-switcher"><span className="role-label">Role view</span><select value={role} disabled={source === 'testnet'} onChange={(event) => { setRole(event.target.value as Role); setNotice('Role view changed only. On-chain actions still require the matching user-controlled Testnet wallet; no agent keys are stored.') }} aria-label="Demo role"><option>Buyer</option><option>Provider</option><option>Auditor</option><option>Guardian</option><option>Governance</option><option>External auditor</option></select><ChevronDown size={14} /></div>
            <button className="wallet-chip" onClick={toggleWallet} disabled={walletBusy}><WalletCards size={15} /><span><small>{walletAccountId ? 'Testnet account' : 'Testnet wallet'}</small><b>{walletBusy ? 'Opening wallet…' : walletAccountId ?? 'Connect wallet'}</b></span></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={18} /><span /></button>
            <div className="avatar" aria-label={`Current view: ${role}`}>{role.split(' ').map((part) => part[0]).join('')}</div>
          </div>
        </header>

        {walletModalOpen && <div className="wallet-connect-backdrop" role="presentation" onClick={() => setWalletModalOpen(false)}>
          <section className="wallet-connect-dialog" role="dialog" aria-modal="true" aria-labelledby="wallet-connect-title" onClick={(event) => event.stopPropagation()}>
            <div className="wallet-connect-header"><div><div className="eyebrow">Testnet wallet</div><h2 id="wallet-connect-title">Connect your wallet</h2></div><button className="icon-button" onClick={() => setWalletModalOpen(false)} aria-label="Close wallet dialog"><X size={18} /></button></div>
            <p className="wallet-connect-copy">Only wallet extensions detected in this browser are shown. Select one to open its Testnet approval popup.</p>
            <div className="wallet-provider-list">
              {detectedWallets.map((provider) => <button key={provider} className="wallet-provider-card" onClick={() => selectWallet(provider)} disabled={walletBusy}><WalletCards size={22} /><span><strong>{provider === 'meteor-wallet' ? 'Meteor Wallet' : 'Nightly'}</strong><small>Detected extension · NEAR Testnet</small></span><ChevronRight size={18} /></button>)}
            </div>
            {detectedWallets.length === 0 && <div className="wallet-empty"><CircleAlert size={18} /><span>No supported wallet extension detected. Enable Meteor or Nightly for this localhost origin.</span></div>}
            <div className="wallet-connect-footer"><button className="secondary-button" onClick={checkWalletsAgain} disabled={walletBusy}><RefreshCw size={15} /> Check again</button><span>NEAR Testnet only</span></div>
          </section>
        </div>}

        <div className="testnet-notice"><div className="notice-icon"><Network size={16} /></div><div><b>Testnet boundary</b><span>NEAR Intents is <strong>SIMULATED / unavailable on Testnet</strong>. Bond and escrow values here are public on-chain.</span></div><button className="notice-link" onClick={() => setNotice('No Intents transaction can be created in this Testnet demo.')}>Why this matters <HelpCircle size={14} /></button></div>
        {notice && <div className="toast" role="status"><Check size={15} />{notice}</div>}

        <div className="content-wrap">
          {loadError && <div className="error-banner"><CircleAlert size={16} /><span>We could not refresh the workspace. Showing the clearly labelled demo snapshot.</span><button onClick={refresh}><RefreshCw size={14} /> Retry</button></div>}
          {contractError && <div className="error-banner"><CircleAlert size={16} /><span>Testnet contract status: {contractError}</span><button onClick={refresh}><RefreshCw size={14} /> Retry</button></div>}
          {loading ? <LoadingState /> : <>
            {view === 'overview' && <Overview data={data} source={source} navigate={navigate} runAction={runAction} actionBusy={actionBusy} />}
            {view === 'marketplace' && <Marketplace data={data} source={source} selectedOffer={selectedOffer} setSelectedOffer={setSelectedOffer} runAction={runAction} executeContractCall={executeContractCall} actionBusy={actionBusy} contractReady={contractStatus === 'connected'} walletAccountId={walletAccountId} currentProvider={currentProvider} roles={testnetSnapshot?.roles ?? null} orderSpec={orderSpec} setOrderSpec={setOrderSpec} />}
            {view === 'transactions' && <Transactions data={data} selected={selectedTransaction} setSelected={setSelectedTransaction} />}
            {view === 'guardian' && <GuardianQueue data={data} source={source} contractReady={contractStatus === 'connected'} walletAccountId={walletAccountId} guardianId={testnetSnapshot?.roles.guardian_id ?? null} guardianAuthorization={guardianAuthorization} runAction={runAction} actionBusy={actionBusy} />}
            {view === 'audit' && <AuditLog data={data} setNotice={setNotice} />}
          </>}
        </div>
      </main>
    </div>
  )
}

function LoadingState() { return <div className="loading-state"><div className="loading-spinner" /><strong>Loading operations snapshot</strong><span>Reading the configured Testnet contract and optional database, then loading a labelled demo fallback…</span></div> }

function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) { return <div className="page-title-row"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1></div>{children && <div className="title-actions">{children}</div>}</div> }
function StatusPill({ children, tone = 'neutral', dot = true }: { children: ReactNode; tone?: 'success' | 'warning' | 'danger' | 'neutral' | 'info'; dot?: boolean }) { return <span className={`status-pill ${tone}`}>{dot && <i />}{children}</span> }
function MetricCard({ label, value, caption, icon, trend, tone = 'teal' }: { label: string; value: string; caption: string; icon: ReactNode; trend?: string; tone?: string }) { return <div className="metric-card"><div className={`metric-icon ${tone}`}>{icon}</div><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-caption">{caption}{trend && <span className="metric-trend"><ArrowUpRight size={12} /> {trend}</span>}</div></div> }
function EmptyState({ title, body }: { title: string; body: string }) { return <div className="empty-state"><ClipboardCheck size={21} /><strong>{title}</strong><span>{body}</span></div> }

function Overview({ data, source, navigate, runAction, actionBusy }: { data: DashboardData; source: DataSource; navigate: (view: View) => void; runAction: (action: string, payload?: Record<string, unknown>) => Promise<void>; actionBusy: boolean }) {
  const live = source === 'testnet'
  const latestOrder = data.transactions[0]
  const lowRiskCount = data.transactions.filter((transaction) => transaction.risk === 'Low').length
  const highRiskCount = data.transactions.filter((transaction) => transaction.risk === 'High').length
  return <>
    <PageTitle eyebrow="Operations overview" title="Trust, at a glance"><div className="source-label"><span className="live-dot" /> {live ? 'Live Testnet contract' : source === 'database-demo' ? 'Persistent demo records' : 'Offline demo snapshot'}</div><button className="button secondary" onClick={() => navigate('marketplace')}><Sparkles size={15} /> Browse offers</button></PageTitle>
    <div className="welcome-strip"><div><span className="section-kicker">Good morning, Operator</span><h2>Make agent work accountable.</h2><p>Bil Bond keeps every offer, decision, and settlement traceable without pretending Testnet is private.</p></div><div className="welcome-trace"><div className="trace-node done"><Check size={12} /></div><span /><div className="trace-node done"><Check size={12} /></div><span /><div className="trace-node current"><ShieldCheck size={14} /></div><div className="trace-label"><b>{data.guardianCases.length} reviews</b><small>need a human decision</small></div></div></div>
    <div className="metric-grid"><MetricCard label="Bond under watch" value={live ? data.metrics.totalBond : 'Demo only'} caption={live ? `Across ${data.providers.length} active offers` : 'No live contract balance loaded'} icon={<Coins size={17} />} /><MetricCard label="Locked escrow" value={live ? data.metrics.lockedEscrow : 'Not on-chain'} caption={live ? `${data.transactions.length} contract orders loaded` : 'Demo scenarios do not lock funds'} icon={<LockKeyhole size={17} />} tone="blue" /><MetricCard label="Open decisions" value={String(data.metrics.activeCases).padStart(2, '0')} caption={live ? 'Read from contract order state' : 'Demo review scenarios'} icon={<Gavel size={17} />} tone="amber" /><MetricCard label="Settlement rate" value={live ? data.metrics.settlementRate : 'Demo only'} caption={live ? 'Computed from loaded Testnet orders' : 'Not a measured production metric'} icon={<Activity size={17} />} tone="purple" /></div>
    <div className="overview-grid"><section className="panel activity-panel"><div className="panel-header"><div><div className="eyebrow">{live ? 'On-chain trace' : 'Demo trace'}</div><h3>Decision pipeline</h3></div><button className="text-button" onClick={() => navigate('audit')}>View audit log <ChevronRight size={14} /></button></div><div className="pipeline"><PipelineStep icon={<Tag size={16} />} title="Offer matched" meta={latestOrder ? `${latestOrder.provider} · ${latestOrder.amount}` : `${data.providers.length} active offers loaded`} status={data.providers.length ? 'Available' : 'Waiting'} tone={data.providers.length ? 'success' : 'warning'} /><PipelineStep icon={<LockKeyhole size={16} />} title="Escrow state" meta={latestOrder ? `${latestOrder.id} · ${latestOrder.status}` : 'No order on this contract'} status={latestOrder?.status ?? 'No order'} tone={latestOrder ? statusTone(latestOrder.status) : 'neutral'} /><PipelineStep icon={<FileCheck2 size={16} />} title="Auditor verdict" meta={latestOrder?.confidence ? `${latestOrder.confidence}% confidence` : 'No verdict recorded'} status={latestOrder?.confidence ? 'Recorded' : 'Waiting'} tone={latestOrder?.risk === 'High' ? 'danger' : 'warning'} /><PipelineStep icon={<ShieldCheck size={16} />} title="Guardian decision" meta={data.guardianCases.length ? `${data.guardianCases.length} case(s) need review` : 'No pending review cases'} status={data.guardianCases.length ? 'Review' : 'Clear'} tone={data.guardianCases.length ? 'warning' : 'success'} last /></div><div className="pipeline-foot"><span><span className="live-dot" /> {live ? 'State read from NEAR Testnet' : 'Simulation; no Testnet state implied'}</span><span className="mono">{latestOrder?.id ?? 'No order'}</span></div></section><section className="panel risk-panel"><div className="panel-header"><div><div className="eyebrow">Control signal</div><h3>Risk posture</h3></div><StatusPill tone={data.guardianCases.length ? 'warning' : 'success'}>{data.guardianCases.length ? 'Review needed' : 'No open review'}</StatusPill></div><div className="risk-score"><div className="risk-ring"><strong>{data.guardianCases.length}</strong><span>open</span></div><div><b>{live ? 'Contract review queue' : 'Demo review queue'}</b><p>{live ? 'The contract holds settlement until its approval and appeal rules are satisfied.' : 'These are deterministic demo cases only; they do not represent Testnet funds or contract decisions.'}</p></div></div><div className="risk-list"><div><span className="risk-key teal-key" />Low risk <b>{lowRiskCount}</b></div><div><span className="risk-key amber-key" />Review <b>{data.guardianCases.length}</b></div><div><span className="risk-key red-key" />High risk <b>{highRiskCount}</b></div></div><button className="button dark full" onClick={() => navigate('guardian')}>Open guardian queue <ArrowUpRight size={15} /></button></section></div>
    <div className="section-heading"><div><div className="eyebrow">Recent activity</div><h2>What changed</h2></div><button className="text-button" onClick={() => navigate('transactions')}>All transactions <ChevronRight size={14} /></button></div>
    <div className="recent-table"><div className="table-head"><span>Transaction</span><span>Provider</span><span>Amount</span><span>Status</span><span>Updated</span><span /></div>{data.transactions.slice(0, 3).map((tx) => <TransactionRow key={tx.id} tx={tx} onClick={() => navigate('transactions')} />)}</div>
    <div className="action-row"><div><div className="eyebrow">Workspace controls</div><h3>Refresh the accountability path</h3><p>Refresh reads the configured Testnet contract and optional database. Demo actions never create chain transactions.</p></div><button className="button secondary" disabled={actionBusy} onClick={() => runAction('sync', { source: 'overview' })}><RefreshCw size={15} /> {actionBusy ? 'Working…' : 'Refresh snapshot'}</button></div>
  </>
}

function PipelineStep({ icon, title, meta, status, tone, last }: { icon: ReactNode; title: string; meta: string; status: string; tone: string; last?: boolean }) { return <div className={`pipeline-step ${last ? 'last' : ''}`}><div className={`pipeline-icon ${tone}`}>{icon}</div><div className="pipeline-copy"><b>{title}</b><span>{meta}</span></div><StatusPill tone={tone === 'danger' ? 'danger' : tone === 'warning' ? 'warning' : 'success'}>{status}</StatusPill></div> }

function providerTone(provider: Provider): 'success' | 'warning' | 'info' | 'neutral' {
  if (provider.label === 'Honest') return 'success'
  if (provider.label === 'Live Testnet') return 'info'
  if (provider.label === 'Demo listing') return 'neutral'
  return 'warning'
}

function Marketplace({ data, source, selectedOffer, setSelectedOffer, runAction, executeContractCall, actionBusy, contractReady, walletAccountId, currentProvider, roles, orderSpec, setOrderSpec }: {
  data: DashboardData
  source: DataSource
  selectedOffer: Provider | null
  setSelectedOffer: (provider: Provider | null) => void
  runAction: (action: string, payload?: Record<string, unknown>) => Promise<void>
  executeContractCall: (method: ContractMethod, args?: Record<string, unknown>, depositYocto?: string, orderId?: string) => Promise<void>
  actionBusy: boolean
  contractReady: boolean
  walletAccountId: string | null
  currentProvider: TestnetContractSnapshot['providers'][number] | null
  roles: TestnetContractSnapshot['roles'] | null
  orderSpec: string
  setOrderSpec: (value: string) => void
}) {
  const live = source === 'testnet'
  const auditorConfigured = Boolean(roles?.auditor_id)
  const liveProviders = live ? data.providers.filter((provider) => provider.source === 'testnet') : []
  const demoProviders = getDemoData().providers
  return <>
    <PageTitle eyebrow="Provider marketplace" title="Choose who earns trust"><div className="public-label"><Globe2 size={14} /> {live ? 'Public Testnet ledger' : 'Demo listings · no funds locked'}</div><button className="button secondary" onClick={() => runAction('sync')}><RefreshCw size={15} /> Refresh</button></PageTitle>
    <div className="marketplace-intro"><div><p>{live ? 'Offers are read from the configured contract. Bond, price, and counterparty facts are public on Testnet.' : 'The local offers are a deterministic presentation scenario, not provider registrations on Testnet.'}</p><span className="mono">SOURCE / {live ? 'NEAR TESTNET CONTRACT' : source.toUpperCase()}</span>{live && <><span>{' '}</span><span className="mono">CONTRACT / {data.contract}</span></>}</div><div className="offer-legend"><span><i className="legend-dot teal" />On-chain history</span><span><i className="legend-dot amber" />Demo scenario</span></div></div>
    {live ? <>
      <section className="marketplace-section">
        <div className="section-heading"><div><div className="eyebrow">Live Testnet offers</div><h2>Offers from the configured contract</h2></div><StatusPill tone="info">On-chain · public</StatusPill></div>
        {liveProviders.length ? <div className="offer-grid">{liveProviders.map((provider) => <OfferCard key={`live-${provider.id}`} provider={provider} selected={selectedOffer?.id === provider.id} onSelect={() => setSelectedOffer(provider)} />)}</div> : <EmptyState title="No active Testnet offers" body="Register a provider, deposit its bond, and publish the first offer below." />}
      </section>
      <section className="marketplace-section demo-section">
        <div className="section-heading"><div><div className="eyebrow">Demo scenarios</div><h2>Agent A and Agent B</h2></div><StatusPill tone="warning">Demo · no funds locked</StatusPill></div>
        <p className="section-note">These deterministic presentation scenarios are not provider registrations on Testnet. Selecting one never creates a blockchain transaction.</p>
        <div className="offer-grid">{demoProviders.map((provider) => <OfferCard key={`demo-${provider.id}`} provider={{ ...provider, source: 'demo' }} selected={selectedOffer?.id === provider.id} onSelect={() => setSelectedOffer({ ...provider, source: 'demo' })} />)}</div>
      </section>
    </> : data.providers.length ? <div className="offer-grid">{data.providers.map((provider) => <OfferCard key={provider.id} provider={provider} selected={selectedOffer?.id === provider.id} onSelect={() => setSelectedOffer(provider)} />)}</div> : <EmptyState title="No demo listings" body="Refresh the workspace or check the configured database seed." />}
    <div className="marketplace-lower">
      <section className="panel comparison-panel"><div className="panel-header"><div><div className="eyebrow">Decision guide</div><h3>What the bond actually tells you</h3></div><ShieldCheck size={20} className="teal-text" /></div><div className="guide-row"><div className="guide-icon"><BadgeCheck size={17} /></div><div><b>Bond is a commitment signal</b><p>It is held by the Testnet contract and can be slashed only after deterministic evidence and required approvals.</p></div></div><div className="guide-row"><div className="guide-icon amber"><CircleAlert size={17} /></div><div><b>Public means public</b><p>Amounts and contract events are visible on-chain. Demo role switching is not encryption or production authorization.</p></div></div></section>
      <section className="panel order-panel"><div className="panel-header"><div><div className="eyebrow">Selected offer</div><h3>{selectedOffer ? selectedOffer.name : 'No offer selected'}</h3></div>{selectedOffer && <StatusPill tone={providerTone(selectedOffer)}>{selectedOffer.label}</StatusPill>}</div>{selectedOffer ? <><div className="selected-amount"><span>Escrow amount</span><b>{selectedOffer.price}</b></div><label className="field-label" htmlFor="order-specification">Order specification</label><textarea id="order-specification" value={orderSpec} onChange={(event) => setOrderSpec(event.target.value)} rows={3} /><p className="muted">{selectedOffer.source === 'testnet' ? 'This creates a public Testnet escrow and requires your wallet signature. NEAR Intents remains simulated.' : 'Demo only: no Testnet transaction or escrow will be created.'}</p><button className="button primary full" disabled={actionBusy || (live && selectedOffer.source !== 'testnet')} onClick={() => runAction('lock-escrow', { providerId: selectedOffer.id, amount: selectedOffer.price })}><LockKeyhole size={15} /> {actionBusy ? 'Waiting for wallet…' : selectedOffer.source === 'testnet' ? 'Lock escrow on Testnet' : 'Preview demo request'}</button><small className="button-note">{selectedOffer.source === 'testnet' ? `${auditorConfigured ? 'Auditor is configured.' : 'An auditor must be configured before a live order can be created.'} Wallet signature required.` : 'Demo scenario · no funds or transaction'}</small></> : <EmptyState title="Select an offer" body="Choose an active offer from the configured Testnet contract or inspect the demo scenario." />}</section>
    </div>
    <ProviderConsole source={source} contractReady={contractReady} walletAccountId={walletAccountId} currentProvider={currentProvider} executeContractCall={executeContractCall} actionBusy={actionBusy} />
    <ContractRoleSetup source={source} contractReady={contractReady} walletAccountId={walletAccountId} roles={roles} executeContractCall={executeContractCall} actionBusy={actionBusy} />
  </>
}

function OfferCard({ provider, selected, onSelect }: { provider: Provider; selected: boolean; onSelect: () => void }) {
  const live = provider.source === 'testnet'
  return <button className={`offer-card ${selected ? 'selected' : ''} ${provider.accent}`} onClick={onSelect}>
    <div className="offer-card-top"><span className={`agent-avatar ${provider.accent}`}>{provider.name.slice(0, 2).toUpperCase()}</span><StatusPill tone={providerTone(provider)}>{provider.label}</StatusPill><MoreHorizontal size={17} className="muted-icon" /></div>
    <div className="offer-title"><div><h2>{provider.name}</h2><span className="mono">{live ? `OFFER #${provider.onChainOfferId} · PROVIDER / ${provider.providerAccountId}` : `DEMO / ${provider.id}`}</span></div><ChevronRight size={17} /></div>
    <p>{provider.description}</p>
    <div className="reputation-row"><div><span className="metric-label">Reputation</span><strong>{provider.reputation}<small>/100</small></strong></div><div className="reputation-track"><span style={{ width: `${provider.reputation}%` }} /></div><div className="completed"><b>{provider.completed}</b><span>completed</span></div></div>
    <div className="offer-specs"><div><span>Price</span><b>{provider.price}</b></div><div><span>SLA</span><b>{provider.sla}</b></div><div><span>Max order</span><b>{provider.maxOrder}</b></div></div>
    <div className="criteria"><span>Criteria</span>{provider.criteria.map((criterion) => <b key={criterion}><Check size={12} />{criterion}</b>)}</div>
    <div className="offer-footer"><span><Coins size={14} /> Bond {provider.bond} <i>{live ? 'public' : 'demo'}</i></span><span>{live ? 'On-chain offer' : 'Simulation'} <ChevronRight size={13} /></span></div>
  </button>
}

function ProviderConsole({ source, contractReady, walletAccountId, currentProvider, executeContractCall, actionBusy }: {
  source: DataSource
  contractReady: boolean
  walletAccountId: string | null
  currentProvider: TestnetContractSnapshot['providers'][number] | null
  executeContractCall: (method: ContractMethod, args?: Record<string, unknown>, depositYocto?: string, orderId?: string) => Promise<void>
  actionBusy: boolean
}) {
  const [bondAmount, setBondAmount] = useState('1')
  const [serviceType, setServiceType] = useState('RESEARCH_DELIVERY')
  const [price, setPrice] = useState('0.1')
  const [maxContract, setMaxContract] = useState('0.1')
  const [sla, setSla] = useState('Deliver within 10 minutes with source URLs for key claims.')
  const [criteria, setCriteria] = useState('Include at least three verifiable source URLs.\nCite a source and date for every figure.\nKeep the summary consistent with the cited sources.')
  const [formError, setFormError] = useState('')
  const ready = source === 'testnet' && contractReady && Boolean(walletAccountId)
  const reputation = currentProvider?.reputation ?? 0
  let requiredBond = 'Enter a valid maximum contract amount'
  try {
    const maxYocto = BigInt(parseNearToYocto(maxContract))
    const ratioBps = 10_000 - Math.floor((reputation * 7_500) / 100)
    requiredBond = formatYoctoNear((maxYocto * BigInt(ratioBps) / 10_000n).toString())
  } catch { /* Keep the validation hint until the maximum amount is valid. */ }

  const depositBond = async () => {
    try { setFormError(''); await executeContractCall('deposit_bond', {}, parseNearToYocto(bondAmount)) }
    catch (error) { setFormError(error instanceof Error ? error.message : 'Enter a valid bond amount.') }
  }
  const publishOffer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const criteriaList = criteria.split('\n').map((item) => item.trim()).filter(Boolean)
      if (!criteriaList.length) throw new Error('Add at least one verification criterion.')
      setFormError('')
      await executeContractCall('create_offer', {
        service_type: serviceType.trim(),
        price: parseNearToYocto(price),
        sla: sla.trim(),
        verification_criteria: JSON.stringify(criteriaList),
        max_contract_amount: parseNearToYocto(maxContract),
      })
    } catch (error) { setFormError(error instanceof Error ? error.message : 'The offer could not be prepared.') }
  }

  return <section className="panel provider-tools">
    <div className="panel-header"><div><div className="eyebrow">Provider onboarding</div><h3>Stake a bond and publish an offer</h3></div><StatusPill tone={ready ? 'success' : 'warning'}>{ready ? 'Testnet ready' : 'Wallet + contract required'}</StatusPill></div>
    <p className="muted">All deposits and offers below are public NEAR Testnet transactions. Minimum bond is calculated from the contract ratio: 100% at reputation 0, declining toward 25% at reputation 100.</p>
    {walletAccountId && <div className="contract-facts"><span>Connected provider</span><b className="mono">{walletAccountId}</b><span>Registration</span><b>{currentProvider ? `Registered · reputation ${currentProvider.reputation}/100` : 'Not registered'}</b><span>Current bond</span><b>{currentProvider ? formatYoctoNear(currentProvider.bond) : '0.00 NEAR'}</b></div>}
    {formError && <div className="inline-error" role="alert">{formError}</div>}
    <div className="provider-setup-grid"><div className="provider-actions"><button className="button secondary full" disabled={!ready || Boolean(currentProvider) || actionBusy} onClick={() => executeContractCall('register_provider')}><Users size={15} /> {currentProvider ? 'Provider registered' : 'Register this wallet as provider'}</button><label className="field-label" htmlFor="bond-deposit">Bond deposit (NEAR)</label><div className="inline-control"><input id="bond-deposit" inputMode="decimal" value={bondAmount} onChange={(event) => setBondAmount(event.target.value)} /><button className="button primary" disabled={!ready || !currentProvider || actionBusy} onClick={depositBond}>Deposit bond</button></div><small className="button-note">Provider registration is required before depositing.</small></div>
      <form className="provider-offer-form" onSubmit={publishOffer}><div className="offer-form-grid"><label>Service type<input value={serviceType} onChange={(event) => setServiceType(event.target.value)} maxLength={100} required /></label><label>Price (NEAR)<input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Maximum order (NEAR)<input inputMode="decimal" value={maxContract} onChange={(event) => setMaxContract(event.target.value)} required /></label><label>SLA<input value={sla} onChange={(event) => setSla(event.target.value)} maxLength={1000} required /></label></div><label>Verification criteria — one item per line<textarea value={criteria} onChange={(event) => setCriteria(event.target.value)} rows={3} required /></label><div className="offer-requirement"><span>Estimated minimum bond for this maximum</span><b>{requiredBond}</b></div><button className="button primary" type="submit" disabled={!ready || !currentProvider || actionBusy}><Tag size={15} /> Publish offer on Testnet</button></form></div>
    {!ready && <small className="button-note">Connect a .testnet wallet and configure a deployed, readable contract to enable these signed actions.</small>}
  </section>
}

function ContractRoleSetup({ source, contractReady, walletAccountId, roles, executeContractCall, actionBusy }: {
  source: DataSource
  contractReady: boolean
  walletAccountId: string | null
  roles: TestnetContractSnapshot['roles'] | null
  executeContractCall: (method: ContractMethod, args?: Record<string, unknown>, depositYocto?: string, orderId?: string) => Promise<void>
  actionBusy: boolean
}) {
  const [auditorId, setAuditorId] = useState('')
  const [guardianId, setGuardianId] = useState('')
  const [governanceId, setGovernanceId] = useState('')
  const [confidence, setConfidence] = useState('80')
  const [slashThreshold, setSlashThreshold] = useState('1')
  const [appealMinutes, setAppealMinutes] = useState('10')
  const [formError, setFormError] = useState('')
  useEffect(() => {
    if (!roles) return
    setConfidence(String(roles.low_confidence_threshold))
    setSlashThreshold(formatYoctoNear(roles.large_slash_threshold).replace(' NEAR', ''))
    setAppealMinutes(String(Math.max(1, Math.round(Number(BigInt(roles.appeal_window_ns) / 1_000_000_000n) / 60))))
  }, [roles])
  const owner = Boolean(walletAccountId && roles?.owner_id === walletAccountId)
  const ready = source === 'testnet' && contractReady && owner
  const setAccountRole = async (method: 'set_auditor' | 'set_guardian' | 'add_governance_signer', accountId: string) => {
    if (!/^[a-z0-9._-]+\.testnet$/i.test(accountId.trim())) { setFormError('Enter a valid .testnet account ID.'); return }
    setFormError('')
    await executeContractCall(method, { id: accountId.trim() })
  }
  const savePolicy = async () => {
    try {
      const confidenceValue = Number(confidence)
      const minutesValue = Number(appealMinutes)
      if (!Number.isInteger(confidenceValue) || confidenceValue < 0 || confidenceValue > 100) throw new Error('Confidence threshold must be an integer from 0 to 100.')
      if (!Number.isFinite(minutesValue) || minutesValue < 1 || minutesValue > 10_080) throw new Error('Appeal window must be between 1 minute and 7 days.')
      setFormError('')
      await executeContractCall('set_policy', { low_confidence_threshold: confidenceValue, large_slash_threshold: parseNearToYocto(slashThreshold), appeal_window_ns: Math.round(minutesValue * 60 * 1_000_000_000) })
    } catch (error) { setFormError(error instanceof Error ? error.message : 'Policy values are invalid.') }
  }
  return <section className="panel provider-tools">
    <div className="panel-header"><div><div className="eyebrow">Contract administration</div><h3>Configure roles and settlement policy</h3></div><StatusPill tone={owner ? 'success' : 'warning'}>{owner ? 'Owner wallet connected' : 'Owner signature required'}</StatusPill></div>
    <p className="muted">Role assignments are one-time owner-signed Testnet calls. Guardian, Auditor, and Governance are distinct accounts. Escalated cases require two of these three role approvals.</p>
    {roles && <div className="contract-facts"><span>Contract owner</span><b className="mono">{roles.owner_id}</b><span>Auditor</span><b className="mono">{roles.auditor_id ?? 'Not configured'}</b><span>Guardian</span><b className="mono">{roles.guardian_id ?? 'Not configured'}</b><span>Governance signers</span><b className="mono">{roles.governance_signers.join(', ') || 'None configured'}</b><span>Current policy</span><b>{roles.low_confidence_threshold}% confidence · {formatYoctoNear(roles.large_slash_threshold)} slash threshold</b></div>}
    {formError && <div className="inline-error" role="alert">{formError}</div>}
    <div className="role-setup-grid"><div className="role-assignment"><div className="inline-control"><input aria-label="Auditor Testnet account ID" placeholder="auditor.testnet" value={auditorId} onChange={(event) => setAuditorId(event.target.value)} /><button className="button secondary" disabled={!ready || !auditorId || Boolean(roles?.auditor_id) || actionBusy} onClick={() => setAccountRole('set_auditor', auditorId)}>Set auditor</button></div><div className="inline-control"><input aria-label="Guardian Testnet account ID" placeholder="guardian.testnet" value={guardianId} onChange={(event) => setGuardianId(event.target.value)} /><button className="button secondary" disabled={!ready || !guardianId || Boolean(roles?.guardian_id) || actionBusy} onClick={() => setAccountRole('set_guardian', guardianId)}>Set Guardian</button></div><div className="inline-control"><input aria-label="Governance signer Testnet account ID" placeholder="governance.testnet" value={governanceId} onChange={(event) => setGovernanceId(event.target.value)} /><button className="button secondary" disabled={!ready || !governanceId || (roles?.governance_signers.length ?? 0) >= 3 || actionBusy} onClick={() => setAccountRole('add_governance_signer', governanceId)}>Add signer</button></div></div>
      <div className="policy-form"><label>Confidence threshold (%)<input type="number" min="0" max="100" value={confidence} onChange={(event) => setConfidence(event.target.value)} /></label><label>Large slash threshold (NEAR)<input inputMode="decimal" value={slashThreshold} onChange={(event) => setSlashThreshold(event.target.value)} /></label><label>Provider appeal window (minutes)<input type="number" min="1" max="10080" value={appealMinutes} onChange={(event) => setAppealMinutes(event.target.value)} /></label><button className="button primary" disabled={!ready || actionBusy} onClick={savePolicy}>Update policy</button></div></div>
    {!ready && <small className="button-note">Connect the configured contract owner’s Testnet wallet to change roles or policy.</small>}
  </section>
}

  function Transactions({ data, selected, setSelected }: { data: DashboardData; selected: Transaction | null; setSelected: (tx: Transaction | null) => void }) {
  return <><PageTitle eyebrow="Transaction control" title={selected ? selected.id : 'Transactions'}>{selected && <button className="button secondary" onClick={() => setSelected(null)}><ArrowDownRight size={15} /> Back to list</button>}<button className="button secondary"><Filter size={15} /> Filter</button></PageTitle>{selected ? <TransactionDetail tx={selected} contractId={data.contract} /> : <><div className="filter-tabs"><button className="active">All <span>4</span></button><button>Needs review <span>2</span></button><button>Settled <span>1</span></button><button>On-chain <span>4</span></button></div><div className="transaction-table"><div className="table-head"><span>Order</span><span>Provider / service</span><span>Amount</span><span>Risk</span><span>Status</span><span>Updated</span></div>{data.transactions.map((tx) => <button className="transaction-table-row" key={tx.id} onClick={() => setSelected(tx)}><div><b className="mono">{tx.id}</b><small>{tx.hash}</small></div><div><b>{tx.provider}</b><small>{tx.service}</small></div><b>{tx.amount}</b><StatusPill tone={tx.risk === 'High' ? 'danger' : tx.risk === 'Medium' ? 'warning' : 'success'}>{tx.risk}</StatusPill><StatusPill tone={statusTone(tx.status)}>{tx.status}</StatusPill><span className="muted">{tx.time}</span><ChevronRight size={16} /></button>)}</div></>}</>
}
function statusTone(status: Transaction['status']): 'success' | 'warning' | 'danger' | 'neutral' { return status === 'Released' ? 'success' : status === 'Slashed' ? 'danger' : status === 'Under review' ? 'warning' : 'neutral' }
function TransactionRow({ tx, onClick }: { tx: Transaction; onClick: () => void }) { return <button className="recent-row" onClick={onClick}><div><b className="mono">{tx.id}</b><small>{tx.service}</small></div><b>{tx.provider}</b><b>{tx.amount}</b><StatusPill tone={statusTone(tx.status)}>{tx.status}</StatusPill><span className="muted">{tx.time}</span><ChevronRight size={16} /></button> }
function TransactionDetail({ tx, contractId }: { tx: Transaction; contractId: string }) { return <div className="detail-layout"><section className="panel detail-main"><div className="detail-hero"><div><div className="eyebrow">Transaction / {tx.id}</div><h2>{tx.service}</h2><p>{tx.detail}</p></div><StatusPill tone={statusTone(tx.status)}>{tx.status}</StatusPill></div><div className="detail-stats"><div><span>Escrow value</span><b>{tx.amount}</b><small>public on Testnet</small></div><div><span>Auditor confidence</span><b>{tx.confidence}%</b><small>{tx.confidence < 80 ? 'Below 80% threshold' : 'Above 80% threshold'}</small></div><div><span>Provider</span><b>{tx.provider}</b><small>Verified history</small></div></div><div className="detail-section"><div className="section-heading compact"><h3>Evidence trail</h3><span className="mono">DETERMINISTIC CHECKS</span></div><div className="evidence-list"><div className="evidence-item pass"><Check size={14} /><span>Output schema is valid</span><b>Pass</b></div><div className={`evidence-item ${tx.confidence < 80 ? 'fail' : 'pass'}`}>{tx.confidence < 80 ? <XCircle size={14} /> : <Check size={14} />}<span>Submitted sources resolve</span><b>{tx.confidence < 80 ? 'Fail' : 'Pass'}</b></div><div className="evidence-item pass"><Check size={14} /><span>Appeal window recorded</span><b>Pass</b></div></div></div><div className="detail-section"><div className="section-heading compact"><h3>Settlement policy</h3><span className="amber-text">Requires human approval</span></div><div className="policy-grid"><div><b>Release</b><span>All criteria pass → provider</span></div><div><b>Refund</b><span>Failed criteria → buyer</span></div><div><b>Slash split</b><span>70% / 20% / 10%</span></div></div></div></section><aside className="panel detail-side"><div className="panel-header"><div><div className="eyebrow">On-chain trace</div><h3>Public facts</h3></div><ExternalLink size={16} /></div><div className="chain-fact"><span>Network</span><b><span className="live-dot" /> NEAR Testnet</b></div><div className="chain-fact"><span>Contract</span><b className="mono">{contractId}</b></div><div className="chain-fact"><span>Transaction</span><b className="mono">{tx.hash}</b></div><div className="public-callout"><Globe2 size={16} /><p><b>Nothing here is private.</b> Testnet bond and escrow values can be inspected in a block explorer. This view is an operations summary, not a privacy proof.</p></div><button className="button secondary full"><SquareArrowOutUpRight size={14} /> Open explorer (not connected)</button></aside></div> }

function GuardianQueue({ data, source, contractReady, walletAccountId, guardianId, guardianAuthorization, runAction, actionBusy }: { data: DashboardData; source: DataSource; contractReady: boolean; walletAccountId: string | null; guardianId: string | null; guardianAuthorization: ReturnType<typeof getGuardianAuthorization>; runAction: (action: string, payload?: Record<string, unknown>) => Promise<void>; actionBusy: boolean }) { const live = source === 'testnet'; const canDecide = canGuardianDecide(source, contractReady, walletAccountId, guardianId); return <><PageTitle eyebrow="Human-in-the-loop" title="Guardian queue"><div className="queue-summary"><StatusPill tone={data.guardianCases.length ? 'danger' : 'success'}>{data.guardianCases.length} open cases</StatusPill><span>Policy: confidence below 80% escalates</span></div></PageTitle><div className="guardian-banner"><div className="guardian-banner-icon"><Scale size={19} /></div><div><b>AI can recommend. Guardians decide.</b><p>Review evidence, confirm the mandate, and record a reason before any refund or slash. A recommendation never moves funds on its own.</p>{live && <p className="muted">{guardianAuthorizationMessage(guardianAuthorization)}{guardianId && <> Configured Guardian: <span className="mono">{guardianId}</span>.</>}</p>}</div><div className="approval-rule"><span>Large case rule</span><b>2 of 3 approvals</b></div></div><div className="queue-layout"><section className="queue-list">{data.guardianCases.length ? data.guardianCases.map((item) => <GuardianCard key={item.id} item={item} runAction={runAction} actionBusy={actionBusy} canDecide={live ? canDecide : true} />) : <EmptyState title="No Guardian decisions required" body={live ? 'The configured contract has no order waiting for Guardian approval.' : 'Demo cases will appear here when the deterministic review flow is active.'} />}</section><aside className="panel guardian-side"><div className="panel-header"><div><div className="eyebrow">Policy monitor</div><h3>Decision guardrails</h3></div><ShieldCheck size={19} className="teal-text" /></div><div className="guardrail"><span className="guardrail-number">01</span><div><b>Confidence floor</b><p>Verdicts below 80% pause settlement for review.</p></div></div><div className="guardrail"><span className="guardrail-number">02</span><div><b>Appeal window</b><p>Providers have 10 minutes to submit a demo appeal.</p></div></div><div className="guardrail"><span className="guardrail-number">03</span><div><b>Deterministic split</b><p>70% buyer · 20% insurance pool · 10% auditor.</p></div></div><div className="role-warning"><CircleAlert size={15} /><span>{live ? 'Live authorization comes from get_roles() and the connected wallet. Role switching is disabled.' : 'Role switching is demo-only. It is not production authorization.'}</span></div></aside></div></> }
function GuardianCard({ item, runAction, actionBusy, canDecide }: { item: GuardianCase; runAction: (action: string, payload?: Record<string, unknown>) => Promise<void>; actionBusy: boolean; canDecide: boolean }) { const approved = item.status === 'Approved'; return <article className={`guardian-card ${item.priority.toLowerCase()}`}><div className="guardian-card-head"><div><span className="mono">{item.id}</span><h3>{item.title}</h3></div><StatusPill tone={approved ? 'success' : item.status === 'Escalated' ? 'warning' : 'danger'}>{item.status}</StatusPill></div><div className="guardian-meta"><span><Users size={14} /> {item.provider}</span><span><Coins size={14} /> {item.amount}</span><span><Clock3 size={14} /> {item.age}</span></div><div className="guardian-evidence"><div className="evidence-score"><div><span>Auditor confidence</span><strong className={item.confidence < 80 ? 'danger-text' : 'teal-text'}>{item.confidence}%</strong></div><div className="confidence-track"><span style={{ width: `${item.confidence}%` }} /></div></div><div className="evidence-copy"><span>Why it is here</span><b>{item.threshold}</b><p>{item.evidence}</p></div></div><div className="guardian-card-footer">{approved ? <><span className="approved-note"><Check size={14} /> Decision recorded by Guardian / demo</span>{item.appealUntil && <button className="button ghost small" disabled={actionBusy} onClick={() => runAction('provider-appeal', { id: item.id, providerAccountId: item.providerAccountId, reason: 'Provider submitted an appeal with additional context.' })}><Scale size={14} /> Submit provider appeal</button>}</> : <><button className="button primary small" disabled={actionBusy || !canDecide} onClick={() => runAction('approve-review', { id: item.id })}><Check size={14} /> Approve path</button><button className="button ghost small" disabled={actionBusy || !canDecide} onClick={() => runAction('reject-review', { id: item.id })}><X size={14} /> Reject / hold</button>{!canDecide && <small className="button-note">Connect the configured Guardian wallet to decide.</small>}</>}<button className="text-button">View evidence <ChevronRight size={13} /></button></div></article> }

function AuditLog({ data, setNotice }: { data: DashboardData; setNotice: (message: string) => void }) { const [query, setQuery] = useState(''); const [tone, setTone] = useState('all'); const filtered = useMemo(() => data.auditEvents.filter((event) => `${event.actor} ${event.action} ${event.subject} ${event.result}`.toLowerCase().includes(query.toLowerCase()) && (tone === 'all' || event.tone === tone)), [data.auditEvents, query, tone]); const exportCsv = () => { const csv = ['event_id,time,actor,action,subject,result,transaction_hash', ...data.auditEvents.map((event) => [event.id, event.time, event.actor, event.action, event.subject, event.result, event.hash].map((value) => `"${value.replaceAll('"', '""')}"`).join(','))].join('\n'); const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'bil-bond-audit-demo.csv'; link.click(); URL.revokeObjectURL(url); setNotice('Audit CSV exported from the local demo snapshot.') }; return <><PageTitle eyebrow="Traceability" title="Audit log"><div className="audit-integrity"><ShieldCheck size={15} /> Append-only view <span className="live-dot" /></div><button className="button secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button></PageTitle><div className="audit-toolbar"><div className="search-box"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actor, order, or event" /></div><div className="filter-tabs compact-tabs"><button className={tone === 'all' ? 'active' : ''} onClick={() => setTone('all')}>All <span>{data.auditEvents.length}</span></button><button className={tone === 'success' ? 'active' : ''} onClick={() => setTone('success')}>Settled</button><button className={tone === 'danger' ? 'active' : ''} onClick={() => setTone('danger')}>Risk</button></div></div><div className="audit-table"><div className="table-head"><span>Event / time</span><span>Actor</span><span>Action</span><span>Subject</span><span>Result</span><span>Transaction hash</span></div>{filtered.length ? filtered.map((event) => <AuditRow key={event.id} event={event} />) : <EmptyState title="No matching events" body="Try a different actor, order, or result filter." />}</div><div className="audit-foot"><span><LockKeyhole size={14} /> All event IDs and hashes shown are deterministic demo values.</span><span><Globe2 size={14} /> Public Testnet facts are not confidential.</span></div></> }
function AuditRow({ event }: { event: AuditEvent }) { return <div className="audit-row"><div><b className="mono">{event.id}</b><small>{event.time}</small></div><span>{event.actor}</span><b>{event.action}</b><span className="mono">{event.subject}</span><StatusPill tone={event.tone === 'success' ? 'success' : event.tone === 'danger' ? 'danger' : event.tone === 'warning' ? 'warning' : 'neutral'}>{event.result}</StatusPill><span className="mono hash-link">{event.hash}</span></div> }

export default App
