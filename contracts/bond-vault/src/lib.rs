use borsh::{BorshDeserialize, BorshSerialize};
use near_sdk::collections::{LookupMap, UnorderedMap, Vector};
use near_sdk::json_types::{U128, U64};
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::{env, near_bindgen, AccountId, BorshStorageKey, NearToken, PanicOnDefault, Promise};

const BP: u128 = 10_000;
const NEAR: u128 = 1_000_000_000_000_000_000_000_000;
const MAX_TEXT: usize = 2_048;
const MAX_CRITERIA: usize = 8_192;
const MAX_PAGE: u64 = 50;

#[derive(BorshSerialize, BorshStorageKey)]
enum Key {
    Providers,
    ProviderIds,
    Offers,
    Orders,
    Rewards,
    Penalties,
    Overturned,
    Claims,
    Events,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
pub enum ReputationProfile {
    Demo,
    Production,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Policy {
    pub low_confidence_threshold: u8,
    pub large_slash_threshold: u128,
    pub demo_appeal_window_ns: u64,
    pub production_appeal_window_ns: u64,
    pub reputation_profile: ReputationProfile,
    pub success_reputation_gain_demo: u8,
    pub success_reputation_gain_production: u8,
    pub slash_reputation_penalty: u8,
    pub sla_timeout_penalty: u8,
    pub auditor_reversal_penalty: u8,
    pub max_claims_per_pair: u8,
    pub claims_window_ns: u64,
    pub bond_discount_bps_per_point: u16,
    pub minimum_bond_ratio_bps: u16,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Provider {
    pub account_id: AccountId,
    pub bond: u128,
    pub reserved_bond: u128,
    pub reputation: u8,
    pub registered_at: u64,
    pub successful_orders: u64,
    pub slashed_orders: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Offer {
    pub id: u64,
    pub provider_id: AccountId,
    pub service_type: String,
    pub price: u128,
    pub sla: String,
    pub sla_duration_ns: u64,
    pub verification_criteria: String,
    pub max_contract_amount: u128,
    pub active: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Verdict {
    pub auditor_id: AccountId,
    pub passed: bool,
    pub confidence: u8,
    pub reasons: String,
    pub evidence: String,
    pub recorded_at: u64,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
pub enum OrderStatus {
    EscrowLocked,
    WorkSubmitted,
    VerdictRecorded,
    AppealWindow,
    Appealed,
    Released,
    Slashed,
    Refunded,
    GuardianRejected,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq, Debug)]
#[serde(crate = "near_sdk::serde", rename_all = "snake_case")]
pub enum AppealStatus {
    None,
    Pending,
    Upheld,
    Overturned,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Approvals {
    pub auditor: bool,
    pub guardian: bool,
    pub governance: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct Order {
    pub id: u64,
    pub offer_id: u64,
    pub provider_id: AccountId,
    pub buyer_id: AccountId,
    pub auditor_id: AccountId,
    pub amount: u128,
    pub reserved_bond: u128,
    pub specification: String,
    pub verification_criteria: String,
    pub created_at: u64,
    pub sla_duration_ns: u64,
    pub profile: ReputationProfile,
    pub status: OrderStatus,
    pub work_reference: Option<String>,
    pub verdict: Option<Verdict>,
    pub guardian_id: Option<AccountId>,
    pub guardian_approved: bool,
    pub appeal_deadline: Option<u64>,
    pub appeal_reason: Option<String>,
    pub approvals: Approvals,
    pub slash_amount: u128,
    pub appeal_resolved: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Clone)]
struct ClaimWindow {
    started_at: u64,
    count: u8,
}

#[derive(BorshDeserialize, BorshSerialize, Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AuditEvent {
    pub sequence: u64,
    pub kind: String,
    pub actor: AccountId,
    pub order_id: Option<u64>,
    pub timestamp: u64,
    pub details: String,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct PolicyView {
    pub low_confidence_threshold: u8,
    pub large_slash_threshold: U128,
    pub demo_appeal_window_ns: U64,
    pub production_appeal_window_ns: U64,
    pub reputation_profile: ReputationProfile,
    pub success_reputation_gain_demo: u8,
    pub success_reputation_gain_production: u8,
    pub slash_reputation_penalty: u8,
    pub sla_timeout_penalty: u8,
    pub auditor_reversal_penalty: u8,
    pub max_claims_per_pair: u8,
    pub claims_window_ns: U64,
    pub bond_discount_bps_per_point: u16,
    pub minimum_bond_ratio_bps: u16,
}
impl From<Policy> for PolicyView {
    fn from(p: Policy) -> Self {
        Self {
            low_confidence_threshold: p.low_confidence_threshold,
            large_slash_threshold: U128(p.large_slash_threshold),
            demo_appeal_window_ns: U64(p.demo_appeal_window_ns),
            production_appeal_window_ns: U64(p.production_appeal_window_ns),
            reputation_profile: p.reputation_profile,
            success_reputation_gain_demo: p.success_reputation_gain_demo,
            success_reputation_gain_production: p.success_reputation_gain_production,
            slash_reputation_penalty: p.slash_reputation_penalty,
            sla_timeout_penalty: p.sla_timeout_penalty,
            auditor_reversal_penalty: p.auditor_reversal_penalty,
            max_claims_per_pair: p.max_claims_per_pair,
            claims_window_ns: U64(p.claims_window_ns),
            bond_discount_bps_per_point: p.bond_discount_bps_per_point,
            minimum_bond_ratio_bps: p.minimum_bond_ratio_bps,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct RolesView {
    pub owner_id: AccountId,
    pub auditor_id: Option<AccountId>,
    pub guardian_id: Option<AccountId>,
    pub governance_signer: Option<AccountId>,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct ProviderView {
    pub account_id: AccountId,
    pub bond: U128,
    pub reserved_bond: U128,
    pub available_bond: U128,
    pub reputation: u8,
    pub registered_at: U64,
    pub successful_orders: U64,
    pub slashed_orders: U64,
}
impl From<Provider> for ProviderView {
    fn from(p: Provider) -> Self {
        Self {
            account_id: p.account_id,
            bond: U128(p.bond),
            reserved_bond: U128(p.reserved_bond),
            available_bond: U128(p.bond.saturating_sub(p.reserved_bond)),
            reputation: p.reputation,
            registered_at: U64(p.registered_at),
            successful_orders: U64(p.successful_orders),
            slashed_orders: U64(p.slashed_orders),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct OfferView {
    pub id: u64,
    pub provider_id: AccountId,
    pub service_type: String,
    pub price: U128,
    pub sla: String,
    pub sla_duration_ns: U64,
    pub verification_criteria: String,
    pub max_contract_amount: U128,
    pub active: bool,
}
impl From<Offer> for OfferView {
    fn from(o: Offer) -> Self {
        Self {
            id: o.id,
            provider_id: o.provider_id,
            service_type: o.service_type,
            price: U128(o.price),
            sla: o.sla,
            sla_duration_ns: U64(o.sla_duration_ns),
            verification_criteria: o.verification_criteria,
            max_contract_amount: U128(o.max_contract_amount),
            active: o.active,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct VerdictView {
    pub auditor_id: AccountId,
    pub passed: bool,
    pub confidence: u8,
    pub reasons: String,
    pub evidence: String,
    pub recorded_at: U64,
}
impl From<Verdict> for VerdictView {
    fn from(v: Verdict) -> Self {
        Self {
            auditor_id: v.auditor_id,
            passed: v.passed,
            confidence: v.confidence,
            reasons: v.reasons,
            evidence: v.evidence,
            recorded_at: U64(v.recorded_at),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct OrderView {
    pub id: u64,
    pub offer_id: u64,
    pub provider_id: AccountId,
    pub buyer_id: AccountId,
    pub auditor_id: AccountId,
    pub amount: U128,
    pub reserved_bond: U128,
    pub specification: String,
    pub verification_criteria: String,
    pub created_at: U64,
    pub sla_duration_ns: U64,
    pub profile: ReputationProfile,
    pub status: OrderStatus,
    pub work_reference: Option<String>,
    pub verdict: Option<VerdictView>,
    pub guardian_id: Option<AccountId>,
    pub guardian_approved: bool,
    pub appeal_deadline: Option<U64>,
    pub appeal_reason: Option<String>,
    pub approvals: Approvals,
    pub slash_amount: U128,
    pub appeal_resolved: bool,
    pub appeal_status: AppealStatus,
}
impl From<Order> for OrderView {
    fn from(o: Order) -> Self {
        let derived_appeal_status = appeal_status(&o);
        Self {
            id: o.id,
            offer_id: o.offer_id,
            provider_id: o.provider_id,
            buyer_id: o.buyer_id,
            auditor_id: o.auditor_id,
            amount: U128(o.amount),
            reserved_bond: U128(o.reserved_bond),
            specification: o.specification,
            verification_criteria: o.verification_criteria,
            created_at: U64(o.created_at),
            sla_duration_ns: U64(o.sla_duration_ns),
            profile: o.profile,
            status: o.status,
            work_reference: o.work_reference,
            verdict: o.verdict.map(VerdictView::from),
            guardian_id: o.guardian_id,
            guardian_approved: o.guardian_approved,
            appeal_deadline: o.appeal_deadline.map(U64),
            appeal_reason: o.appeal_reason,
            approvals: o.approvals,
            slash_amount: U128(o.slash_amount),
            appeal_resolved: o.appeal_resolved,
            appeal_status: derived_appeal_status,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AuditorPenaltyView {
    pub auditor_id: AccountId,
    pub penalty_points: u16,
    pub overturned_appeals: U64,
}

#[derive(Serialize, Deserialize, Clone, PartialEq, Eq)]
#[serde(crate = "near_sdk::serde")]
pub struct AuditEventView {
    pub sequence: U64,
    pub kind: String,
    pub actor: AccountId,
    pub order_id: Option<u64>,
    pub timestamp: U64,
    pub details: String,
}
impl From<AuditEvent> for AuditEventView {
    fn from(e: AuditEvent) -> Self {
        Self {
            sequence: U64(e.sequence),
            kind: e.kind,
            actor: e.actor,
            order_id: e.order_id,
            timestamp: U64(e.timestamp),
            details: e.details,
        }
    }
}

#[derive(BorshDeserialize, BorshSerialize, PanicOnDefault)]
#[near_bindgen]
pub struct BondVault {
    pub owner_id: AccountId,
    pub auditor_id: Option<AccountId>,
    pub guardian_id: Option<AccountId>,
    pub governance_signer: Option<AccountId>,
    pub policy: Policy,
    pub next_offer_id: u64,
    pub next_order_id: u64,
    pub next_event_id: u64,
    pub insurance_pool: u128,
    pub providers: LookupMap<AccountId, Provider>,
    pub provider_ids: Vector<AccountId>,
    pub offers: UnorderedMap<u64, Offer>,
    pub orders: UnorderedMap<u64, Order>,
    pub auditor_rewards: LookupMap<AccountId, u128>,
    pub auditor_penalties: LookupMap<AccountId, u16>,
    pub overturned_appeals: LookupMap<AccountId, u64>,
    claims: LookupMap<String, ClaimWindow>,
    pub audit_events: Vector<AuditEvent>,
}

#[near_bindgen]
impl BondVault {
    #[init]
    pub fn new() -> Self {
        assert!(!env::state_exists(), "The contract is already initialized");
        Self {
            owner_id: env::predecessor_account_id(),
            auditor_id: None,
            guardian_id: None,
            governance_signer: None,
            policy: Policy {
                low_confidence_threshold: 80,
                large_slash_threshold: 10 * NEAR,
                demo_appeal_window_ns: 60 * 1_000_000_000,
                production_appeal_window_ns: 600 * 1_000_000_000,
                reputation_profile: ReputationProfile::Demo,
                success_reputation_gain_demo: 10,
                success_reputation_gain_production: 2,
                slash_reputation_penalty: 30,
                sla_timeout_penalty: 10,
                auditor_reversal_penalty: 20,
                max_claims_per_pair: 3,
                claims_window_ns: 24 * 60 * 60 * 1_000_000_000,
                bond_discount_bps_per_point: 75,
                minimum_bond_ratio_bps: 2_500,
            },
            next_offer_id: 0,
            next_order_id: 0,
            next_event_id: 0,
            insurance_pool: 0,
            providers: LookupMap::new(Key::Providers),
            provider_ids: Vector::new(Key::ProviderIds),
            offers: UnorderedMap::new(Key::Offers),
            orders: UnorderedMap::new(Key::Orders),
            auditor_rewards: LookupMap::new(Key::Rewards),
            auditor_penalties: LookupMap::new(Key::Penalties),
            overturned_appeals: LookupMap::new(Key::Overturned),
            claims: LookupMap::new(Key::Claims),
            audit_events: Vector::new(Key::Events),
        }
    }
    pub fn set_auditor(&mut self, id: AccountId) {
        self.assert_owner();
        self.distinct(&id);
        assert!(
            self.auditor_id.is_none(),
            "The auditor is already configured"
        );
        self.auditor_id = Some(id.clone());
        self.event("auditor_configured", None, &id, "Auditor role configured");
    }
    pub fn set_guardian(&mut self, id: AccountId) {
        self.assert_owner();
        self.distinct(&id);
        assert!(
            self.guardian_id.is_none(),
            "The guardian is already configured"
        );
        self.guardian_id = Some(id.clone());
        self.event("guardian_configured", None, &id, "Guardian role configured");
    }
    pub fn add_governance_signer(&mut self, id: AccountId) {
        self.assert_owner();
        self.distinct(&id);
        assert!(
            self.governance_signer.is_none(),
            "Exactly one governance signer is supported"
        );
        self.governance_signer = Some(id.clone());
        self.event(
            "governance_signer_configured",
            None,
            &id,
            "Human governance signer configured",
        );
    }
    #[allow(clippy::too_many_arguments)]
    pub fn set_policy(
        &mut self,
        low_confidence_threshold: u8,
        large_slash_threshold: U128,
        demo_appeal_window_ns: U64,
        production_appeal_window_ns: U64,
        reputation_profile: ReputationProfile,
        success_reputation_gain_demo: u8,
        success_reputation_gain_production: u8,
        slash_reputation_penalty: u8,
        sla_timeout_penalty: u8,
        auditor_reversal_penalty: u8,
        max_claims_per_pair: u8,
        claims_window_ns: U64,
        bond_discount_bps_per_point: u16,
        minimum_bond_ratio_bps: u16,
    ) {
        self.assert_governance();
        assert!(
            low_confidence_threshold <= 100,
            "Confidence threshold must be at most 100"
        );
        assert!(
            large_slash_threshold.0 > 0,
            "The large slash threshold must be positive"
        );
        assert!(
            demo_appeal_window_ns.0 > 0 && production_appeal_window_ns.0 > 0,
            "Appeal windows must be positive"
        );
        assert!(
            max_claims_per_pair > 0 && claims_window_ns.0 > 0,
            "Claim policy must be positive"
        );
        assert!(
            bond_discount_bps_per_point <= 10_000 && minimum_bond_ratio_bps <= 10_000,
            "Bond policy is invalid"
        );
        assert!(
            success_reputation_gain_demo <= 100
                && success_reputation_gain_production <= 100
                && slash_reputation_penalty <= 100
                && sla_timeout_penalty <= 100
                && auditor_reversal_penalty <= 100,
            "Reputation policy is invalid"
        );
        self.policy = Policy {
            low_confidence_threshold: low_confidence_threshold,
            large_slash_threshold: large_slash_threshold.0,
            demo_appeal_window_ns: demo_appeal_window_ns.0,
            production_appeal_window_ns: production_appeal_window_ns.0,
            reputation_profile: reputation_profile,
            success_reputation_gain_demo: success_reputation_gain_demo,
            success_reputation_gain_production: success_reputation_gain_production,
            slash_reputation_penalty: slash_reputation_penalty,
            sla_timeout_penalty: sla_timeout_penalty,
            auditor_reversal_penalty: auditor_reversal_penalty,
            max_claims_per_pair: max_claims_per_pair,
            claims_window_ns: claims_window_ns.0,
            bond_discount_bps_per_point: bond_discount_bps_per_point,
            minimum_bond_ratio_bps: minimum_bond_ratio_bps,
        };
        let a = env::predecessor_account_id();
        self.event("policy_updated", None, &a, "Governance policy updated");
    }
    pub fn register_provider(&mut self) {
        let id = env::predecessor_account_id();
        assert!(
            !self.providers.contains_key(&id),
            "The provider is already registered"
        );
        self.providers.insert(
            &id,
            &Provider {
                account_id: id.clone(),
                bond: 0,
                reserved_bond: 0,
                reputation: 0,
                registered_at: env::block_timestamp(),
                successful_orders: 0,
                slashed_orders: 0,
            },
        );
        self.provider_ids.push(&id);
        self.event("provider_registered", None, &id, "Provider registered");
    }
    #[payable]
    pub fn deposit_bond(&mut self) {
        let id = env::predecessor_account_id();
        let mut p = self.provider(&id);
        let n = env::attached_deposit().as_yoctonear();
        assert!(n > 0, "A positive bond deposit is required");
        p.bond = p.bond.checked_add(n).expect("Bond overflow");
        self.providers.insert(&id, &p);
        self.event("bond_deposited", None, &id, &format!("amount={n}"));
    }
    pub fn create_offer(
        &mut self,
        service_type: String,
        price: U128,
        sla: String,
        sla_duration_ns: U64,
        verification_criteria: String,
        max_contract_amount: U128,
    ) -> u64 {
        let id = env::predecessor_account_id();
        let p = self.provider(&id);
        validate(&service_type, "Service type", MAX_TEXT);
        validate(&sla, "SLA", MAX_TEXT);
        validate(
            &verification_criteria,
            "Verification criteria",
            MAX_CRITERIA,
        );
        assert!(
            price.0 > 0 && max_contract_amount.0 >= price.0,
            "Offer amounts are invalid"
        );
        assert!(sla_duration_ns.0 > 0, "The SLA duration must be positive");
        assert!(
            p.bond >= required(max_contract_amount.0, p.reputation, &self.policy),
            "The provider bond does not satisfy the offer requirement"
        );
        let n = self.next_offer_id;
        self.next_offer_id = n.checked_add(1).expect("Offer ID overflow");
        self.offers.insert(
            &n,
            &Offer {
                id: n,
                provider_id: id.clone(),
                service_type,
                price: price.0,
                sla,
                sla_duration_ns: sla_duration_ns.0,
                verification_criteria: verification_criteria,
                max_contract_amount: max_contract_amount.0,
                active: true,
            },
        );
        self.event("offer_created", None, &id, &format!("offer_id={n}"));
        n
    }
    pub fn deactivate_offer(&mut self, id: u64) {
        let who = env::predecessor_account_id();
        let mut o = self.offer(id);
        assert_eq!(
            o.provider_id, who,
            "Only the offer provider may deactivate it"
        );
        assert!(o.active, "The offer is already inactive");
        o.active = false;
        self.offers.insert(&id, &o);
        self.event("offer_deactivated", None, &who, &format!("offer_id={id}"));
    }
    #[payable]
    pub fn lock_escrow(&mut self, offer_id: u64, specification: String) -> u64 {
        let buyer = env::predecessor_account_id();
        let o = self.offer(offer_id);
        assert!(o.active, "The offer is inactive");
        assert_ne!(buyer, o.provider_id, "A provider cannot buy its own offer");
        validate(&specification, "Specification", MAX_TEXT);
        let amount = env::attached_deposit().as_yoctonear();
        assert_eq!(
            amount, o.price,
            "Attached escrow must equal the offer price"
        );
        assert!(
            amount <= o.max_contract_amount,
            "The escrow exceeds the offer limit"
        );
        let auditor = self
            .auditor_id
            .clone()
            .expect("An auditor must be configured");
        let mut p = self.provider(&o.provider_id);
        let reserve = required(amount, p.reputation, &self.policy);
        p.reserved_bond = p
            .reserved_bond
            .checked_add(reserve)
            .expect("Reservation overflow");
        assert!(
            p.reserved_bond <= p.bond,
            "Active reservations exceed the available bond"
        );
        self.providers.insert(&o.provider_id, &p);
        let n = self.next_order_id;
        self.next_order_id = n.checked_add(1).expect("Order ID overflow");
        self.orders.insert(
            &n,
            &Order {
                id: n,
                offer_id,
                provider_id: o.provider_id.clone(),
                buyer_id: buyer.clone(),
                auditor_id: auditor,
                amount,
                reserved_bond: reserve,
                specification,
                verification_criteria: o.verification_criteria,
                created_at: env::block_timestamp(),
                sla_duration_ns: o.sla_duration_ns,
                profile: self.policy.reputation_profile.clone(),
                status: OrderStatus::EscrowLocked,
                work_reference: None,
                verdict: None,
                guardian_id: None,
                guardian_approved: false,
                appeal_deadline: None,
                appeal_reason: None,
                approvals: Approvals {
                    auditor: false,
                    guardian: false,
                    governance: false,
                },
                slash_amount: 0,
                appeal_resolved: false,
            },
        );
        self.event(
            "escrow_locked",
            Some(n),
            &buyer,
            &format!("amount={amount};reserved_bond={reserve}"),
        );
        n
    }
    pub fn submit_work(&mut self, id: u64, result: String) {
        let who = env::predecessor_account_id();
        let mut o = self.order(id);
        assert_eq!(o.provider_id, who, "Only the provider may submit work");
        assert_eq!(
            o.status,
            OrderStatus::EscrowLocked,
            "Work cannot be submitted in this state"
        );
        validate(&result, "Work result", MAX_CRITERIA);
        o.work_reference = Some(result);
        o.status = OrderStatus::WorkSubmitted;
        self.orders.insert(&id, &o);
        self.event("work_submitted", Some(id), &who, "Provider work submitted");
    }
    pub fn record_verdict(
        &mut self,
        id: u64,
        passed: bool,
        confidence: u8,
        reasons: String,
        evidence: String,
    ) {
        let who = env::predecessor_account_id();
        assert_eq!(
            self.auditor_id.as_ref(),
            Some(&who),
            "Only the configured auditor may record a verdict"
        );
        let mut o = self.order(id);
        assert_eq!(
            o.auditor_id, who,
            "The order auditor does not match the caller"
        );
        assert_eq!(
            o.status,
            OrderStatus::WorkSubmitted,
            "A verdict already exists or work is missing"
        );
        assert!(confidence <= 100, "Confidence must be between 0 and 100");
        validate(&reasons, "Reasons", MAX_TEXT);
        validate(&evidence, "Evidence", MAX_CRITERIA);
        o.verdict = Some(Verdict {
            auditor_id: who.clone(),
            passed,
            confidence,
            reasons,
            evidence,
            recorded_at: env::block_timestamp(),
        });
        o.approvals.auditor = true;
        o.status = OrderStatus::VerdictRecorded;
        self.orders.insert(&id, &o);
        self.event(
            "verdict_recorded",
            Some(id),
            &who,
            "Deterministic auditor verdict recorded",
        );
    }

    pub fn guardian_decide(&mut self, id: u64, approve: bool) {
        let who = env::predecessor_account_id();
        assert_eq!(
            self.guardian_id.as_ref(),
            Some(&who),
            "Only the configured guardian may decide"
        );
        let mut o = self.order(id);
        assert_eq!(
            o.status,
            OrderStatus::VerdictRecorded,
            "Guardian decision is not valid in this state"
        );
        let v = o.verdict.clone().expect("A verdict is required");
        o.guardian_id = Some(who.clone());
        o.guardian_approved = approve;
        o.approvals.guardian = approve;
        let escalated = self.escalated(&o);
        if !approve && !escalated {
            self.refund(
                &mut o,
                OrderStatus::GuardianRejected,
                "Guardian rejected the outcome",
            );
            return;
        }
        if v.passed {
            o.status = OrderStatus::AppealWindow;
            self.orders.insert(&id, &o);
            self.event(
                if approve {
                    "guardian_approved_success"
                } else {
                    "guardian_vote_rejected_escalated_success"
                },
                Some(id),
                &who,
                "Guardian vote recorded for successful verdict",
            );
        } else {
            o.slash_amount = o.reserved_bond;
            o.appeal_deadline = Some(
                env::block_timestamp()
                    .checked_add(self.window(&o.profile))
                    .expect("Appeal deadline overflow"),
            );
            o.status = OrderStatus::AppealWindow;
            self.orders.insert(&id, &o);
            self.event(
                if approve {
                    "guardian_approved_slash"
                } else {
                    "guardian_vote_rejected_escalated_slash"
                },
                Some(id),
                &who,
                "Guardian vote recorded; appeal window started",
            );
        }
    }
    pub fn governance_approve(&mut self, id: u64, approve: bool) {
        let who = env::predecessor_account_id();
        assert_eq!(
            self.governance_signer.as_ref(),
            Some(&who),
            "Only the governance signer may approve escalation"
        );
        let mut o = self.order(id);
        assert!(
            matches!(
                o.status,
                OrderStatus::VerdictRecorded | OrderStatus::AppealWindow
            ),
            "Governance approval is not valid in this state"
        );
        assert!(
            self.escalated(&o),
            "This order does not require governance escalation"
        );
        if !approve {
            self.overturn(&mut o, "Governance rejected the slash");
        } else {
            o.approvals.governance = true;
            if o.status == OrderStatus::VerdictRecorded {
                if o.verdict.as_ref().expect("A verdict is required").passed {
                    o.status = OrderStatus::AppealWindow;
                } else {
                    o.slash_amount = o.reserved_bond;
                    o.appeal_deadline = Some(
                        env::block_timestamp()
                            .checked_add(self.window(&o.profile))
                            .expect("Appeal deadline overflow"),
                    );
                    o.status = OrderStatus::AppealWindow;
                }
            }
            self.orders.insert(&id, &o);
            self.event(
                "governance_approved",
                Some(id),
                &who,
                "Governance approval recorded as a distinct signer vote",
            );
        }
    }
    pub fn appeal(&mut self, id: u64, reason: String) {
        let who = env::predecessor_account_id();
        let mut o = self.order(id);
        assert_eq!(o.provider_id, who, "Only the provider may appeal");
        assert_eq!(
            o.status,
            OrderStatus::AppealWindow,
            "An appeal is not valid in this state"
        );
        assert!(!o.appeal_resolved, "The appeal has already been resolved");
        assert!(
            env::block_timestamp() < o.appeal_deadline.expect("The appeal deadline is missing"),
            "The appeal window has closed"
        );
        assert!(
            !o.verdict.as_ref().expect("A verdict is required").passed,
            "A successful result cannot be appealed"
        );
        validate(&reason, "Appeal reason", MAX_TEXT);
        o.appeal_reason = Some(reason);
        o.status = OrderStatus::Appealed;
        self.orders.insert(&id, &o);
        self.event(
            "appeal_submitted",
            Some(id),
            &who,
            "Provider appeal submitted",
        );
    }
    pub fn resolve_appeal(&mut self, id: u64, uphold_slash: bool) {
        let who = env::predecessor_account_id();
        assert_eq!(
            self.governance_signer.as_ref(),
            Some(&who),
            "Only governance may resolve an appeal"
        );
        let mut o = self.order(id);
        assert_eq!(o.status, OrderStatus::Appealed, "There is no active appeal");
        if uphold_slash {
            o.appeal_resolved = true;
            o.approvals.governance = true;
            o.appeal_deadline = Some(env::block_timestamp());
            o.status = OrderStatus::AppealWindow;
            self.orders.insert(&id, &o);
            self.event(
                "appeal_upheld",
                Some(id),
                &who,
                "Governance upheld the slash",
            );
        } else {
            let pending = share10(o.slash_amount);
            self.insurance_pool = self
                .insurance_pool
                .checked_add(pending)
                .expect("Insurance overflow");
            self.penalize(&o.auditor_id, self.policy.auditor_reversal_penalty);
            let n = self
                .overturned_appeals
                .get(&o.auditor_id)
                .unwrap_or(0)
                .checked_add(1)
                .expect("Appeal count overflow");
            self.overturned_appeals.insert(&o.auditor_id, &n);
            self.release(&o.provider_id, o.reserved_bond);
            o.reserved_bond = 0;
            o.appeal_resolved = true;
            o.appeal_deadline = Some(env::block_timestamp());
            o.status = OrderStatus::Refunded;
            self.orders.insert(&id, &o);
            Promise::new(o.buyer_id.clone()).transfer(NearToken::from_yoctonear(o.amount));
            self.event(
                "appeal_overturned",
                Some(id),
                &who,
                "Verdict overturned; auditor share moved to insurance and escrow refunded",
            );
        }
    }
    pub fn finalize_success(&mut self, id: u64) {
        let mut o = self.order(id);
        assert_eq!(
            o.status,
            OrderStatus::AppealWindow,
            "Success cannot be finalized in this state"
        );
        assert!(
            o.verdict.as_ref().expect("A verdict is required").passed,
            "The verdict did not pass"
        );
        if self.escalated(&o) {
            if !o.approvals.auditor || !o.approvals.governance {
                self.refund(
                    &mut o,
                    OrderStatus::GuardianRejected,
                    "Escalated success lacked the required human governance vote",
                );
                return;
            }
        } else if !o.approvals.auditor || !o.guardian_approved {
            self.refund(
                &mut o,
                OrderStatus::GuardianRejected,
                "Successful release lacked Auditor and Guardian approvals",
            );
            return;
        }
        self.release(&o.provider_id, o.reserved_bond);
        o.reserved_bond = 0;
        o.status = OrderStatus::Released;
        let mut p = self.provider(&o.provider_id);
        p.successful_orders = p
            .successful_orders
            .checked_add(1)
            .expect("Success count overflow");
        let gain = match o.profile {
            ReputationProfile::Demo => self.policy.success_reputation_gain_demo,
            ReputationProfile::Production => self.policy.success_reputation_gain_production,
        };
        p.reputation = p.reputation.saturating_add(gain).min(100);
        self.providers.insert(&o.provider_id, &p);
        self.orders.insert(&id, &o);
        Promise::new(o.provider_id.clone()).transfer(NearToken::from_yoctonear(o.amount));
        self.event(
            "escrow_released",
            Some(id),
            &env::predecessor_account_id(),
            "Escrow released to provider",
        );
    }
    pub fn finalize_failure(&mut self, id: u64) {
        let mut o = self.order(id);
        assert_eq!(
            o.status,
            OrderStatus::AppealWindow,
            "Failure cannot be finalized in this state"
        );
        let v = o.verdict.clone().expect("A verdict is required");
        assert!(!v.passed, "A passing verdict cannot be slashed");
        assert!(
            env::block_timestamp() >= o.appeal_deadline.expect("The appeal deadline is missing"),
            "The appeal window is still open"
        );
        if self.escalated(&o) {
            if !o.approvals.governance || !(o.approvals.auditor || o.approvals.guardian) {
                self.refund(
                    &mut o,
                    OrderStatus::GuardianRejected,
                    "Escalated slash lacked two distinct approvals including human governance",
                );
                return;
            }
        } else if !o.approvals.auditor || !o.guardian_approved {
            self.refund(
                &mut o,
                OrderStatus::GuardianRejected,
                "Slash lacked Auditor and Guardian approvals",
            );
            return;
        }
        self.claim(&o);
        let slash = o.slash_amount;
        let buyer = slash.checked_mul(70).expect("Distribution overflow") / 100;
        let insurance = slash.checked_mul(20).expect("Distribution overflow") / 100;
        let reward = slash
            .checked_sub(buyer)
            .expect("Distribution underflow")
            .checked_sub(insurance)
            .expect("Distribution underflow");
        let mut p = self.provider(&o.provider_id);
        assert!(
            p.bond >= slash && p.reserved_bond >= o.reserved_bond,
            "Reserved provider bond is insufficient"
        );
        p.bond -= slash;
        p.reserved_bond -= o.reserved_bond;
        p.slashed_orders = p
            .slashed_orders
            .checked_add(1)
            .expect("Slash count overflow");
        p.reputation = p
            .reputation
            .saturating_sub(self.policy.slash_reputation_penalty);
        self.providers.insert(&o.provider_id, &p);
        self.insurance_pool = self
            .insurance_pool
            .checked_add(insurance)
            .expect("Insurance overflow");
        let old = self.auditor_rewards.get(&v.auditor_id).unwrap_or(0);
        self.auditor_rewards.insert(
            &v.auditor_id,
            &old.checked_add(reward).expect("Reward overflow"),
        );
        o.reserved_bond = 0;
        o.status = OrderStatus::Slashed;
        self.orders.insert(&id, &o);
        Promise::new(o.buyer_id.clone()).transfer(NearToken::from_yoctonear(
            o.amount.checked_add(buyer).expect("Buyer payout overflow"),
        ));
        self.event(
            "escrow_refunded_and_bond_slashed",
            Some(id),
            &env::predecessor_account_id(),
            &format!("buyer_share={buyer};insurance_share={insurance};auditor_share={reward}"),
        );
    }
    pub fn refund_after_sla(&mut self, id: u64) {
        let mut o = self.order(id);
        assert!(
            matches!(
                o.status,
                OrderStatus::EscrowLocked | OrderStatus::WorkSubmitted
            ),
            "SLA refund is not valid in this state"
        );
        assert!(
            o.work_reference.is_none(),
            "A submitted result must be reviewed"
        );
        assert!(
            env::block_timestamp()
                >= o.created_at
                    .checked_add(o.sla_duration_ns)
                    .expect("SLA deadline overflow"),
            "The SLA has not expired"
        );
        self.release(&o.provider_id, o.reserved_bond);
        o.reserved_bond = 0;
        o.status = OrderStatus::Refunded;
        let mut p = self.provider(&o.provider_id);
        p.reputation = p.reputation.saturating_sub(self.policy.sla_timeout_penalty);
        self.providers.insert(&o.provider_id, &p);
        self.orders.insert(&id, &o);
        Promise::new(o.buyer_id.clone()).transfer(NearToken::from_yoctonear(o.amount));
        self.event(
            "sla_refund",
            Some(id),
            &env::predecessor_account_id(),
            "SLA expired without a result; no slash applied",
        );
    }
    pub fn withdraw_auditor_rewards(&mut self) {
        let who = env::predecessor_account_id();
        assert_eq!(
            self.auditor_id.as_ref(),
            Some(&who),
            "Only the configured auditor may withdraw rewards"
        );
        let n = self.auditor_rewards.get(&who).unwrap_or(0);
        assert!(n > 0, "There are no claimable auditor rewards");
        self.auditor_rewards.insert(&who, &0);
        Promise::new(who.clone()).transfer(NearToken::from_yoctonear(n));
        self.event(
            "auditor_rewards_withdrawn",
            None,
            &who,
            &format!("amount={n}"),
        );
    }

    pub fn get_roles(&self) -> RolesView {
        RolesView {
            owner_id: self.owner_id.clone(),
            auditor_id: self.auditor_id.clone(),
            guardian_id: self.guardian_id.clone(),
            governance_signer: self.governance_signer.clone(),
        }
    }
    pub fn get_policy(&self) -> PolicyView {
        self.policy.clone().into()
    }
    pub fn get_provider(&self, id: AccountId) -> Option<ProviderView> {
        self.providers.get(&id).map(ProviderView::from)
    }
    pub fn get_offer(&self, id: u64) -> Option<OfferView> {
        self.offers.get(&id).map(OfferView::from)
    }
    pub fn get_order(&self, id: u64) -> Option<OrderView> {
        self.orders.get(&id).map(|o| self.order_view(o))
    }
    pub fn get_insurance_pool(&self) -> U128 {
        U128(self.insurance_pool)
    }
    pub fn get_auditor_rewards(&self, id: AccountId) -> U128 {
        U128(self.auditor_rewards.get(&id).unwrap_or(0))
    }
    pub fn get_auditor_penalty_state(&self, id: AccountId) -> AuditorPenaltyView {
        AuditorPenaltyView {
            auditor_id: id.clone(),
            penalty_points: self.auditor_penalties.get(&id).unwrap_or(0),
            overturned_appeals: U64(self.overturned_appeals.get(&id).unwrap_or(0)),
        }
    }
    pub fn bond_ratio_bps(&self, r: u8) -> u16 {
        assert!(r <= 100, "Reputation must be between 0 and 100");
        ratio(r, &self.policy) as u16
    }
    pub fn required_bond_for_offer(&self, a: U128, r: u8) -> U128 {
        assert!(r <= 100, "Reputation must be between 0 and 100");
        U128(required(a.0, r, &self.policy))
    }
    pub fn get_providers(&self, start: u64, limit: u64) -> Vec<ProviderView> {
        page(limit);
        let end = start.saturating_add(limit).min(self.provider_ids.len());
        (start..end)
            .filter_map(|i| self.provider_ids.get(i))
            .filter_map(|id| self.providers.get(&id))
            .map(ProviderView::from)
            .collect()
    }
    pub fn list_providers(&self, start: u64, limit: u64) -> Vec<ProviderView> {
        self.get_providers(start, limit)
    }
    pub fn get_offers(&self, start: u64, limit: u64) -> Vec<OfferView> {
        page(limit);
        let end = start.saturating_add(limit).min(self.next_offer_id);
        (start..end)
            .filter_map(|i| self.offers.get(&i))
            .map(OfferView::from)
            .collect()
    }
    pub fn list_offers(&self, start: u64, limit: u64) -> Vec<OfferView> {
        self.get_offers(start, limit)
    }
    pub fn get_orders(&self, start: u64, limit: u64) -> Vec<OrderView> {
        page(limit);
        let end = start.saturating_add(limit).min(self.next_order_id);
        (start..end)
            .filter_map(|i| self.orders.get(&i))
            .map(|o| self.order_view(o))
            .collect()
    }
    pub fn list_orders(&self, start: u64, limit: u64) -> Vec<OrderView> {
        self.get_orders(start, limit)
    }
    pub fn get_provider_count(&self) -> u64 {
        self.provider_ids.len()
    }
    pub fn get_offer_count(&self) -> u64 {
        self.next_offer_id
    }
    pub fn get_order_count(&self) -> u64 {
        self.next_order_id
    }
    pub fn get_audit_events(&self, start: u64, limit: u64) -> Vec<AuditEventView> {
        page(limit);
        let end = start.saturating_add(limit).min(self.audit_events.len());
        (start..end)
            .filter_map(|i| self.audit_events.get(i))
            .map(AuditEventView::from)
            .collect()
    }

    fn order_view(&self, o: Order) -> OrderView {
        let mut view = OrderView::from(o.clone());
        view.appeal_status = self.appeal_status_for(&o);
        view
    }

    fn appeal_status_for(&self, o: &Order) -> AppealStatus {
        for i in (0..self.audit_events.len()).rev() {
            if let Some(event) = self.audit_events.get(i) {
                if event.order_id != Some(o.id) {
                    continue;
                }
                match event.kind.as_str() {
                    "appeal_overturned" => return AppealStatus::Overturned,
                    "appeal_upheld" => return AppealStatus::Upheld,
                    "appeal_submitted" => return AppealStatus::Pending,
                    _ => continue,
                }
            }
        }
        AppealStatus::None
    }

    fn assert_owner(&self) {
        assert_eq!(
            env::predecessor_account_id(),
            self.owner_id,
            "Only the owner may configure roles"
        );
    }
    fn assert_governance(&self) {
        assert_eq!(
            self.governance_signer.as_ref(),
            Some(&env::predecessor_account_id()),
            "Only governance may update policy"
        );
    }
    fn distinct(&self, id: &AccountId) {
        assert!(
            id != &self.owner_id
                && self.auditor_id.as_ref() != Some(id)
                && self.guardian_id.as_ref() != Some(id)
                && self.governance_signer.as_ref() != Some(id),
            "Roles must use distinct accounts"
        );
    }
    fn provider(&self, id: &AccountId) -> Provider {
        self.providers
            .get(id)
            .unwrap_or_else(|| env::panic_str("The provider is not registered"))
    }
    fn offer(&self, id: u64) -> Offer {
        self.offers
            .get(&id)
            .unwrap_or_else(|| env::panic_str("The offer does not exist"))
    }
    fn order(&self, id: u64) -> Order {
        self.orders
            .get(&id)
            .unwrap_or_else(|| env::panic_str("The order does not exist"))
    }
    fn window(&self, p: &ReputationProfile) -> u64 {
        match p {
            ReputationProfile::Demo => self.policy.demo_appeal_window_ns,
            ReputationProfile::Production => self.policy.production_appeal_window_ns,
        }
    }
    fn escalated(&self, o: &Order) -> bool {
        let verdict = o.verdict.as_ref().expect("A verdict is required");
        let potential_slash = if verdict.passed {
            o.slash_amount
        } else {
            o.slash_amount.max(o.reserved_bond)
        };
        potential_slash > self.policy.large_slash_threshold
            || verdict.confidence < self.policy.low_confidence_threshold
    }
    fn release(&mut self, id: &AccountId, n: u128) {
        let mut p = self.provider(id);
        assert!(p.reserved_bond >= n, "Reservation underflow");
        p.reserved_bond -= n;
        self.providers.insert(id, &p);
    }
    fn refund(&mut self, o: &mut Order, status: OrderStatus, detail: &str) {
        self.release(&o.provider_id, o.reserved_bond);
        o.reserved_bond = 0;
        o.status = status;
        self.orders.insert(&o.id, o);
        Promise::new(o.buyer_id.clone()).transfer(NearToken::from_yoctonear(o.amount));
        self.event(
            "escrow_refunded",
            Some(o.id),
            &env::predecessor_account_id(),
            detail,
        );
    }
    fn overturn(&mut self, o: &mut Order, detail: &str) {
        let pending = share10(o.slash_amount);
        self.insurance_pool = self
            .insurance_pool
            .checked_add(pending)
            .expect("Insurance overflow");
        self.penalize(&o.auditor_id, self.policy.auditor_reversal_penalty);
        let n = self
            .overturned_appeals
            .get(&o.auditor_id)
            .unwrap_or(0)
            .checked_add(1)
            .expect("Appeal count overflow");
        self.overturned_appeals.insert(&o.auditor_id, &n);
        self.release(&o.provider_id, o.reserved_bond);
        o.reserved_bond = 0;
        o.status = OrderStatus::Refunded;
        self.orders.insert(&o.id, o);
        Promise::new(o.buyer_id.clone()).transfer(NearToken::from_yoctonear(o.amount));
        self.event(
            "appeal_overturned",
            Some(o.id),
            &env::predecessor_account_id(),
            detail,
        );
    }
    fn penalize(&mut self, id: &AccountId, n: u8) {
        let p = self
            .auditor_penalties
            .get(id)
            .unwrap_or(0)
            .checked_add(u16::from(n))
            .expect("Penalty overflow");
        self.auditor_penalties.insert(id, &p);
    }
    fn claim(&mut self, o: &Order) {
        let k = format!("{}|{}", o.provider_id, o.buyer_id);
        let now = env::block_timestamp();
        let mut c = self.claims.get(&k).unwrap_or(ClaimWindow {
            started_at: now,
            count: 0,
        });
        if now.saturating_sub(c.started_at) >= self.policy.claims_window_ns {
            c = ClaimWindow {
                started_at: now,
                count: 0,
            };
        }
        assert!(
            c.count < self.policy.max_claims_per_pair,
            "The slash claim cap for this pair has been reached"
        );
        c.count = c.count.checked_add(1).expect("Claim count overflow");
        self.claims.insert(&k, &c);
    }
    fn event(&mut self, k: &str, id: Option<u64>, actor: &AccountId, detail: &str) {
        let e = AuditEvent {
            sequence: self.next_event_id,
            kind: k.to_string(),
            actor: actor.clone(),
            order_id: id,
            timestamp: env::block_timestamp(),
            details: detail.to_string(),
        };
        self.next_event_id = self
            .next_event_id
            .checked_add(1)
            .expect("Event ID overflow");
        self.audit_events.push(&e);
        env::log_str(&format!(
            "EVENT_JSON:{}",
            near_sdk::serde_json::to_string(&e).expect("Event serialization failed")
        ));
    }
}

fn validate(v: &str, name: &str, max: usize) {
    assert!(!v.trim().is_empty(), "{name} must not be empty");
    assert!(v.len() <= max, "{name} is too long");
}
fn page(n: u64) {
    assert!(n <= MAX_PAGE, "Page size exceeds the view limit");
}
fn ratio(r: u8, p: &Policy) -> u128 {
    BP.saturating_sub(u128::from(r) * u128::from(p.bond_discount_bps_per_point))
        .max(u128::from(p.minimum_bond_ratio_bps))
}
fn required(a: u128, r: u8, p: &Policy) -> u128 {
    a.checked_mul(ratio(r, p))
        .expect("Bond requirement overflow")
        .checked_add(BP - 1)
        .expect("Bond requirement overflow")
        / BP
}
fn share10(a: u128) -> u128 {
    a.checked_mul(10).expect("Distribution overflow") / 100
}

fn appeal_status(o: &Order) -> AppealStatus {
    if o.status == OrderStatus::Appealed {
        AppealStatus::Pending
    } else if !o.appeal_resolved {
        AppealStatus::None
    } else if o.status == OrderStatus::AppealWindow {
        AppealStatus::Upheld
    } else {
        AppealStatus::Overturned
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::{testing_env, NearToken};
    fn c(who: AccountId, dep: u128, t: u64) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id(accounts(0));
        b.predecessor_account_id(who);
        b.attached_deposit(NearToken::from_yoctonear(dep));
        b.block_timestamp(t);
        b
    }
    fn setup() -> BondVault {
        testing_env!(c(accounts(1), 0, 1).build());
        let mut x = BondVault::new();
        testing_env!(c(accounts(1), 0, 2).build());
        x.set_auditor(accounts(2));
        x.set_guardian(accounts(3));
        x.add_governance_signer(accounts(4));
        x
    }
    fn make(x: &mut BondVault, n: u128, sla: u64) -> u64 {
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 3).build());
        x.register_provider();
        testing_env!(c("provider.testnet".parse().unwrap(), n, 4).build());
        x.deposit_bond();
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 5).build());
        let f = x.create_offer(
            "service".into(),
            U128(n),
            "sla".into(),
            U64(sla),
            "criteria".into(),
            U128(n),
        );
        testing_env!(c("buyer.testnet".parse().unwrap(), n, 6).build());
        x.lock_escrow(f, "specification".into())
    }
    #[test]
    fn reservation_and_success_release() {
        let mut x = setup();
        let id = make(&mut x, 2_000, 100);
        assert_eq!(
            x.get_provider("provider.testnet".parse().unwrap())
                .unwrap()
                .reserved_bond
                .0,
            2_000
        );
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 7).build());
        x.submit_work(id, "result".into());
        testing_env!(c(accounts(2), 0, 8).build());
        x.record_verdict(id, true, 95, "reason".into(), "evidence".into());
        testing_env!(c(accounts(3), 0, 9).build());
        x.guardian_decide(id, true);
        testing_env!(c(accounts(5), 0, 10).build());
        x.finalize_success(id);
        assert_eq!(x.get_order(id).unwrap().status, OrderStatus::Released);
        assert_eq!(
            x.get_provider("provider.testnet".parse().unwrap())
                .unwrap()
                .reputation,
            10
        );
    }
    #[test]
    fn failure_distribution_and_appeal_overturn() {
        let mut x = setup();
        let id = make(&mut x, 2_000, 100);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 7).build());
        x.submit_work(id, "bad".into());
        testing_env!(c(accounts(2), 0, 8).build());
        x.record_verdict(id, false, 95, "reason".into(), "evidence".into());
        testing_env!(c(accounts(3), 0, 9).build());
        x.guardian_decide(id, true);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 10).build());
        x.appeal(id, "appeal".into());
        testing_env!(c(accounts(4), 0, 11).build());
        x.resolve_appeal(id, false);
        assert_eq!(x.get_order(id).unwrap().status, OrderStatus::Refunded);
        assert!(x.get_order(id).unwrap().appeal_resolved);
        assert_eq!(
            x.get_order(id).unwrap().appeal_status,
            AppealStatus::Overturned
        );
        assert_eq!(x.get_insurance_pool().0, 200);
        assert_eq!(x.get_auditor_penalty_state(accounts(2)).penalty_points, 20);
    }

    #[test]
    fn upheld_appeal_marks_resolution_without_refunding() {
        let mut x = setup();
        let id = make(&mut x, 2_000, 100);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 7).build());
        x.submit_work(id, "bad".into());
        testing_env!(c(accounts(2), 0, 8).build());
        x.record_verdict(id, false, 95, "reason".into(), "evidence".into());
        testing_env!(c(accounts(3), 0, 9).build());
        x.guardian_decide(id, true);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 10).build());
        x.appeal(id, "appeal".into());
        testing_env!(c(accounts(4), 0, 11).build());
        x.resolve_appeal(id, true);
        let order = x.get_order(id).unwrap();
        assert_eq!(order.status, OrderStatus::AppealWindow);
        assert!(order.appeal_resolved);
        assert!(order.approvals.governance);
        assert_eq!(order.appeal_status, AppealStatus::Upheld);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 12).build());
        x.finalize_failure(id);
        let finalized = x.get_order(id).unwrap();
        assert_eq!(finalized.status, OrderStatus::Slashed);
        assert_eq!(finalized.appeal_status, AppealStatus::Upheld);
    }
    #[test]
    fn sla_refund_penalizes_without_slash() {
        let mut x = setup();
        let id = make(&mut x, 2_000, 10);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 20).build());
        x.refund_after_sla(id);
        assert_eq!(x.get_order(id).unwrap().status, OrderStatus::Refunded);
        assert_eq!(
            x.get_provider("provider.testnet".parse().unwrap())
                .unwrap()
                .reputation,
            0
        );
        assert_eq!(x.get_insurance_pool().0, 0);
    }
    #[test]
    fn low_confidence_success_requires_governance_and_auditor_votes() {
        let mut x = setup();
        let id = make(&mut x, 2_000, 100);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 7).build());
        x.submit_work(id, "result".into());
        testing_env!(c(accounts(2), 0, 8).build());
        x.record_verdict(id, true, 79, "low confidence".into(), "evidence".into());
        testing_env!(c(accounts(4), 0, 9).build());
        x.governance_approve(id, true);
        testing_env!(c(accounts(5), 0, 10).build());
        x.finalize_success(id);
        assert_eq!(x.get_order(id).unwrap().status, OrderStatus::Released);
    }
    #[test]
    fn escalated_large_slash_uses_auditor_and_governance_as_two_of_three() {
        let mut x = setup();
        let amount = 10 * NEAR + 1;
        let id = make(&mut x, amount, 100);
        testing_env!(c("provider.testnet".parse().unwrap(), 0, 7).build());
        x.submit_work(id, "bad result".into());
        testing_env!(c(accounts(2), 0, 8).build());
        x.record_verdict(id, false, 95, "criteria failed".into(), "evidence".into());
        testing_env!(c(accounts(4), 0, 9).build());
        x.governance_approve(id, true);
        let deadline = x.get_order(id).unwrap().appeal_deadline.unwrap().0;
        testing_env!(c(accounts(5), 0, deadline).build());
        x.finalize_failure(id);
        assert_eq!(x.get_order(id).unwrap().status, OrderStatus::Slashed);
        assert_eq!(x.get_insurance_pool().0, amount * 20 / 100);
        assert_eq!(
            x.get_auditor_rewards(accounts(2)).0 + amount * 70 / 100 + amount * 20 / 100,
            amount
        );
        assert_eq!(
            x.get_provider("provider.testnet".parse().unwrap())
                .unwrap()
                .bond,
            U128(0)
        );
    }
    #[test]
    fn policy_requires_governance() {
        let mut x = setup();
        testing_env!(c(accounts(1), 0, 2).build());
        let r = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            x.set_policy(
                80,
                U128(1),
                U64(1),
                U64(1),
                ReputationProfile::Demo,
                10,
                2,
                30,
                10,
                20,
                3,
                U64(1),
                75,
                2500,
            )
        }));
        assert!(r.is_err());
    }
}
