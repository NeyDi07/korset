-- ═══════════════════════════════════════════════════════════════════════════
-- 023 — Fix SECURITY DEFINER on analytics views (Supabase Security Advisor)
-- ═══════════════════════════════════════════════════════════════════════════
-- Problem:
--   Supabase Security Advisor flagged 4 views created with SECURITY DEFINER:
--   store_top_scans, store_missing_unresolved, product_rating_summary,
--   store_week_summary.
--
--   SECURITY DEFINER means the view executes base-table queries with the
--   privileges of the view creator (postgres/service_role), NOT the caller.
--   This bypasses RLS policies of the base tables if the creator has
--   superuser/service_role rights.
--
-- Risk assessment for Körset:
--   • store_top_scans      → reads scan_events (public) + global_products (public)
--   • store_missing_unresolved → reads missing_products (no PII, only client_token)
--   • product_rating_summary   → reads product_reviews (aggregate only, no user_id)
--   • store_week_summary       → reads scan_events (public aggregate)
--   None of these views read users/stores/billing — current risk is LOW.
--   However, SECURITY DEFINER is unsafe for future modifications (someone
--   could JOIN users and leak data). We fix proactively.
--
-- Fix:
--   PostgreSQL 15+ supports ALTER VIEW ... SET (security_invoker = on).
--   This forces the view to evaluate RLS/policies with the CALLER's
--   privileges — exactly what we want for analytics views on public data.
--
--   If PG < 15, this ALTER will error — fallback is manual recreation.
--   Supabase currently runs PG 15 (as of 2024), so ALTER is safe.
--
-- Apply: Supabase SQL Editor as service_role.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- Ignore errors if a view does not exist (defensive)
  BEGIN
    ALTER VIEW public.store_top_scans SET (security_invoker = on);
  EXCEPTION WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'store_top_scans not found, skipping';
  END;

  BEGIN
    ALTER VIEW public.store_missing_unresolved SET (security_invoker = on);
  EXCEPTION WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'store_missing_unresolved not found, skipping';
  END;

  BEGIN
    ALTER VIEW public.product_rating_summary SET (security_invoker = on);
  EXCEPTION WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'product_rating_summary not found, skipping';
  END;

  BEGIN
    ALTER VIEW public.store_week_summary SET (security_invoker = on);
  EXCEPTION WHEN undefined_table OR undefined_object THEN
    RAISE NOTICE 'store_week_summary not found, skipping';
  END;
END $$;

-- Verify (should return 't' for each view):
--   SELECT relname, reloptions
--   FROM pg_class
--   WHERE relname IN ('store_top_scans','store_missing_unresolved',
--                     'product_rating_summary','store_week_summary');
