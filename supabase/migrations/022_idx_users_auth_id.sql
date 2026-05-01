-- ═══════════════════════════════════════════════════════════════════════════
-- 022 — Index on users.auth_id (RLS performance critical)
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem:
--   Every RLS policy that references auth.uid() triggers a query against
--   public.users (e.g., is_store_owner, users_update_own, etc.).
--   Without an index on auth_id, Postgres performs a sequential scan on
--   every request — O(N) where N = number of users.
--
-- Impact:
--   Currently negligible (few users), but at 50 stores × 10k scans/day
--   (~6M scans/year) this becomes a bottleneck because each scan may
--   trigger 2–3 RLS checks that hit users.
--
-- Fix:
--   B-tree index on auth_id (UUID) — O(log N) lookups.
--
-- Properties:
--   • Unique is NOT enforced here (auth_id is already unique by business
--     logic via upsert onConflict, but we keep it non-unique for safety).
--   • Idempotent — IF NOT EXISTS.
--
-- Apply: Supabase SQL Editor as service_role.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_auth_id
  ON public.users (auth_id);

-- Verify:
--   SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'users';
--   Should show idx_users_auth_id.
