import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isReady = Boolean(URL && KEY)

export const supabase = isReady 
  ? createClient(URL, KEY)
  : { 
      from: () => ({
        select: () => ({ data: null, error: 'not configured' }),
        insert: () => ({ error: 'not configured' }),
        upsert: () => ({ error: 'not configured' })
      })
    }
