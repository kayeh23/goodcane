CREATE TABLE IF NOT EXISTS app_meta (
  id integer PRIMARY KEY,
  version integer NOT NULL,
  seeded_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id text PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  reminders_opt_in boolean NOT NULL DEFAULT false,
  reminders_opt_in_at text,
  created_at text NOT NULL,
  sample boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_idx ON customers (phone);

CREATE TABLE IF NOT EXISTS standing_orders (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  items_json jsonb NOT NULL,
  fulfilment_json jsonb NOT NULL,
  status text NOT NULL,
  start_batch text NOT NULL,
  skip_batches jsonb NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  sample boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS orders (
  id text PRIMARY KEY,
  code text NOT NULL,
  customer_id text NOT NULL REFERENCES customers (id),
  batch_date text NOT NULL,
  items_json jsonb NOT NULL,
  fulfilment_json jsonb NOT NULL,
  status text NOT NULL,
  source text NOT NULL,
  total integer NOT NULL,
  standing_order_id text REFERENCES standing_orders (id),
  reminder_id text,
  cancelled_by text,
  cancel_reason text,
  created_at text NOT NULL,
  events_json jsonb NOT NULL,
  notified_at text,
  sample boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_code_idx ON orders (code);
CREATE INDEX IF NOT EXISTS orders_batch_date_idx ON orders (batch_date);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);

CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY,
  customer_id text NOT NULL REFERENCES customers (id),
  batch_date text NOT NULL,
  based_on_order_id text NOT NULL,
  message text NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  decided_at text,
  opened_at text,
  sample boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS forecasts (
  batch_date text PRIMARY KEY,
  standing_units integer NOT NULL,
  one_off_units integer NOT NULL,
  total_units integer NOT NULL,
  method text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_users (
  id text PRIMARY KEY,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS staff_users_username_idx ON staff_users (username);
