import { useEffect, useRef, useState } from 'react'

const VERSION = 'v4'
const THEMES = [['aurora', 'Aurora'], ['mint', 'Mint'], ['citrus', 'Citrus'], ['orchid', 'Orchid']]
const KEY = 'spendplan.v1'
const EMAIL = import.meta.env.VITE_AUTH_EMAIL
const PASS = import.meta.env.VITE_AUTH_PASSWORD
const STEPS = ['Plan', 'List', 'Summary']
const SUBS = [
  'Name your plan, then add the money you will spend from.',
  'Rank each thing against the rest and see what you can cover.',
  'Here is where everything lands.',
]
const EMPTY = { plan: { name: '', type: 'month', month: '', start: '', end: '', currency: '₦' }, sources: [], items: [] }

const load = () => {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return EMPTY }
}
const uid = () => Math.random().toString(36).slice(2, 9)
const sum = (a) => a.reduce((t, x) => t + Number(x.amount || 0), 0)
const fmtDate = (d) => (d ? new Date(d + 'T00:00').toLocaleDateString('en', { day: 'numeric', month: 'short' }) : '')

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

function Login({ onOk }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (email.trim().toLowerCase() === (EMAIL || '').toLowerCase() && pass === PASS) {
      sessionStorage.setItem('spendplan.auth', '1'); onOk()
    } else setErr('That email or password is not right.')
  }
  return (
    <><Bg /><main className="login step fwd">
      <div className="logo"><i /></div>
      <h1>Spend Plan</h1>
      <p className="sub">Sign in to continue.</p>
      <form onSubmit={submit}>
        <div className="group">
          <label className="cell in"><span>Email</span><input type="email" value={email} placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} autoFocus /></label>
          <label className="cell in"><span>Password</span><input type="password" value={pass} placeholder="Required" onChange={(e) => setPass(e.target.value)} /></label>
        </div>
        {err && <p className="err">{err}</p>}
        <button className="btn">Sign in</button>
      </form>
    </main></>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(sessionStorage.getItem('spendplan.auth') === '1')
  const [data, setData] = useState(load)
  const [step, setStep] = useState(() => { const d = load(); return d.items.length ? 2 : d.sources.length ? 1 : 0 })
  const [dir, setDir] = useState('fwd')
  const [theme, setTheme] = useState(() => localStorage.getItem('spendplan.theme') || 'aurora')
  const [pulse, setPulse] = useState(false)
  const first = useRef(true)
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])
  useEffect(() => { document.body.dataset.theme = theme; localStorage.setItem('spendplan.theme', theme) }, [theme])

  const { plan, sources, items } = data
  const cur = plan.currency || '₦'
  const total = sum(sources)
  const spent = sum(items)
  const left = total - spent
  const over = items.length > 0 && left < 0
  useEffect(() => { document.body.classList.toggle('over', over) }, [over])
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPulse(true); const t = setTimeout(() => setPulse(false), 650); return () => clearTimeout(t)
  }, [left])

  if (!authed) return <Login onOk={() => setAuthed(true)} />

  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const go = (n) => { if (n === step) return; setDir(n > step ? 'fwd' : 'back'); setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }
  const canNext = step === 0 ? sources.length > 0 : step === 1 ? items.length > 0 : false
  const period = plan.type === 'month'
    ? (plan.month ? new Date(plan.month + '-01T00:00').toLocaleDateString('en', { month: 'long', year: 'numeric' }) : '')
    : [fmtDate(plan.start), fmtDate(plan.end)].filter(Boolean).join(' to ')
  const pct = total ? Math.min(100, (spent / total) * 100) : spent ? 100 : 0
  const have = sum(sources.filter((s) => s.status === 'have'))
  const common = { plan, sources, items, set, cur, total, spent, left, over, have }

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

        <section className="card hero">
          <div className="hl">
            <span className="lab">{over ? 'Over budget by' : 'Left to spend'}</span>
            <div className={'big' + (pulse ? ' pulse' : '')}><Num value={Math.abs(left)} prefix={cur} /></div>
            <span className="lab small">{total ? `of ${cur}${total.toLocaleString()}` : 'Add your money to begin'}{period ? ' · ' + period : ''}</span>
          </div>
          <Ring pct={pct} />
        </section>

        <div key={"s" + step} className={'step ' + dir}>
          {step === 0 && <PlanStep {...common} />}
          {step === 1 && <ListStep {...common} />}
          {step === 2 && <SummaryStep {...common} data={data} />}
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

function SummaryStep({ items, total, spent, left, over, have, cur, set, data }) {
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
        <button className="cell tap" onClick={() => { sessionStorage.removeItem('spendplan.auth'); location.reload() }}>Sign out</button>
        <button className="cell tap danger" onClick={reset}>Start over</button>
      </div>
      <p className="ver">Spend Plan {VERSION}</p>
    </>
  )
}
