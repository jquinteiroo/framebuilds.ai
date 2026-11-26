CREATE TABLE IF NOT EXISTS commerce_orders (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode IN ('test', 'production')),
  attempt_id uuid NOT NULL,
  package_id text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL CHECK (currency = 'BRL'),
  seller_id text NOT NULL,
  reference text NOT NULL UNIQUE,
  asset jsonb NOT NULL,
  checkout_state text NOT NULL DEFAULT 'new' CHECK (checkout_state IN ('new', 'creating', 'uncertain', 'ready')),
  checkout_lease uuid,
  checkout_lease_until timestamptz,
  preference_id text UNIQUE,
  checkout_url text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'failed', 'refunded', 'disputed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  UNIQUE (mode, attempt_id)
);
CREATE TABLE IF NOT EXISTS commerce_payments (
  id text PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES commerce_orders(id),
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'failed', 'refunded', 'disputed')),
  provider_updated_at timestamptz NOT NULL,
  observed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS commerce_events (
  id text PRIMARY KEY,
  payment_id text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  lease_until timestamptz,
  claim_id uuid,
  completed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS commerce_events_pending ON commerce_events(available_at) WHERE completed_at IS NULL;
CREATE INDEX IF NOT EXISTS commerce_payments_order ON commerce_payments(order_id);
