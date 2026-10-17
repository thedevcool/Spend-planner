import { useEffect, useRef, useState } from 'react'
import { supabase, authMsg, warmAuth } from './supabase.js'

const VERSION = 'v6'
const wantsGlance = () => new URLSearchParams(location.search).get('view') === 'glance'
const THEMES = [['aurora', 'Aurora'], ['mint', 'Mint'], ['citrus', 'Citrus'], ['orchid', 'Orchid']]
const KEY = 'spendplan.v1' // pre-account key, kept only to migrate old data once
const STEPS = ['Plan', 'List', 'Summary']
const SUBS = [
  'Name your plan, then add the money you will spend from.',
  'Rank each thing against the rest and see what you can cover.',
  'Here is where everything lands.',
]
const EMPTY = { plan: { name: '', type: 'month', month: '', start: '', end: '', currency: '₦' }, sources: [], items: [], notes: [], linkSources: true }
const NOTE_PERIODS = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year'], ['custom', 'Custom']]
const NOTE_DAYS = [['Today', 0], ['Yesterday', -1], ['Last week', -7]]

const keyFor = (uid) => `${KEY}.${uid}`
// Loads the signed-in account's plan. Data saved before accounts existed
// (plain KEY) is copied over once so nothing is lost on upgrade.
const loadFor = (uid) => {
  let raw = localStorage.getItem(keyFor(uid))
  if (raw == null) {
    raw = localStorage.getItem(KEY)
    if (raw != null) localStorage.setItem(keyFor(uid), raw)
  }
  try { return { ...EMPTY, ...JSON.parse(raw) } } catch { return EMPTY }
}
const uid = () => Math.random().toString(36).slice(2, 9)
const sum = (a) => a.reduce((t, x) => t + Number(x.amount || 0), 0)
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' }) : '')

const isoDay = (d) => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
const dayAgo = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDay(d) }

// Inclusive [from, to] ISO date range for a filter period. ISO strings compare
// lexicographically, so range checks stay plain string comparisons.
const noteRange = (mode, from, to) => {
  const n = new Date(), y = n.getFullYear(), m = n.getMonth(), d = n.getDate()
  const at = (yy, mm, dd) => isoDay(new Date(yy, mm, dd))
  if (mode === 'day') return [at(y, m, d), at(y, m, d)]
  if (mode === 'week') { const back = (n.getDay() + 6) % 7; return [at(y, m, d - back), at(y, m, d - back + 6)] }
  if (mode === 'month') return [at(y, m, 1), at(y, m + 1, 0)]
  if (mode === 'year') return [at(y, 0, 1), at(y, 11, 31)]
  return [from || '0000-01-01', to || '9999-12-31']
}
const noteLabel = (mode, r0, r1) => mode === 'day' ? (r0 === dayAgo(0) ? 'Today' : fmtDate(r0))
  : mode === 'week' ? 'This week'
    : mode === 'month' ? new Date(r0 + 'T00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' })
      : mode === 'year' ? r0.slice(0, 4)
        : `${fmtDate(r0)} – ${fmtDate(r1)}`
const noteDayLabel = (d) => d === dayAgo(0) ? 'Today' : d === dayAgo(-1) ? 'Yesterday' : d === dayAgo(-7) ? 'Last week' : fmtDate(d)

const Svg = ({ children, size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const ICONS = [
  <Svg key="p"><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></Svg>,
  <Svg key="l"><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" fill="currentColor" /><circle cx="4.5" cy="12" r="1" fill="currentColor" /><circle cx="4.5" cy="18" r="1" fill="currentColor" /></Svg>,
  <Svg key="s"><path d="M5 20v-9M12 20V5M19 20v-7" strokeWidth="2.6" /></Svg>,
]
const Chev = ({ left }) => <Svg size={18}><path d={left ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} strokeWidth="2.4" /></Svg>

function Num({ value, prefix = '' }) {
  const [v, setV] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current, end = value
    if (start === end || matchMedia('(prefers-reduced-motion: reduce)').matches) { setV(end); from.current = end; return }
    const t0 = performance.now(), d = 550
    let id
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / d)
      const cur = start + (end - start) * (1 - Math.pow(1 - p, 3))
      setV(cur); from.current = cur
      if (p < 1) id = requestAnimationFrame(tick); else from.current = end
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [value])
  const r = Math.round(v)
  return <>{r < 0 ? '-' : ''}{prefix}{Math.abs(r).toLocaleString()}</>
}

function Ring({ pct }) {
  const c = 2 * Math.PI * 34
  return (
    <div className="ring">
      <svg viewBox="0 0 80 80">
        <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style={{ stopColor: 'var(--a1)' }} /><stop offset="1" style={{ stopColor: 'var(--a2)' }} /></linearGradient></defs>
        <circle cx="40" cy="40" r="34" className="rt" />
        <circle cx="40" cy="40" r="34" className="rf" stroke="url(#rg)" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform="rotate(-90 40 40)" />
      </svg>
      <b><Num value={Math.round(pct)} />%</b>
    </div>
  )
}

function Confetti() {
  const bits = useRef(Array.from({ length: 34 }, (_, i) => ({ x: (Math.random() - .5) * 340, y: -(140 + Math.random() * 240), r: Math.random() * 720 - 360, d: Math.random() * .25, c: i % 3 }))).current
  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b, i) => <i key={i} className={'c' + b.c} style={{ '--x': b.x + 'px', '--y': b.y + 'px', '--r': b.r + 'deg', animationDelay: b.d + 's' }} />)}
    </div>
  )
}

const Bg = () => <div className="bg"><i /><i /><i /></div>

const money = (cur, v) => cur + Number(v).toLocaleString()
const Check = () => <Svg size={26}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" strokeWidth="2.2" /></Svg>

function WMedium({ w, onClick }) {
  const { plan, cur, left, total, over, stats } = w
  return (
    <button className="widget wm" onClick={onClick}>
      <div className="wl">
        <span className="wlab"><i className="wdot" />{plan.name || 'Spend Plan'}</span>
        <span className="wbig">{money(cur, Math.abs(left))}</span>
        <span className="wsub">{over ? 'over budget' : 'left to spend'}{total ? ' · of ' + money(cur, total) : ''}</span>
        <span className="wchips"><b className="chip ok">{stats.covered.length} covered</b>{stats.cut.length > 0 && <b className="chip bad">{stats.cut.length} short</b>}</span>
      </div>
      <Ring pct={stats.pct} />
    </button>
  )
}

function WSmalls({ w }) {
  const { cur, left, total, over, stats } = w
  const base = Math.max(total, stats.spent) || 1
  const next = stats.cut[0]
  return (
    <div className="wgrid">
      <div className="widget ws">
        <span className="wlab">{over ? 'Over by' : 'Left'}</span>
        <span className="wbig sm">{money(cur, Math.abs(left))}</span>
        <div><div className="wbar"><i style={{ width: Math.min(100, stats.pct) + '%' }} /></div><span className="wsub">{Math.round(stats.pct)}% planned</span></div>
      </div>
      <div className="widget ws">
        <span className="wlab">In hand</span>
        <span className="wbig sm">{money(cur, stats.have)}</span>
        <span className="wsub">+ {money(cur, total - stats.have)} expected</span>
      </div>
      <div className={'widget ws' + (next ? ' alert' : '')}>
        <span className="wlab">{next ? 'Cannot cover' : 'Status'}</span>
        {next ? <><span className="wname">{next.name}</span><span className="wsub">{money(cur, next.amount)}{stats.cut.length > 1 ? ` + ${stats.cut.length - 1} more` : ''}</span></>
          : <><span className="wok"><Check /></span><span className="wsub">{stats.covered.length ? 'All covered' : 'Nothing planned yet'}</span></>}
      </div>
      <div className="widget ws">
        <span className="wlab">Needs vs wants</span>
        <div className="wsplit">
          <span><b>{money(cur, stats.needs)}</b><small>Needs</small></span>
          <span><b>{money(cur, stats.wants)}</b><small>Wants</small></span>
        </div>
        <div className="split"><i className="n" style={{ width: (stats.needs / base) * 100 + '%' }} /><i className="w" style={{ width: (stats.wants / base) * 100 + '%' }} /></div>
      </div>
    </div>
  )
}

function Glance({ w, onClose }) {
  return (
    <div className="glance">
      <Bg />
      <button className="gclose" onClick={onClose}>Done</button>
      <div className="gwrap step fwd">
        <p className="geye">{w.period || 'Your plan'}</p>
        <WMedium w={w} onClick={onClose} />
        <WSmalls w={w} />
        <p className="ghint">Live from your plan. Updates the moment you change it.</p>
      </div>
    </div>
  )
}

function Seg({ value, options, onChange }) {
  const i = options.findIndex((o) => o[0] === value)
  return (
    <div className="seg" style={{ '--n': options.length, '--i': i }}>
      <span className="thumb" />
      {options.map(([v, l]) => (
        <button type="button" key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>{l}</button>
      ))}
    </div>
  )
}

function Swipe({ children, onRemove }) {
  const [dx, setDx] = useState(0)
  const [out, setOut] = useState(false)
  const st = useRef(null)
  const remove = () => { setOut(true); setTimeout(onRemove, 280) }
  return (
    <li className={'swipe' + (out ? ' out' : '')}>
      <button className="del" onClick={remove} tabIndex={-1}>Delete</button>
      <div
        className="slide"
        style={{ transform: `translateX(${dx}px)`, transition: st.current ? 'none' : undefined }}
        onTouchStart={(e) => { st.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, base: dx, lock: null } }}
        onTouchMove={(e) => {
          const s = st.current; if (!s) return
          const x = e.touches[0].clientX - s.x, y = e.touches[0].clientY - s.y
          if (s.lock === null && (Math.abs(x) > 8 || Math.abs(y) > 8)) s.lock = Math.abs(x) > Math.abs(y) ? 'h' : 'v'
          if (s.lock === 'h') setDx(Math.max(-160, Math.min(0, s.base + x)))
        }}
        onTouchEnd={() => { const s = st.current; st.current = null; if (!s) return; if (dx < -130) return remove(); setDx(dx < -44 ? -88 : 0) }}
      >
        {children}
        <button className="x" aria-label="Delete" onClick={remove}>×</button>
      </div>
    </li>
  )
}

function Login() {
  const [mode, setMode] = useState('in')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [slow, setSlow] = useState(false)

  // Start the handshake while the screen is idle so signing in does not pay for it.
  useEffect(() => { warmAuth() }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (busy) return
    setErr(''); setNote(''); setBusy(true)
    const slowTimer = setTimeout(() => setSlow(true), 2500)
    const creds = { email: email.trim().toLowerCase(), password: pass }
    try {
      // Call on the client, never as a detached reference: the auth methods need `this`.
      const { data, error } = mode === 'in'
        ? await supabase.auth.signInWithPassword(creds)
        : await supabase.auth.signUp(creds)
      if (error) setErr(authMsg(error))
      // Only happens if "Confirm email" is still on in the Supabase dashboard.
      else if (mode === 'up' && !data.session) setNote('Check your inbox for a confirmation link, then sign in.')
    } catch (err) {
      setErr(authMsg(err))
    } finally {
      clearTimeout(slowTimer); setSlow(false); setBusy(false)
    }
  }
  if (!supabase) return (
    <><Bg /><main className="login step fwd">
      <div className="logo"><i /></div>
      <h1>Spend Plan</h1>
      <p className="err">Auth is not configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env (see .env.example) and restart the dev server.</p>
    </main></>
  )
  return (
    <><Bg /><main className="login step fwd">
      <div className="logo"><i /></div>
      <h1>Spend Plan</h1>
      <p className="sub">{mode === 'in' ? 'Sign in to continue.' : 'Create your account.'}</p>
      <form onSubmit={submit} onFocus={warmAuth}>
        <div className="group">
          <label className="cell in"><span>Email</span><input type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} autoFocus required /></label>
          <label className="cell in"><span>Password</span><input type="password" minLength={6} value={pass} placeholder={mode === 'up' ? 'At least 6 characters' : 'Required'} onChange={(e) => setPass(e.target.value)} required /></label>
        </div>
        {err && <p className="err">{err}</p>}
        {note && <p className="ghint">{note}</p>}
        {busy && slow && <p className="ghint">Connecting… the first sign-in can take a few seconds on some networks.</p>}
        <button className="btn" disabled={busy}>{busy ? (slow ? 'Connecting…' : 'Working…') : mode === 'in' ? 'Sign in' : 'Create account'}</button>
      </form>
      <div className="group" style={{ marginTop: 22 }}>
        <button type="button" className="cell tap" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); setNote('') }}>
          {mode === 'in' ? 'New here? Create an account' : 'Already have an account? Sign in'}
        </button>
      </div>
    </main></>
  )
}

function NoteList({ notes, labelOf, cur, onDel }) {
  const byDay = new Map()
  notes.forEach((n, i) => byDay.set(n.date, [...(byDay.get(n.date) || []), { n, i }]))
  return [...byDay.keys()].sort().reverse().map((date) => {
    const rows = byDay.get(date).sort((a, b) => b.i - a.i)
    return (
      <div key={date}>
        <p className="gh">{noteDayLabel(date)} · {money(cur, sum(rows.map((r) => r.n)))}</p>
        <ul className="group list">
          {rows.map(({ n }) => (
            <Swipe key={n.id} onRemove={() => onDel(n.id)}>
              <span className={'pip' + (n.expected ? '' : ' fill')} />
              <div className="grow">
                <b>{n.name}</b>
                <small>{n.expected ? 'To buy' : 'Bought'}{labelOf(n) ? ' · ' + labelOf(n) : ''}</small>
              </div>
              <b className="amt">{cur}{n.amount.toLocaleString()}</b>
            </Swipe>
          ))}
        </ul>
      </div>
    )
  })
}

function NoteTaker({ notes, sources, cur, set, linkSources, userId }) {
  const [open, setOpen] = useState(false)
  // Options open themselves until the user dismisses them once, then that choice is kept.
  const optsKey = `spendplan.opts.${userId}`
  const [more, setMore] = useState(() => !localStorage.getItem(optsKey))
  const [period, setPeriod] = useState('month')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [f, setF] = useState({ name: '', amount: '', sourceId: '', source: '', date: dayAgo(0), expected: false })

  const [r0, r1] = noteRange(period, from, to)
  const shown = notes.filter((n) => n.date >= r0 && n.date <= r1)
  const spent = sum(shown.filter((n) => !n.expected))
  const expected = sum(shown.filter((n) => n.expected))
  const funds = linkSources ? sum(sources) : 0
  const pct = (v) => (funds > 0 ? (v / funds) * 100 : 0)
  // Yellow at 99% of the plan's money sources, red once a figure passes them.
  // No colour at all while notes are kept separate from the plan.
  const worst = Math.max(pct(spent), pct(expected))
  const level = funds > 0 ? (worst > 100 ? 'over' : worst >= 99 ? 'warn' : 'ok') : ''
  const today = sum(notes.filter((n) => n.date === dayAgo(0) && !n.expected))
  const labelOf = (n) => n.sourceId ? (sources.find((s) => s.id === n.sourceId)?.from || '') : n.source || ''
  const canAdd = !!(f.name.trim() && Number(f.amount))
  // Only a dismissal is remembered, so the panel stops opening itself after the first time.
  const toggleMore = () => {
    if (!more) return setMore(true)
    setMore(false)
    localStorage.setItem(optsKey, '1')
  }

  useEffect(() => { document.body.style.overflow = open ? 'hidden' : ''; return () => { document.body.style.overflow = '' } }, [open])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const add = (e) => {
    e.preventDefault()
    if (!canAdd) return
    set({ notes: [...notes, {
      id: uid(), name: f.name.trim(), amount: Number(f.amount), date: f.date || dayAgo(0), expected: f.expected,
      sourceId: linkSources ? f.sourceId : '', source: linkSources ? '' : f.source.trim(),
    }] })
    setF({ name: '', amount: '', sourceId: '', source: '', date: f.date, expected: false })
  }

  return (
    <>
      <button className="fab" onClick={() => setOpen(true)} aria-label="Open notes">
        <Svg size={17}><path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" /><path d="M13.5 6.5l3 3" /></Svg>
        <span>{today > 0 ? money(cur, today) : 'Note'}</span>
      </button>

      {open && (
        <div className="scrim" onClick={() => setOpen(false)}>
          <div className="panel" role="dialog" aria-modal="true" aria-label="Spending notes" onClick={(e) => e.stopPropagation()}>
            <i className="grab" />
            <header className="nhead">
              <h2>Notes</h2>
              <button className="nclose" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>

            <div className="nbar">
              <div className="nfilter">
                {NOTE_PERIODS.map(([v, l]) => <button key={v} className={period === v ? 'on' : ''} onClick={() => setPeriod(v)}>{l}</button>)}
              </div>
              <button type="button" className="ngear" onClick={toggleMore} aria-expanded={more} aria-label="Note options">
                <Svg size={15}><path d="M3 8h9M17 8h4M3 16h4M11 16h10" /><circle cx="14.6" cy="8" r="2" fill="currentColor" /><circle cx="8.6" cy="16" r="2" fill="currentColor" /></Svg>
                {f.expected ? 'To buy' : 'Bought'}
                <i className={'car' + (more ? ' up' : '')} />
              </button>
            </div>
            {period === 'custom' && (
              <div className="crange">
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" />
                <span>to</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" />
              </div>
            )}

            <section className={'nsum' + (level ? ' ' + level : '')}>
              <div className="nrow">
                <span className="nval">
                  <b className="nbig"><Num value={spent} prefix={cur} /></b>
                  {funds > 0 && <small className="nof">of {money(cur, funds)}</small>}
                </span>
                {level && <span className={'chip' + (level === 'over' ? ' bad' : ' ok')}>{level === 'over' ? 'Over sources' : 'Near the limit'}</span>}
              </div>
              <p className="nmeta">{noteLabel(period, r0, r1)} · {money(cur, expected)} to buy</p>
              {funds > 0 && <div className="wbar"><i style={{ width: Math.min(100, pct(spent)) + '%' }} /><b className="tick" /></div>}
            </section>

            {shown.length > 0
              ? <NoteList notes={shown} labelOf={labelOf} cur={cur} onDel={(id) => set({ notes: notes.filter((n) => n.id !== id) })} />
              : <p className="nempty">Nothing here yet.</p>}

            <form className="composer" onSubmit={add}>
              {more && (
                <div className="group">
                  <div className="cell in"><span>Type</span>
                    <div className="chips">
                      <button type="button" className={'tchip' + (f.expected ? '' : ' on')} onClick={() => setF({ ...f, expected: false })}>Bought</button>
                      <button type="button" className={'tchip' + (f.expected ? ' on' : '')} onClick={() => setF({ ...f, expected: true })}>To buy</button>
                    </div>
                  </div>
                  <div className="cell in"><span>When</span>
                    <div className="chips">
                      {NOTE_DAYS.map(([l, off]) => <button type="button" key={l} className={'tchip' + (f.date === dayAgo(off) ? ' on' : '')} onClick={() => setF({ ...f, date: dayAgo(off) })}>{l}</button>)}
                    </div>
                  </div>
                  <label className="cell in"><span>On</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
                  {linkSources
                    ? <label className="cell in"><span>Source</span>
                        <select value={f.sourceId} onChange={(e) => setF({ ...f, sourceId: e.target.value })}>
                          <option value="">None</option>
                          {sources.map((s) => <option key={s.id} value={s.id}>{s.from}</option>)}
                        </select>
                      </label>
                    : <label className="cell in"><span>Source</span><input value={f.source} placeholder="Cash, card…" onChange={(e) => setF({ ...f, source: e.target.value })} /></label>}
                  <label className="cell"><span>Use plan sources</span><input type="checkbox" className="switch" checked={linkSources} onChange={(e) => set({ linkSources: e.target.checked })} /></label>
                </div>
              )}
              <div className="crow">
                <input className="citem" value={f.name} placeholder="What did you buy?" onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
                <input className="camt" type="number" inputMode="decimal" min="0" value={f.amount} placeholder="0" onChange={(e) => setF({ ...f, amount: e.target.value })} />
                <button className="cadd" disabled={!canAdd} aria-label="Add note">+</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

export default function App() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  const [store, setStore] = useState({ uid: null, value: EMPTY })
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState('fwd')
  const [theme, setTheme] = useState(() => localStorage.getItem('spendplan.theme') || 'aurora')
  const [pulse, setPulse] = useState(false)
  const [glance, setGlance] = useState(wantsGlance)
  const first = useRef(true)

  const userId = session?.user?.id ?? null
  // React's adjust-state-during-render: swap in the account's plan as soon as
  // we know who is signed in, before anything can save the previous state back.
  if (userId !== store.uid) {
    const value = userId ? loadFor(userId) : EMPTY
    setStore({ uid: userId, value })
    setStep(value.items.length ? 2 : value.sources.length ? 1 : 0)
  }
  const data = store.value
  const setData = (fn) => setStore((s) => ({ ...s, value: fn(s.value) }))

  useEffect(() => {
    if (!supabase) { setReady(true); return }
    supabase.auth.getSession().then(({ data: d }) => { setSession(d.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!store.uid) return
    localStorage.setItem(keyFor(store.uid), JSON.stringify(store.value))
  }, [store])
  useEffect(() => { document.body.dataset.theme = theme; localStorage.setItem('spendplan.theme', theme) }, [theme])

  const { plan, sources, items } = data
  const cur = plan.currency || '₦'
  const total = sum(sources)
  const spent = sum(items)
  const left = total - spent
  const over = items.length > 0 && left < 0
  const have = sum(sources.filter((x) => x.status === 'have'))
  let run = 0
  const covered = [], cut = []
  items.forEach((i) => { run += i.amount; (run > total ? cut : covered).push(i) })
  const pct = total ? Math.min(100, (spent / total) * 100) : spent ? 100 : 0
  const stats = { covered, cut, have, spent, pct, needs: sum(items.filter((i) => i.kind === 'need')), wants: sum(items.filter((i) => i.kind === 'want')) }
  useEffect(() => { document.body.classList.toggle('over', over) }, [over])
  useEffect(() => {
    if (!store.uid) return
    const onStorage = (e) => { if (e.key === keyFor(store.uid)) setData(() => loadFor(store.uid)) }
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage)
  }, [store.uid])
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return
    const n = cut.length
    try { (n > 0 ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}) } catch { /* ignore */ }
  }, [cut.length])
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPulse(true); const t = setTimeout(() => setPulse(false), 650); return () => clearTimeout(t)
  }, [left])

  if (!ready) return null
  if (!session) return <Login />
  const period0 = plan.type === 'month'
    ? (plan.month ? new Date(plan.month + '-01T00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : '')
    : [fmtDate(plan.start), fmtDate(plan.end)].filter(Boolean).join(' to ')
  const w = { plan, cur, left, total, over, stats, period: period0 }
  if (glance) return <Glance w={w} onClose={() => { setGlance(false); history.replaceState(null, '', location.pathname) }} />

  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const go = (n) => { if (n === step) return; setDir(n > step ? 'fwd' : 'back'); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const canNext = step === 0 ? sources.length > 0 : step === 1 ? items.length > 0 : false
  const period = plan.type === 'month'
    ? (plan.month ? new Date(plan.month + '-01T00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : '')
    : [fmtDate(plan.start), fmtDate(plan.end)].filter(Boolean).join(' to ')


  const common = { plan, sources, items, set, cur, total, spent, left, over, have, stats }

  return (
    <div className="app">
      <Bg />
      <header className="nav">
        <button className="navbtn" style={{ visibility: step > 0 ? 'visible' : 'hidden' }} onClick={() => go(step - 1)}><Chev left />{STEPS[step - 1]}</button>
        <span className="navtitle">{plan.name || 'Spend Plan'}</span>
        <button className="navbtn" style={{ visibility: step < 2 ? 'visible' : 'hidden' }} disabled={!canNext} onClick={() => go(step + 1)}>{STEPS[step + 1]}<Chev /></button>
      </header>

      <main className="page">
        <div className="eyebrow">
          <span>Step {step + 1} of 3</span>
          <div className="swatches">{THEMES.map(([t, l]) => <button key={t} className={'sw ' + t + (theme === t ? ' on' : '')} aria-label={l + ' theme'} onClick={() => setTheme(t)} />)}</div>
        </div>
        <h1 key={"t" + step} className="large fade">{STEPS[step]}</h1>
        <p className="sub">{SUBS[step]}{period && step === 0 ? '' : ''}</p>

        {step < 2 && <section className="card hero">
          <div className="hl">
            <span className="lab">{over ? 'Over budget by' : 'Left to spend'}</span>
            <div className={'big' + (pulse ? ' pulse' : '')}><Num value={Math.abs(left)} prefix={cur} /></div>
            <span className="lab small">{total ? `of ${cur}${total.toLocaleString()}` : 'Add your money to begin'}{period ? ' · ' + period : ''}</span>
          </div>
          <Ring pct={pct} />
        </section>}

        <div key={"s" + step} className={'step ' + dir}>
          {step === 0 && <PlanStep {...common} />}
          {step === 1 && <ListStep {...common} />}
          {step === 2 && <SummaryStep {...common} data={data} onGlance={() => setGlance(true)} />}
          {step < 2 && <button className="btn" disabled={!canNext} onClick={() => go(step + 1)}>{step === 0 ? 'Continue to List' : 'See Summary'}</button>}
        </div>
      </main>

      <nav className="tabs" style={{ '--i': step }}>
        {STEPS.map((s, i) => (
          <button key={s} className={i === step ? 'on' : ''} disabled={i > 0 && sources.length === 0} onClick={() => go(i)}>
            {ICONS[i]}<span>{s}</span>
          </button>
        ))}
      </nav>

      <NoteTaker notes={data.notes || []} sources={sources} cur={cur} set={set} linkSources={data.linkSources !== false} userId={store.uid} />
    </div>
  )
}

function PlanStep({ plan, sources, set, cur }) {
  const [f, setF] = useState({ from: '', amount: '', status: 'have', date: '' })
  const upd = (k, v) => set({ plan: { ...plan, [k]: v } })
  const add = (e) => {
    e.preventDefault()
    if (!f.from.trim() || !Number(f.amount)) return
    set({ sources: [...sources, { id: uid(), ...f, from: f.from.trim(), amount: Number(f.amount) }] })
    setF({ from: '', amount: '', status: 'have', date: '' })
  }
  return (
    <>
      <Seg value={plan.type} onChange={(v) => upd('type', v)} options={[['month', 'A month'], ['duration', 'Custom dates']]} />
      <div className="group">
        <label className="cell in"><span>Name</span><input value={plan.name} placeholder="November" onChange={(e) => upd('name', e.target.value)} /></label>
        {plan.type === 'month'
          ? <label className="cell in"><span>Month</span><input type="month" value={plan.month} onChange={(e) => upd('month', e.target.value)} /></label>
          : <>
              <label className="cell in"><span>From</span><input type="date" value={plan.start} onChange={(e) => upd('start', e.target.value)} /></label>
              <label className="cell in"><span>To</span><input type="date" value={plan.end} onChange={(e) => upd('end', e.target.value)} /></label>
            </>}
        <label className="cell in"><span>Currency</span><input value={plan.currency} maxLength={4} onChange={(e) => upd('currency', e.target.value)} /></label>
      </div>

      {sources.length > 0 && <>
        <p className="gh">Money coming in</p>
        <ul className="group list">
          {sources.map((s) => (
            <Swipe key={s.id} onRemove={() => set({ sources: sources.filter((x) => x.id !== s.id) })}>
              <span className={'pip' + (s.status === 'have' ? ' fill' : '')} />
              <div className="grow"><b>{s.from}</b><small>{s.status === 'have' ? 'In hand' : 'Expected'}{s.date ? ' · ' + fmtDate(s.date) : ''}</small></div>
              <b className="amt">{cur}{s.amount.toLocaleString()}</b>
            </Swipe>
          ))}
        </ul>
        <p className="gf">Swipe left on a source to delete it.</p>
      </>}

      <p className="gh">Add a source</p>
      <form onSubmit={add}>
        <Seg value={f.status} onChange={(v) => setF({ ...f, status: v })} options={[['have', 'I have it'], ['expected', 'Expecting it']]} />
        <div className="group">
          <label className="cell in"><span>From</span><input value={f.from} placeholder="Salary, client…" onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label className="cell in"><span>Amount ({cur})</span><input type="number" inputMode="decimal" min="0" value={f.amount} placeholder="0" onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="cell in"><span>{f.status === 'have' ? 'Received' : 'Expected'}</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        </div>
        <button className="btn tint">Add source</button>
      </form>
    </>
  )
}

function ListStep({ items, set, cur, total }) {
  const n = items.length
  const [f, setF] = useState({ name: '', kind: 'need', rank: n + 1, amount: '', effect: '' })
  const rank = Math.min(f.rank, n + 1)
  const add = (e) => {
    e.preventDefault()
    if (!f.name.trim() || !Number(f.amount)) return
    const next = [...items]
    next.splice(rank - 1, 0, { id: uid(), name: f.name.trim(), kind: f.kind, amount: Number(f.amount), effect: f.effect.trim() })
    set({ items: next })
    setF({ name: '', kind: 'need', rank: next.length + 1, amount: '', effect: '' })
  }
  const move = (i, d) => {
    const j = i + d
    if (j < 0 || j >= n) return
    const next = [...items];[next[i], next[j]] = [next[j], next[i]]
    set({ items: next })
  }
  let run = 0
  return (
    <>
      <p className="gh">New item</p>
      <form onSubmit={add}>
        <Seg value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={[['need', 'Need'], ['want', 'Want']]} />
        <div className="group">
          <label className="cell in"><span>Item</span><input value={f.name} placeholder="What do you want?" onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <div className="cell">
            <span>Priority</span>
            <span className="val"><Num value={rank} />/{n + 1}</span>
            <div className="stepper">
              <button type="button" onClick={() => setF({ ...f, rank: Math.max(1, rank - 1) })} aria-label="Higher priority">−</button>
              <button type="button" onClick={() => setF({ ...f, rank: Math.min(n + 1, rank + 1) })} aria-label="Lower priority">+</button>
            </div>
          </div>
          <label className="cell in"><span>Cost ({cur})</span><input type="number" inputMode="decimal" min="0" value={f.amount} placeholder="0" onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="cell in"><span>If skipped</span><input value={f.effect} placeholder="What goes wrong?" onChange={(e) => setF({ ...f, effect: e.target.value })} /></label>
        </div>
        <p className="gf">Priority 1 is the first thing you would buy.</p>
        <button className="btn tint">Add to list</button>
      </form>

      {n > 0 && <>
        <p className="gh">Your list</p>
        <ul className="group list">
          {items.map((it, i) => {
            run += it.amount
            const bad = run > total
            return (
              <Swipe key={it.id} onRemove={() => set({ items: items.filter((x) => x.id !== it.id) })}>
                <span className={'rk' + (bad ? ' bad' : '')}>{i + 1}</span>
                <div className={'grow' + (bad ? ' bad' : '')}>
                  <b>{it.name}</b>
                  <small>{it.kind === 'need' ? 'Need' : 'Want'}{bad ? ' · Not covered' : ''}{it.effect ? ' · If skipped: ' + it.effect : ''}</small>
                </div>
                <div className="side">
                  <b className={'amt' + (bad ? ' bad' : '')}>{cur}{it.amount.toLocaleString()}</b>
                  <span className="mv">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === n - 1} aria-label="Move down">↓</button>
                  </span>
                </div>
              </Swipe>
            )
          })}
        </ul>
        <p className="gf">Swipe left to delete. Items turn red once the money runs out.</p>
      </>}
    </>
  )
}

function SummaryStep({ items, total, spent, left, over, have, cur, set, data, plan, stats, onGlance }) {
  const m = (v) => cur + Number(v).toLocaleString()
  const needs = sum(items.filter((i) => i.kind === 'need'))
  const wants = sum(items.filter((i) => i.kind === 'want'))
  let run = 0
  const covered = [], cut = []
  items.forEach((i) => { run += i.amount; (run > total ? cut : covered).push(i) })
  const base = Math.max(total, spent) || 1

  const exportJson = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    a.download = 'spend-plan.json'; a.click()
  }
  const importJson = (e) => {
    const file = e.target.files[0]; if (!file) return
    file.text().then((t) => { try { set({ ...EMPTY, ...JSON.parse(t) }) } catch { alert('That file is not a valid backup.') } })
  }
  const reset = () => { if (confirm('Delete this plan and start over?')) set(EMPTY) }

  return (
    <>
      {!over && items.length > 0 && <Confetti />}
      <WMedium w={{ plan, cur, left, total, over, stats }} onClick={onGlance} />
      <p className="gf wcap">Tap the widget for Glance, a full-screen view to keep open.</p>
      <section className="card verdict">
        <b>{items.length === 0 ? 'Nothing planned yet.' : over ? `You are ${m(-left)} short.` : `You will have ${m(left)} left.`}</b>
        <p>{items.length === 0 ? 'Add items on the List tab.' : over ? 'The red items cannot be covered. Cut them or find more money.' : 'Everything on your list is covered.'}</p>
      </section>

      <section className="card">
        <div className="split">
          <i className="n" style={{ width: (needs / base) * 100 + '%' }} />
          <i className="w" style={{ width: (wants / base) * 100 + '%' }} />
        </div>
        <div className="legend"><span><b className="k n" />Needs {m(needs)}</span><span><b className="k w" />Wants {m(wants)}</span></div>
      </section>

      <div className="group">
        <div className="cell"><span>Total money</span><span className="val">{m(total)}</span></div>
        <div className="cell"><span>In hand now</span><span className="val">{m(have)}</span></div>
        <div className="cell"><span>Still expected</span><span className="val">{m(total - have)}</span></div>
        <div className="cell"><span>Planned spend</span><span className="val">{m(spent)}</span></div>
      </div>

      {covered.length > 0 && <>
        <p className="gh">Covered</p>
        <ul className="group">{covered.map((i) => <li className="cell" key={i.id}><span className="grow">{i.name}</span><span className="val">{m(i.amount)}</span></li>)}</ul>
      </>}
      {cut.length > 0 && <>
        <p className="gh bad">Not covered</p>
        <ul className="group">{cut.map((i) => <li className="cell tall bad" key={i.id}><span className="grow">{i.name}{i.effect && <small>If skipped: {i.effect}</small>}</span><span className="val">{m(i.amount)}</span></li>)}</ul>
      </>}

      <div className="group">
        <button className="cell tap" onClick={exportJson}>Export backup</button>
        <label className="cell tap">Import backup<input type="file" accept="application/json" hidden onChange={importJson} /></label>
        <button className="cell tap" onClick={() => supabase.auth.signOut()}>Sign out</button>
        <button className="cell tap danger" onClick={reset}>Start over</button>
      </div>
      <p className="ver">Spend Plan {VERSION}</p>
    </>
  )
}
