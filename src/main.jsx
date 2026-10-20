import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const stages = [
  { id: 'placed', label: 'Order Placed', icon: '↗' },
  { id: 'payment', label: 'Payment Verification', icon: '₹' },
  { id: 'store', label: 'Dark Store Selection', icon: '⌖' },
  { id: 'inventory', label: 'Inventory Reservation', icon: '▣' },
  { id: 'picking', label: 'Picking', icon: '☷' },
  { id: 'packing', label: 'Packing', icon: '□' },
  { id: 'rider', label: 'Rider Assignment', icon: '♙' },
  { id: 'pickup', label: 'Pickup', icon: '⇡' },
  { id: 'delivered', label: 'Delivered', icon: '✓' },
]

const makeScenario = (group, title, stage, issue, recovery, outcome = 'recovered', detail) => ({
  id: title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''), group, title, stage, issue, recovery, outcome,
  detail: detail || (outcome === 'recovered' ? 'A safe fallback was applied and the order continued.' : 'The order was stopped and the customer was protected.'),
})

const scenarios = [
  makeScenario('Payment', 'Failed payment', 'payment', 'UPI authorization was declined.', 'Prompt for another payment method; hold the basket for 4 minutes.', 'cancelled'),
  makeScenario('Payment', 'Delayed confirmation', 'payment', 'Bank confirmation is taking longer than expected.', 'Keep the order pending and poll the payment gateway before releasing stock.'),
  makeScenario('Payment', 'Success, app timeout', 'payment', 'Payment succeeded but the app did not receive the response.', 'Reconcile using the payment reference and restore the paid order.'),
  makeScenario('Payment', 'Duplicate payment prevention', 'payment', 'A second payment attempt was detected for the same order.', 'Idempotency check blocks the duplicate and confirms the original charge.'),
  makeScenario('Dark Store', 'Item out of stock', 'inventory', 'Organic bananas are unavailable at the selected store.', 'Offer a similar item or remove it with an instant price adjustment.'),
  makeScenario('Dark Store', 'Nearest store unavailable', 'store', 'The closest dark store is temporarily offline.', 'Reroute to the next eligible store and refresh the ETA.'),
  makeScenario('Dark Store', 'No full basket available', 'store', 'No single store can fulfil all 8 items.', 'Split availability is not allowed; offer substitutions or cancel and refund.', 'cancelled'),
  makeScenario('Dark Store', 'Reservation race', 'inventory', 'Another shopper reserved the last unit milliseconds earlier.', 'Re-check inventory and reserve a substitute before picking begins.'),
  makeScenario('Dark Store', 'Stock short during picking', 'picking', 'Picker could not find 1 reserved item on the shelf.', 'Verify shelf count, propose a substitute, and adjust the final bill.'),
  makeScenario('Dark Store', 'Overloaded or closed store', 'store', 'Store capacity is full for the current delivery window.', 'Move the basket to a nearby open store with available picking capacity.'),
  makeScenario('Dark Store', 'Store unavailable after selection', 'store', 'Selected store lost connectivity after order acceptance.', 'Release its reservation and reassign the order before picking.'),
  makeScenario('Dark Store', 'Reservation expiry', 'inventory', 'The reservation expired while payment was pending.', 'Re-reserve stock after payment reconciliation or ask for confirmation.'),
  makeScenario('Dark Store', 'Substitution or removal', 'picking', 'A requested item needs customer approval for substitution.', 'Apply the approved replacement or remove it and recalculate the total.'),
  makeScenario('Dark Store', 'Cancellation and refund', 'inventory', 'Inventory cannot be secured for a paid basket.', 'Cancel the order and initiate a refund to the original payment source.', 'cancelled'),
  makeScenario('Rider', 'No nearby rider', 'rider', 'No rider is available within the pickup radius.', 'Expand the search radius and delay picking until an assignment is likely.'),
  makeScenario('Rider', 'Rider rejection or timeout', 'rider', 'The first rider did not accept the task in time.', 'Offer the task to the next ranked rider and retain the packed order.'),
  makeScenario('Rider', 'Rider goes offline', 'rider', 'Assigned rider unexpectedly went offline.', 'Cancel the assignment and dispatch to the next available rider.'),
  makeScenario('Rider', 'Rider already busy', 'rider', 'A matching rider accepted another task first.', 'Remove stale availability and continue the rider search.'),
  makeScenario('Rider', 'Rider cancels after accepting', 'pickup', 'Rider cancelled before collecting the bag.', 'Return the order to dispatch and prioritise a replacement rider.'),
  makeScenario('Rider', 'Rider arrives before packing', 'packing', 'Rider reached the store before the order was ready.', 'Show ready-in estimate and queue pickup confirmation when packing completes.'),
  makeScenario('Rider', 'No rider after packing', 'rider', 'Order is packed but rider matching is still pending.', 'Prioritise this order and preserve freshness with a short holding timer.'),
  makeScenario('Rider', 'Delivery reassignment', 'pickup', 'Current delivery route needs reassignment.', 'Transfer the task to a nearby rider and notify the customer of the new ETA.'),
  makeScenario('Delivery', 'Cancellation before dispatch', 'packing', 'Customer cancelled before a rider was dispatched.', 'Stop packing, release the bag, and issue a full refund.', 'cancelled'),
  makeScenario('Delivery', 'Cancellation after dispatch', 'pickup', 'Customer requested cancellation after pickup.', 'Ask rider to return if practical; reconcile item and delivery charges.', 'cancelled'),
  makeScenario('Delivery', 'Failed delivery', 'delivered', 'Rider could not complete delivery after contact attempts.', 'Return the order to store and start refund review.', 'cancelled'),
  makeScenario('Delivery', 'Delayed status update', 'pickup', 'Rider location update is delayed by a weak connection.', 'Keep the last trusted state and sync delivery status when connectivity returns.'),
  makeScenario('Delivery', 'Refund reconciliation', 'delivered', 'Refund confirmation needs to be matched with the original order.', 'Reconcile gateway reference, notify the customer, and close the case.'),
]

const normalScenario = { id: 'normal', group: 'Flow', title: 'Normal flow', stage: 'delivered', issue: 'All services are responding normally.', recovery: 'Order completes inside the promised delivery window.', outcome: 'success', detail: 'Every handoff is confirmed as the order moves through the network.' }
const groups = ['Payment', 'Dark Store', 'Rider', 'Delivery']
const stageIndex = (id) => stages.findIndex((stage) => stage.id === id)

function App() {
  const [scenario, setScenario] = useState(normalScenario)
  const [progress, setProgress] = useState(8)
  const [isPlaying, setIsPlaying] = useState(false)
  const faultIndex = stageIndex(scenario.stage)
  const terminal = scenario.outcome === 'cancelled' ? faultIndex : 8
  const status = scenario.outcome === 'success' && progress === 8 ? 'Delivered' : scenario.outcome === 'cancelled' && progress >= faultIndex ? 'Cancelled' : progress === faultIndex && scenario.id !== 'normal' ? 'Recovery in progress' : 'On track'

  useEffect(() => {
    if (!isPlaying) return
    const next = setTimeout(() => {
      if (progress < terminal) setProgress((value) => value + 1)
      else setIsPlaying(false)
    }, 720)
    return () => clearTimeout(next)
  }, [isPlaying, progress, terminal])

  const selectScenario = (item) => {
    setScenario(item)
    setProgress(stageIndex(item.stage))
    setIsPlaying(false)
  }
  const reset = () => { setScenario(normalScenario); setProgress(0); setIsPlaying(false) }
  const next = () => setProgress((value) => Math.min(value + 1, terminal))
  const replay = () => { setProgress(0); setIsPlaying(true) }
  return <main className="min-h-screen text-slate-100">
    <div className="noise" />
    <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-8">
      <div className="flex items-center gap-3"><div className="brand-mark">z</div><div><p className="text-lg font-bold tracking-tight">zepto<span className="text-emerald-400">flow</span></p><p className="text-[10px] uppercase tracking-[.22em] text-slate-500">Order operations simulator</p></div></div>
      <div className="hidden rounded-full border border-slate-700 bg-slate-900/60 px-4 py-2 text-xs text-slate-400 sm:block"><span className="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Simulation environment</div>
    </header>

    <section className="mx-auto max-w-7xl px-5 pb-12 md:px-8">
      <div className="mb-6 panel p-6 md:px-8"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="eyebrow">ORDER #ZP-48291 · SIMULATION</p><h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">{scenario.title}</h1><p className="mt-2 text-sm text-slate-400">Current stage: <span className="font-medium text-slate-200">{stages[Math.min(progress, 8)].label}</span></p></div><span className={`status ${status === 'Cancelled' ? 'status-red' : status === 'Recovery in progress' ? 'status-amber' : 'status-green'}`}>{status}</span></div></div>

      <section className="panel overflow-hidden" aria-label="Order progress">
        <div className="border-b border-slate-800 px-6 py-4"><p className="eyebrow">ORDER JOURNEY</p></div>
        <div className="progress-wrap px-7 py-8 md:px-10"><div className="progress-line"><div className="progress-fill" style={{ width: `${(progress / 8) * 100}%`, '--mobile-progress': `${(progress / 8) * 100}%` }} /></div>{stages.map((stage, index) => {
          const isFault = scenario.id !== 'normal' && index === faultIndex && progress >= faultIndex
          const done = index < progress || (index === 8 && progress === 8 && scenario.outcome !== 'cancelled')
          const current = index === progress
          return <div className="stage" key={stage.id}><div className={`stage-dot ${done ? 'done' : ''} ${current ? 'current' : ''} ${isFault ? (scenario.outcome === 'cancelled' ? 'failed' : 'warning') : ''}`} title={stage.label}>{done ? '✓' : isFault ? '!' : stage.icon}</div><span className={`${current ? 'text-slate-100' : 'text-slate-500'}`}>{stage.label}</span></div>
        })}</div>
      </section>

      <section className="mt-6 panel p-6"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">WHAT HAPPENED</p><h2 className="mt-2 text-lg font-semibold">{scenario.id === 'normal' ? 'Everything is running normally.' : scenario.issue}</h2></div><span className={scenario.outcome === 'cancelled' ? 'chip chip-red' : scenario.id === 'normal' ? 'chip chip-green' : 'chip chip-amber'}>{scenario.outcome === 'cancelled' ? 'Cannot continue' : scenario.id === 'normal' ? 'Normal flow' : 'Can recover'}</span></div>
        <div className={`resolution-card mt-5 ${scenario.outcome === 'cancelled' ? 'resolution-terminal' : ''}`}><div className="resolution-icon">{scenario.outcome === 'cancelled' ? '×' : '✓'}</div><div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-300">{scenario.outcome === 'cancelled' ? 'What happens next' : 'Solution'}</p><p className="mt-1 text-sm leading-6 text-slate-200">{scenario.id === 'normal' ? scenario.detail : scenario.recovery}</p></div></div>
        <div className="mt-6 flex flex-wrap gap-3"><button className="button primary" onClick={next} disabled={progress >= terminal}>{scenario.outcome === 'cancelled' && progress >= terminal ? 'Order cancelled' : progress >= terminal ? 'Delivered' : scenario.id !== 'normal' && progress === faultIndex ? 'Apply solution' : 'Next stage'} <span>→</span></button><button className="button secondary" onClick={reset}>Start over</button><button className="button secondary" onClick={replay}>Auto play <span className="text-emerald-400">↻</span></button></div>
      </section>

      <section className="mt-6 panel p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">SCENARIO LIBRARY</p><p className="mt-1 text-sm text-slate-400">Choose an edge case to load its recovery path.</p></div><button className="text-xs text-emerald-400 underline-offset-4 hover:underline" onClick={() => selectScenario(normalScenario)}>Run normal flow</button></div><div className="mt-5 space-y-5">{groups.map((group) => <div key={group}><p className="mb-2 text-xs font-semibold uppercase tracking-[.16em] text-slate-500">{group}</p><div className="flex flex-wrap gap-2">{scenarios.filter((item) => item.group === group).map((item) => <button onClick={() => selectScenario(item)} className={`scenario ${scenario.id === item.id ? 'selected' : ''}`} aria-pressed={scenario.id === item.id} key={item.id}>{item.title}</button>)}</div></div>)}</div></section>
    </section>
  </main>
}

createRoot(document.getElementById('root')).render(<App />)
