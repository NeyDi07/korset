-- Migration: add notification preferences to stores table
-- Run this in Supabase SQL Editor

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS notify_oos_enabled  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_daily_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS description          text;
