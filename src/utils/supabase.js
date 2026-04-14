import { createClient } from '@supabase/supabase-js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const noOpLock = async (_name, _timeout, fn) => await fn()

const authOptions = {
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: true,
  lock: noOpLock,
}

export const isReady = Boolean(URL && KEY)

export const supabase = isReady
  ? createClient(URL, KEY, { auth: authOptions })
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        getUser: async () => ({ data: { user: null }, error: null }),
        signOut: async () => ({ error: null }),
        updateUser: async () => ({ data: { user: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      from: () => ({
        select: () => ({ data: null, error: 'not configured' }),
        insert: () => ({ error: 'not configured' }),
        upsert: () => ({ error: 'not configured' }),
        update: () => ({ error: 'not configured' }),
        delete: () => ({ error: 'not configured' }),
        eq: () => ({ data: null, error: 'not configured' }),
      }),
      rpc: () => ({ data: null, error: 'not configured' }),
    }
