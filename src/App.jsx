import { useEffect, useState } from 'react'

const KEY = 'spendplan.v1'
const EMAIL = import.meta.env.VITE_AUTH_EMAIL
const PASS = import.meta.env.VITE_AUTH_PASSWORD
const EMPTY = { plan: { name: '', type: 'month', start: '', end: '', currency: '₦' }, sources: [], items: [] }

const load = () => {
  try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return EMPTY }
}
const uid = () => Math.random().toString(36).slice(2, 9)
const sum = (a) => a.reduce((t, x) => t + Number(x.amount || 0), 0)

function Login({ onOk }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (email.trim().toLowerCase() === (EMAIL || '').toLowerCase() && pass === PASS) {
      sessionStorage.setItem('spendplan.auth', '1'); onOk()
    } else setErr('Email or password is wrong.')
  }
  return (
    <main className="login">
      <h1>Spend Plan</h1>
      <form onSubmit={submit}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        <input type="password" placeholder="Password" value={pass} onChange={(e) => setPass(e.target.value)} />
        {err && <p className="err">{err}</p>}
        <button className="btn">Sign in</button>
      </form>
    </main>
  )
}

export default function App() {
  const [authed, setAuthed] = useState(sessionStorage.getItem('spendplan.auth') === '1')
  const [data, setData] = useState(load)
  const [tab, setTab] = useState('plan')
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)) }, [data])

  const { plan, sources, items } = data
  const cur = plan.currency || '₦'
  const money = (n) => cur + Number(n || 0).toLocaleString()
  const total = sum(sources)
  const have = sum(sources.filter((s) => s.status === 'have'))
  const spent = sum(items)
  const left = total - spent
  const over = items.length > 0 && left < 0

  useEffect(() => { document.body.classList.toggle('over', over) }, [over])

  if (!authed) return <Login onOk={() => setAuthed(true)} />

  const set = (patch) => setData((d) => ({ ...d, ...patch }))

  return (
    <div className="app">
      <header>
        <div>
          <h1>{plan.name || 'Spend Plan'}</h1>
          <p className="muted">{plan.start ? `${plan.start}${plan.end ? ' to ' + plan.end : ''}` : 'No dates set'}</p>
        </div>
        <div className={'left' + (over ? ' neg' : '')}>
          <small>{over ? 'Over by' : 'Left to spend'}</small>
          <strong>{money(Math.abs(left))}</strong>
        </div>
      </header>

      <nav>
        {['plan', 'list', 'summary'].map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t === 'plan' ? 'Plan' : t === 'list' ? 'List' : 'Summary'}
          </button>
        ))}
      </nav>

      {tab === 'plan' && <PlanTab {...{ plan, sources, set, money, total, have }} />}
      {tab === 'list' && <ListTab {...{ items, total, set, money }} />}
      {tab === 'summary' && <SummaryTab {...{ data, set, money, total, have, spent, left, over }} />}
    </div>
  )
}

function PlanTab({ plan, sources, set, money, total, have }) {
  const [f, setF] = useState({ from: '', amount: '', status: 'have', date: '' })
  const upd = (k, v) => set({ plan: { ...plan, [k]: v } })
  const add = (e) => {
    e.preventDefault()
    if (!f.from || !Number(f.amount)) return
    set({ sources: [...sources, { id: uid(), ...f, amount: Number(f.amount) }] })
    setF({ from: '', amount: '', status: 'have', date: '' })
  }
  return (
    <>
      <section>
        <h2>Plan</h2>
        <div className="grid">
          <label>Name<input value={plan.name} placeholder="November" onChange={(e) => upd('name', e.target.value)} /></label>
          <label>Type
            <select value={plan.type} onChange={(e) => upd('type', e.target.value)}>
              <option value="month">Month</option><option value="duration">Custom duration</option>
            </select>
          </label>
          <label>Start<input type="date" value={plan.start} onChange={(e) => upd('start', e.target.value)} /></label>
          <label>End<input type="date" value={plan.end} onChange={(e) => upd('end', e.target.value)} /></label>
          <label>Currency<input value={plan.currency} maxLength={4} onChange={(e) => upd('currency', e.target.value)} /></label>
        </div>
      </section>

      <section>
        <h2>Money sources</h2>
        <form className="grid" onSubmit={add}>
          <label>From<input value={f.from} placeholder="Salary, client, savings" onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
          <label>Amount<input type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label>Status
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
              <option value="have">Already have it</option><option value="expected">Still expecting</option>
            </select>
          </label>
          <label>{f.status === 'have' ? 'Received on' : 'Expected on'}<input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <button className="btn">Add source</button>
        </form>
        {sources.length === 0 && <p className="muted">Add where your money is coming from.</p>}
        <ul className="rows">
          {sources.map((s) => (
            <li key={s.id}>
              <div><b>{s.from}</b><span className="muted">{s.status === 'have' ? 'In hand' : 'Expected'}{s.date ? ' · ' + s.date : ''}</span></div>
              <div className="r"><b>{money(s.amount)}</b>
                <button className="x" onClick={() => set({ sources: sources.filter((x) => x.id !== s.id) })} aria-label="Remove">×</button>
              </div>
            </li>
          ))}
        </ul>
        {sources.length > 0 && <p className="tot">Total {money(total)}. In hand {money(have)}. Expected {money(total - have)}.</p>}
      </section>
    </>
  )
}

function ListTab({ items, total, set, money }) {
  const n = items.length
  const [f, setF] = useState({ name: '', kind: 'need', rank: n + 1, amount: '', effect: '' })
  useEffect(() => { setF((x) => ({ ...x, rank: Math.min(x.rank, n + 1) })) }, [n])

  const add = (e) => {
    e.preventDefault()
    if (!f.name || !Number(f.amount)) return
    const next = [...items]
    next.splice(Number(f.rank) - 1, 0, { id: uid(), name: f.name, kind: f.kind, amount: Number(f.amount), effect: f.effect })
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
      <section>
        <h2>Add to list</h2>
        <form className="grid" onSubmit={add}>
          <label>What do you want to get<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Need or want
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>
              <option value="need">Need</option><option value="want">Want</option>
            </select>
          </label>
          <label>Priority
            <select value={f.rank} onChange={(e) => setF({ ...f, rank: Number(e.target.value) })}>
              {Array.from({ length: n + 1 }, (_, i) => <option key={i} value={i + 1}>{i + 1}/{n + 1}{i === 0 ? ' (top)' : ''}</option>)}
            </select>
          </label>
          <label>Cost<input type="number" min="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></label>
          <label className="wide">What happens if I don't get it<input value={f.effect} onChange={(e) => setF({ ...f, effect: e.target.value })} /></label>
          <button className="btn">Add item</button>
        </form>
      </section>

      <section>
        <h2>Your list</h2>
        {n === 0 && <p className="muted">Nothing here yet. Add the first thing you want to buy.</p>}
        <ul className="rows items">
          {items.map((it, i) => {
            run += it.amount
            const bad = run > total
            return (
              <li key={it.id} className={bad ? 'bad' : ''}>
                <div className="rk">{i + 1}/{n}</div>
                <div className="grow">
                  <b>{it.name}</b> <span className={'tag ' + it.kind}>{it.kind}</span>
                  {it.effect && <p className="muted">If skipped: {it.effect}</p>}
                  <p className="muted">{bad ? 'Not covered. ' : ''}Running total {money(run)}</p>
                </div>
                <div className="r col">
                  <b>{money(it.amount)}</b>
                  <span>
                    <button className="x" onClick={() => move(i, -1)} aria-label="Move up">↑</button>
                    <button className="x" onClick={() => move(i, 1)} aria-label="Move down">↓</button>
                    <button className="x" onClick={() => set({ items: items.filter((x) => x.id !== it.id) })} aria-label="Remove">×</button>
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </>
  )
}

function SummaryTab({ data, set, money, total, have, spent, left, over }) {
  const { items } = data
  const needs = sum(items.filter((i) => i.kind === 'need'))
  const wants = sum(items.filter((i) => i.kind === 'want'))
  let run = 0
  const covered = [], cut = []
  items.forEach((i) => { run += i.amount; (run > total ? cut : covered).push(i) })
  const pct = (v) => (spent ? Math.round((v / spent) * 100) : 0)

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
      <section>
        <h2>Summary</h2>
        <div className="stats">
          <div><small>Total money</small><b>{money(total)}</b></div>
          <div><small>In hand</small><b>{money(have)}</b></div>
          <div><small>Planned spend</small><b>{money(spent)}</b></div>
          <div className={over ? 'neg' : ''}><small>{over ? 'Short by' : 'Left over'}</small><b>{money(Math.abs(left))}</b></div>
        </div>
        {over && <p className="err">Your list is {money(-left)} above your money. Items marked red are the ones you can't cover, lowest priority first.</p>}
      </section>

      <section>
        <h2>Needs vs wants</h2>
        <div className="bar"><i style={{ width: pct(needs) + '%' }} /></div>
        <p className="muted">Needs {money(needs)} ({pct(needs)}%). Wants {money(wants)} ({pct(wants)}%).</p>
      </section>

      <section>
        <h2>What you can afford</h2>
        {covered.length === 0 && <p className="muted">Nothing covered yet.</p>}
        <ul className="plain">{covered.map((i) => <li key={i.id}>{i.name} <span className="muted">{money(i.amount)}</span></li>)}</ul>
        {cut.length > 0 && <>
          <h2 className="neg">Not covered</h2>
          <ul className="plain">{cut.map((i) => <li key={i.id} className="neg">{i.name} <span>{money(i.amount)}</span>{i.effect && <em> (if skipped: {i.effect})</em>}</li>)}</ul>
        </>}
      </section>

      <section className="foot">
        <button className="btn ghost" onClick={exportJson}>Export backup</button>
        <label className="btn ghost">Import backup<input type="file" accept="application/json" hidden onChange={importJson} /></label>
        <button className="btn ghost" onClick={reset}>Start over</button>
        <button className="btn ghost" onClick={() => { sessionStorage.removeItem('spendplan.auth'); location.reload() }}>Sign out</button>
      </section>
    </>
  )
}
