import { useState, useEffect } from 'react'
import { Plus, Calendar, CheckCircle, IndianRupee, User, Wallet, X, Loader } from 'lucide-react'
import { appendUdhar, updateUdhar } from '../services/storage'
import { subscribeUdhar } from '../services/firebaseDb'
import { useToast } from '../components/Toast'
import { playConfirmBeep } from '../services/audio'
import { runOrQueue } from '../services/retryQueue'
import { useSavingState } from '../hooks/useSavingState'

function AddUdharForm({ onSave, onCancel, isSaving }) {
  const today = new Date().toLocaleDateString('en-CA')
  const [form, setForm] = useState({ customerName: '', amount: '', type: 'udhar', date: today, notes: '' })
  const toast = useToast()
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (isSaving) return
    if (!form.customerName.trim() || !form.amount) {
      toast('Customer name and amount are required', 'warning')
      return
    }
    onSave({ ...form, amount: parseInt(form.amount, 10) })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
         onClick={onCancel}>
      <div className="w-full max-w-md bg-bg-card rounded-t-3xl border-t border-border p-6 pb-8"
           onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-text-primary">Add Entry</h2>
          <button onClick={onCancel} className="text-text-muted"><X size={22} /></button>
        </div>

        <div className="flex flex-col gap-4">
          <div>
            <label className="label">Type</label>
            <div className="flex gap-2">
              {[
                { value: 'udhar', label: '💸 Udhar (Customer owes us)' },
                { value: 'advance', label: '💰 Advance (Customer paid ahead)' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => set('type', opt.value)}
                  className={`flex-1 py-2.5 px-2 rounded-xl text-xs font-medium border transition-all active:scale-95
                    ${form.type === opt.value
                      ? opt.value === 'udhar'
                        ? 'bg-accent-red/10 border-accent-red/40 text-accent-red'
                        : 'bg-accent-green/10 border-accent-green/40 text-accent-green'
                      : 'bg-bg-secondary border-border text-text-muted'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label"><User size={12} className="inline mr-1.5 -mt-0.5" />Customer Name</label>
            <input type="text" value={form.customerName} onChange={e => set('customerName', e.target.value)}
              placeholder="e.g. Rahul" className="input-field" />
          </div>

          <div>
            <label className="label"><IndianRupee size={12} className="inline mr-1.5 -mt-0.5" />Amount (₹)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">₹</span>
              <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)}
                placeholder="0" className="input-field pl-8" inputMode="numeric" />
            </div>
          </div>

          <div>
            <label className="label"><Calendar size={12} className="inline mr-1.5 -mt-0.5" />Date</label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input type="text" value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="e.g. for 2 hours last Friday" className="input-field" />
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onCancel} disabled={isSaving} className="btn-ghost flex-1">Cancel</button>
            <button onClick={handleSave} disabled={isSaving} className="btn-primary flex-1 flex items-center justify-center gap-2">
              {isSaving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Save
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UdharItem({ entry, onSettle }) {
  const isUdhar = entry.type === 'udhar'
  return (
    <div className={`card flex flex-col gap-3 ${entry.settled ? 'opacity-50' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center
            ${isUdhar ? 'bg-accent-red/10' : 'bg-accent-green/10'}`}>
            <Wallet size={16} className={isUdhar ? 'text-accent-red' : 'text-accent-green'} />
          </div>
          <div>
            <p className="font-semibold text-text-primary text-sm">{entry.customerName}</p>
            <p className="text-xs text-text-muted mt-0.5">{entry.date}</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`font-bold text-base ${isUdhar ? 'text-accent-red' : 'text-accent-green'}`}>
            {isUdhar ? '-' : '+'}₹{entry.amount.toLocaleString('en-IN')}
          </p>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full
            ${isUdhar ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-green/10 text-accent-green'}`}>
            {isUdhar ? 'Owes you' : 'Advance'}
          </span>
        </div>
      </div>

      {entry.notes && (
        <p className="text-xs text-text-muted bg-bg-secondary rounded-lg px-3 py-2">{entry.notes}</p>
      )}

      {!entry.settled ? (
        <button onClick={() => onSettle(entry.id)}
          className="w-full py-2 rounded-lg text-xs font-medium border border-border text-text-secondary active:scale-[0.98] transition-all">
          Mark as Settled
        </button>
      ) : (
        <p className="text-center text-xs text-accent-green font-medium">✓ Settled</p>
      )}
    </div>
  )
}

export default function Udhar() {
  const [showForm, setShowForm] = useState(false)
  const [entries, setEntries] = useState([])
  const toast = useToast()
  const { isSaving, withSaving } = useSavingState()

  // Firebase real-time listener — single source of truth
  useEffect(() => {
    const unsub = subscribeUdhar(data => setEntries(data))
    return unsub
  }, [])

  const handleSave = (data) => {
    withSaving(async () => {
      const saved = appendUdhar(data)              // local cache
      runOrQueue('writeUdhar', saved)              // Firebase (real-time)
      runOrQueue('logUdhar', data)                 // Sheets (backup)
      playConfirmBeep()
      toast('Entry saved', 'success')
      setShowForm(false)
    })
  }

  const handleSettle = (id) => {
    const entry = entries.find(e => String(e.id) === String(id))
    if (!entry) return

    const updates = { settled: true, settledAt: new Date().toISOString() }
    // Update all layers
    updateUdhar(id, updates)                                        // local cache
    runOrQueue('updateUdharFb', { id: String(id), updates })       // Firebase (real-time)
    const settleData = { customerName: entry.customerName, amount: entry.amount, type: entry.type, date: entry.date }
    runOrQueue('settleUdhar', settleData)                          // Sheets (backup)
    toast('Marked as settled', 'success')
  }

  const sorted = [...entries].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const pending = sorted.filter(e => !e.settled)
  const settled = sorted.filter(e => e.settled)

  const totalUdhar   = pending.filter(e => e.type === 'udhar').reduce((s, e) => s + e.amount, 0)
  const totalAdvance = pending.filter(e => e.type === 'advance').reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Advance / Udhar</h1>
          <p className="text-xs text-text-secondary mt-0.5">Track customer credits and debts</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="w-9 h-9 rounded-xl bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center">
          <Plus size={18} className="text-accent-blue" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {(totalUdhar > 0 || totalAdvance > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <div className="stat-card">
              <p className="text-xs text-text-muted">Customers Owe You</p>
              <p className="text-xl font-bold text-accent-red">₹{totalUdhar.toLocaleString('en-IN')}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-text-muted">Advance Collected</p>
              <p className="text-xl font-bold text-accent-green">₹{totalAdvance.toLocaleString('en-IN')}</p>
            </div>
          </div>
        )}

        {pending.length === 0 && settled.length === 0 && (
          <div className="card flex flex-col items-center py-10 gap-3 text-center">
            <Wallet size={36} className="text-text-muted" />
            <p className="text-text-secondary text-sm">No advance or udhar entries yet</p>
            <button onClick={() => setShowForm(true)} className="btn-primary text-sm px-5 py-2.5">
              Add First Entry
            </button>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1">Pending</p>
            {pending.map(e => <UdharItem key={e.id} entry={e} onSettle={handleSettle} />)}
          </>
        )}

        {settled.length > 0 && (
          <>
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider px-1 mt-2">Settled</p>
            {settled.map(e => <UdharItem key={e.id} entry={e} onSettle={handleSettle} />)}
          </>
        )}
      </div>

      {showForm && <AddUdharForm onSave={handleSave} onCancel={() => setShowForm(false)} isSaving={isSaving} />}
    </div>
  )
}
