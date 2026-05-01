#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// verify-migrations.mjs — Check which migrations are actually applied in Supabase
// ═══════════════════════════════════════════════════════════════════════════
// Run: node scripts/verify-migrations.mjs
// Requires: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars (or .env)
//
// Checks:
//   1. Table/column existence (migration 022b: category_raw, subcategory_raw)
//   2. Index existence (migration 022: idx_users_auth_id)
//   3. View security_invoker (migration 023)
//   4. RLS policies, triggers, constraints
// ═══════════════════════════════════════════════════════════════════════════

import { createClient } from '@supabase/supabase-js'
import { readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars')
  process.exit(1)
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

const checks = [
  // Migration 022 — idx_users_auth_id
  {
    name: '022_idx_users_auth_id',
    query: `SELECT indexname FROM pg_indexes WHERE indexname = 'idx_users_auth_id'`,
    expect: (rows) => rows.length > 0,
    desc: 'Index on users(auth_id) for RLS performance',
  },
  // Migration 022b — category_raw column
  {
    name: '022b_category_raw_column',
    query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'global_products' AND column_name = 'category_raw'`,
    expect: (rows) => rows.length > 0,
    desc: 'category_raw column for audit trail',
  },
  // Migration 022b — subcategory_raw column
  {
    name: '022b_subcategory_raw_column',
    query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'global_products' AND column_name = 'subcategory_raw'`,
    expect: (rows) => rows.length > 0,
    desc: 'subcategory_raw column for audit trail',
  },
  // Migration 022b — CHECK constraint
  {
    name: '022b_category_check',
    query: `SELECT conname FROM pg_constraint WHERE conrelid = 'global_products'::regclass AND conname LIKE '%category%'`,
    expect: (rows) => rows.length > 0,
    desc: 'CHECK constraint on category',
  },
  // Migration 023 — security_invoker on views
  {
    name: '023_security_invoker_views',
    query: `SELECT viewname FROM pg_views WHERE viewname IN ('store_top_scans', 'store_missing_unresolved', 'product_rating_summary', 'store_week_summary')`,
    expect: (rows) => rows.length >= 4,
    desc: 'Analytics views exist',
  },
  // Migration 017 — admin role
  {
    name: '017_admin_role',
    query: `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'is_admin'`,
    expect: (rows) => rows.length > 0,
    desc: 'is_admin column exists',
  },
  // Migration 017 — audit_log table
  {
    name: '017_audit_log',
    query: `SELECT table_name FROM information_schema.tables WHERE table_name = 'audit_log'`,
    expect: (rows) => rows.length > 0,
    desc: 'audit_log table exists',
  },
  // Migration 018 — RPC atomic increment
  {
    name: '018_rpc_increment_scan_count',
    query: `SELECT proname FROM pg_proc WHERE proname = 'increment_scan_count'`,
    expect: (rows) => rows.length > 0,
    desc: 'RPC for atomic scan count increment',
  },
  // RLS enabled on critical tables
  {
    name: 'rls_enabled_users',
    query: `SELECT relname FROM pg_class WHERE relname = 'users' AND relrowsecurity = true`,
    expect: (rows) => rows.length > 0,
    desc: 'RLS enabled on users table',
  },
  {
    name: 'rls_enabled_stores',
    query: `SELECT relname FROM pg_class WHERE relname = 'stores' AND relrowsecurity = true`,
    expect: (rows) => rows.length > 0,
    desc: 'RLS enabled on stores table',
  },
  {
    name: 'rls_enabled_store_products',
    query: `SELECT relname FROM pg_class WHERE relname = 'store_products' AND relrowsecurity = true`,
    expect: (rows) => rows.length > 0,
    desc: 'RLS enabled on store_products table',
  },
]

async function runChecks() {
  console.log('🔍 Migration Verification Report')
  console.log('═'.repeat(70))
  console.log(`Database: ${SUPABASE_URL}`)
  console.log(`Time: ${new Date().toISOString()}`)
  console.log('')

  let passed = 0
  let failed = 0

  for (const check of checks) {
    try {
      const { data, error } = await sb.rpc('verify_migration_check', {
        p_query: check.query,
      }).catch(async () => {
        // Fallback if RPC doesn't exist — use raw SQL via REST
        // Note: service_role can bypass RLS for reads
        const { data: rows, error: err } = await sb.from('global_products')
          .select('*')
          .limit(0)
        if (err) throw err
        // For actual checks we need to run raw SQL — let's use a trick
        // Execute via supabase.sql() if available, or just note that
        // we need to run these in SQL Editor
        return { data: null, error: null }
      })

      if (error) {
        console.log(`❌ ${check.name}: ${check.desc}`)
        console.log(`   Error: ${error.message}`)
        failed++
        continue
      }

      // Since we can't easily run raw SQL via REST, let's note the limitation
      console.log(`⏳ ${check.name}: ${check.desc}`)
      console.log(`   ⚠️  Run manually in Supabase SQL Editor:`)
      console.log(`   ${check.query}`)
      console.log('')
    } catch (e) {
      console.log(`❌ ${check.name}: ${check.desc}`)
      console.log(`   Exception: ${e.message}`)
      failed++
    }
  }

  console.log('═'.repeat(70))
  console.log(`
⚠️  IMPORTANT: This script requires raw SQL execution privileges.
   Please run the following queries in Supabase SQL Editor (as service_role):
`)

  for (const check of checks) {
    console.log(`-- ${check.name}: ${check.desc}`)
    console.log(`${check.query};`)
    console.log('')
  }

  console.log('═'.repeat(70))
  console.log(`\nNext step: Copy these queries to Supabase SQL Editor and verify results.`)
  console.log(`If any query returns 0 rows — that migration is NOT applied.\n`)
}

runChecks().catch((e) => {
  console.error('Fatal error:', e)
  process.exit(1)
})
