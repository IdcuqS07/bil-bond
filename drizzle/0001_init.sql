CREATE TABLE IF NOT EXISTS providers (
  id VARCHAR(80) PRIMARY KEY,
  account_id VARCHAR(64) NOT NULL UNIQUE,
  display_name VARCHAR(160) NOT NULL,
  persona VARCHAR(32) NOT NULL,
  reputation INT NOT NULL DEFAULT 70,
  bond_yocto VARCHAR(80) NOT NULL DEFAULT '0',
  bond_ratio_percent INT NOT NULL DEFAULT 100,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS offers (
  id VARCHAR(80) PRIMARY KEY,
  provider_id VARCHAR(80) NOT NULL,
  title VARCHAR(180) NOT NULL,
  service_type VARCHAR(80) NOT NULL,
  price_yocto VARCHAR(80) NOT NULL,
  sla VARCHAR(255) NOT NULL,
  criteria JSON NOT NULL,
  max_contract_yocto VARCHAR(80) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX offers_provider_id_idx (provider_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(80) PRIMARY KEY,
  offer_id VARCHAR(80) NOT NULL,
  buyer_account_id VARCHAR(64) NOT NULL,
  provider_account_id VARCHAR(64) NOT NULL,
  amount_yocto VARCHAR(80) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'draft',
  scenario VARCHAR(32) NOT NULL DEFAULT 'standard',
  specification TEXT NOT NULL,
  appeal_until TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX orders_status_created_idx (status, created_at)
);

CREATE TABLE IF NOT EXISTS verdicts (
  id VARCHAR(80) PRIMARY KEY,
  order_id VARCHAR(80) NOT NULL,
  auditor_account_id VARCHAR(64) NOT NULL,
  passed BOOLEAN NOT NULL,
  confidence INT NOT NULL,
  reasons JSON NOT NULL,
  evidence JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX verdicts_order_created_idx (order_id, created_at)
);

CREATE TABLE IF NOT EXISTS decisions (
  id VARCHAR(80) PRIMARY KEY,
  order_id VARCHAR(80) NOT NULL,
  actor_account_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  decision VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX decisions_order_created_idx (order_id, created_at)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id VARCHAR(80) PRIMARY KEY,
  order_id VARCHAR(80) NULL,
  actor_account_id VARCHAR(64) NOT NULL,
  actor_role VARCHAR(32) NOT NULL,
  event_type VARCHAR(80) NOT NULL,
  summary VARCHAR(500) NOT NULL,
  details JSON NULL,
  tx_hash VARCHAR(128) NULL,
  network VARCHAR(16) NOT NULL DEFAULT 'testnet',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX audit_events_order_created_idx (order_id, created_at)
);

CREATE TABLE IF NOT EXISTS chain_transactions (
  tx_hash VARCHAR(128) PRIMARY KEY,
  order_id VARCHAR(80) NULL,
  signer_account_id VARCHAR(64) NOT NULL,
  receiver_account_id VARCHAR(64) NOT NULL,
  action VARCHAR(80) NOT NULL,
  status VARCHAR(32) NOT NULL,
  network VARCHAR(16) NOT NULL DEFAULT 'testnet',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX chain_transactions_order_created_idx (order_id, created_at)
);
