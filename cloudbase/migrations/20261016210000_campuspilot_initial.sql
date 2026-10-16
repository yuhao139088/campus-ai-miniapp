-- CampusPilot PostgreSQL schema. New tables inspected as absent before apply.

-- All application access is through the authenticated Node server.

-- API service key bypasses RLS; never expose it to clients.

CREATE TABLE public.users (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX users_user_id_idx ON public.users(user_id);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users FROM anon, authenticated;
GRANT ALL ON public.users TO service_role;

CREATE TABLE public.service_items (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_items_user_id_idx ON public.service_items(user_id);
ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_items FROM anon, authenticated;
GRANT ALL ON public.service_items TO service_role;

CREATE TABLE public.campus_documents (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX campus_documents_user_id_idx ON public.campus_documents(user_id);
ALTER TABLE public.campus_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.campus_documents FROM anon, authenticated;
GRANT ALL ON public.campus_documents TO service_role;

CREATE TABLE public.conversations (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversations_user_id_idx ON public.conversations(user_id);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM anon, authenticated;
GRANT ALL ON public.conversations TO service_role;

CREATE TABLE public.agent_runs (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX agent_runs_user_id_idx ON public.agent_runs(user_id);
ALTER TABLE public.agent_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.agent_runs FROM anon, authenticated;
GRANT ALL ON public.agent_runs TO service_role;

CREATE TABLE public.ocr_records (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ocr_records_user_id_idx ON public.ocr_records(user_id);
ALTER TABLE public.ocr_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ocr_records FROM anon, authenticated;
GRANT ALL ON public.ocr_records TO service_role;

CREATE TABLE public.form_drafts (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX form_drafts_user_id_idx ON public.form_drafts(user_id);
ALTER TABLE public.form_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.form_drafts FROM anon, authenticated;
GRANT ALL ON public.form_drafts TO service_role;

CREATE TABLE public.tasks (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX tasks_user_id_idx ON public.tasks(user_id);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tasks FROM anon, authenticated;
GRANT ALL ON public.tasks TO service_role;

CREATE TABLE public.reminders (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reminders_user_id_idx ON public.reminders(user_id);
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reminders FROM anon, authenticated;
GRANT ALL ON public.reminders TO service_role;

CREATE TABLE public.audit_logs (
  id text PRIMARY KEY,
  user_id text,
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_user_id_idx ON public.audit_logs(user_id);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.audit_logs FROM anon, authenticated;
GRANT ALL ON public.audit_logs TO service_role;

CREATE INDEX tasks_service_idx ON public.tasks ((payload->>'serviceId'));

CREATE INDEX reminders_due_idx ON public.reminders ((payload->>'dueAt'));

CREATE INDEX campus_documents_service_idx ON public.campus_documents ((payload->>'serviceId'));

NOTIFY pgrst, 'reload schema';
