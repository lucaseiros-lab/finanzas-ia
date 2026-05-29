-- ── Profiles (extends auth.users) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         text NOT NULL,
  full_name     text,
  role          text NOT NULL DEFAULT 'user'    CHECK (role IN ('super_admin','admin','user')),
  status        text NOT NULL DEFAULT 'active'  CHECK (status IN ('active','suspended','pending')),
  plan          text NOT NULL DEFAULT 'free'    CHECK (plan IN ('free','basic','pro','enterprise')),
  plan_expires_at timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Invitations ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invitations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  code          text NOT NULL UNIQUE DEFAULT substring(md5(random()::text) from 1 for 12),
  plan          text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','basic','pro','enterprise')),
  invited_by    uuid REFERENCES profiles(id),
  used_by       uuid REFERENCES profiles(id),
  used_at       timestamptz,
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Subscriptions (historial de pagos/planes) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan          text NOT NULL CHECK (plan IN ('free','basic','pro','enterprise')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled','expired','pending')),
  amount_ars    numeric(12,2),
  payment_ref   text,                -- referencia externa (MercadoPago, Stripe, etc.)
  started_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: each user sees only themselves; admins see all
CREATE POLICY "profiles_self" ON profiles FOR ALL TO authenticated
  USING (id = auth.uid());

-- Invitations: only admins manage (enforced in API via service role)
CREATE POLICY "invitations_admin" ON invitations FOR ALL TO authenticated
  USING (false); -- blocked for regular users; API uses service role

-- Subscriptions: user sees own
CREATE POLICY "subscriptions_self" ON subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ── Set super_admin for lucaseiros@gmail.com ──────────────────────────────────
INSERT INTO profiles (id, email, full_name, role, plan)
SELECT id, email, split_part(email,'@',1), 'super_admin', 'enterprise'
FROM auth.users WHERE email = 'lucaseiros@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin', plan = 'enterprise';