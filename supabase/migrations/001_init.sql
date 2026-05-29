-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Files table: tracks uploaded bank statement files
CREATE TABLE IF NOT EXISTS public.files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  bank TEXT,
  account_type TEXT, -- 'checking', 'savings', 'credit_card', 'wallet'
  status TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'done', 'error')),
  error_message TEXT,
  transaction_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table: normalized financial transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_id UUID REFERENCES public.files(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  merchant TEXT,
  amount DECIMAL(14,2) NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  category TEXT DEFAULT 'Otros',
  category_confirmed BOOLEAN DEFAULT FALSE,
  needs_review BOOLEAN DEFAULT FALSE,
  bank TEXT,
  account TEXT,
  card TEXT,
  installments INTEGER,
  installment_number INTEGER,
  balance DECIMAL(14,2),
  currency TEXT DEFAULT 'ARS',
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Learning table: user-specific pattern → category mappings
CREATE TABLE IF NOT EXISTS public.ai_learning (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  pattern TEXT NOT NULL,
  normalized_pattern TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence DECIMAL(4,3) DEFAULT 1.0,
  occurrences INTEGER DEFAULT 1,
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, normalized_pattern)
);

-- Indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(category);
CREATE INDEX idx_transactions_type ON public.transactions(type);
CREATE INDEX idx_transactions_needs_review ON public.transactions(needs_review) WHERE needs_review = true;
CREATE INDEX idx_ai_learning_user_pattern ON public.ai_learning(user_id, normalized_pattern);
CREATE INDEX idx_files_user_id ON public.files(user_id);

-- Row Level Security
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users only see their own data
CREATE POLICY "Users can CRUD own files" ON public.files
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can CRUD own learning" ON public.ai_learning
  FOR ALL USING (auth.uid() = user_id);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_files
  BEFORE UPDATE ON public.files
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_transactions
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_ai_learning
  BEFORE UPDATE ON public.ai_learning
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
