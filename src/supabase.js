import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// A request that stalls should end in an error, never a spinner that never stops.
const REQUEST_TIMEOUT_MS = 30000
const timeoutFetch = (input, init = {}) => {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), REQUEST_TIMEOUT_MS)
  return fetch(input, { ...init, signal: ctl.signal }).finally(() => clearTimeout(timer))
}

// Auth-only client. Plan data stays in localStorage; Supabase never sees it.
// Null until the env vars are configured, so the app can say what is missing.
export const supabase = url && anonKey ? createClient(url, anonKey, { global: { fetch: timeoutFetch } }) : null

// Supabase replies in ~0.2s once connected, but the first request to a distant region can
// spend seconds on the TCP+TLS handshake. Warming it while the user types hides that cost.
export const warmAuth = () => {
  if (!supabase) return
  fetch(`${url}/auth/v1/health`, { headers: { apikey: anonKey }, cache: 'no-store' }).catch(() => {})
}

// Maps Supabase auth errors to wording that fits this app's tone.
export const authMsg = (e) => {
  const m = (e?.message || '').toLowerCase()
  if (m.includes('abort') || m.includes('timed out')) return 'That took too long. Check your connection and try again.'
  if (m.includes('failed to fetch') || m.includes('network') || m.includes('load failed') || m.includes('fetch'))
    return 'Could not reach the auth service. Check your connection and that the project URL is right.'
  if (m.includes('invalid login')) return 'That email or password is not right.'
  if (m.includes('email not confirmed')) return 'Confirm your email first, or turn off email confirmation in Supabase.'
  if (m.includes('already registered')) return 'That email already has an account. Try signing in.'
  if (m.includes('invalid email')) return 'That email address does not look right.'
  if (m.includes('password should be at least')) return 'Passwords need at least 6 characters.'
  if (m.includes('rate limit') || m.includes('over email')) return 'Too many attempts. Wait a minute and try again.'
  return e?.message || 'Something went wrong. Try again.'
}
