import { useState } from 'react'
import { IndianRupee, Calendar, CheckCircle, ChevronDown, ChevronUp, Receipt, Loader } from 'lucide-react'
import { appendExpense, loadExpenseLog } from '../services/storage'
import { useToast } from '../components/Toast'
import { playConfirmBeep } from '../services/audio'
import { runOrQueue } from '../services/retryQueue'
import { useSavingState } from '../hooks/useSavingState'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, OWNERS } from '../config'

function ToggleGroup({ options, value, onChange, colorActive = 'bg-accent-blue text-white' }) {
  return (
    <div className="flex gap-2 flex-wrap">
      {options.map(opt => (
        <button
          key={opt}
          onClick={() => onChange(opt)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all duration-150 active:scale-95
            ${value === opt
              ? `${colorActive} border-transparent`
              : 'bg-bg-secondary border-border text-text-secondary'}`}
        >
          {opt}
        </button>
      ))}
    </div>
  )
}

export default function AddExpense() {
  const today = new Date().toLocaleDateString('en-CA')
  const [log, setLog] = useState(() => [...loadExpenseLog()].reverse())
  const [showHistory, setShowHistory] = useState(false)
  const [form, setForm] = useState({
    date: today,
    paidBy: 'Yash',
    category: 'Miscellaneous',
    description: '',
    amount: '',
    paymentMethod: 'UPI',
    recurring: 'One-time',
    notes: '',
  })
  const toast = useToast()
  const { isSaving, withSaving } = useSavingState()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    if (!form.amount || parseInt(form.amount, 10) <= 0 || !form.description.trim()) {
      toast('Amount and description are required', 'warning')
      return
    }

    withSaving(async () => {
      const entry = {
        ...form,
        amount: parseInt(form.amount, 10),
      }
      const saved = appendExpense(entry)
      runOrQueue('writeExpense', saved)
      runOrQueue('logExpense', entry)
      setLog([...loadExpenseLog()].reverse())

      playConfirmBeep()
      toast(`Expense saved · ₹${parseInt(form.amount).toLocaleString('en-IN')}`, 'success')
      setForm({ date: today, paidBy: 'Yash', category: 'Miscellaneous', description: '', amount: '', paymentMethod: 'UPI', recurring: 'One-time', notes: '' })
    })
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-text-primary">Add Expense</h1>
        <p className="text-xs text-text-secondary mt-0.5">Log a business expense</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Date + Paid By */}
        <div className="card flex flex-col gap-4">
          <div>
            <label className="label">
              <Calendar size={12} className="inline mr-1.5 -mt-0.5" />
              Date
            </label>
            <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="label">Paid By</label>
            <ToggleGroup
              options={OWNERS}
              value={form.paidBy}
              onChange={v => set('paidBy', v)}
              colorActive="bg-accent-orange text-bg-primary"
            />
          </div>
        </div>

        {/* Category + Description */}
        <div className="card flex flex-col gap-4">
          <div>
            <label className="label">Category</label>
            <div className="relative">
              <select
                value={form.category}
                onChange={e => set('category', e.target.value)}
                className="input-field appearance-none pr-10"
              >
                {EXPENSE_CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="label">Description</label>
            <input
              type="text"
              value={form.description}
              onChange={e => set('description', e.target.value)}
              placeholder="e.g. Monthly rent payment"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">
              <IndianRupee size={12} className="inline mr-1.5 -mt-0.5" />
              Amount (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₹</span>
              <input
                type="number"
                value={form.amount}
                onChange={e => set('amount', e.target.value)}
                placeholder="0"
                className="input-field pl-8"
                inputMode="numeric"
              />
            </div>
          </div>
        </div>

        {/* Payment Method + Recurring */}
        <div className="card flex flex-col gap-4">
          <div>
            <label className="label">Payment Method</label>
            <ToggleGroup options={PAYMENT_METHODS} value={form.paymentMethod} onChange={v => set('paymentMethod', v)} />
          </div>

          <div>
            <label className="label">Type</label>
            <ToggleGroup
              options={['One-time', 'Recurring']}
              value={form.recurring}
              onChange={v => set('recurring', v)}
              colorActive="bg-accent-purple text-white"
            />
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">Notes (optional)</label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="Any additional details..."
            rows={2}
            className="input-field resize-none"
          />
        </div>

        <button onClick={handleSave} disabled={isSaving} className="btn-primary w-full flex items-center justify-center gap-2">
          {isSaving ? (
            <>
              <Loader size={17} className="animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle size={17} />
              Save Expense
            </>
          )}
        </button>

        {/* Expense History */}
        <div className="card">
          <button
            onClick={() => setShowHistory(s => !s)}
            className="w-full flex items-center justify-between"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <Receipt size={14} className="text-text-muted" />
              Expense History
              {log.length > 0 && (
                <span className="text-xs text-text-muted font-normal">({log.length})</span>
              )}
            </span>
            {showHistory ? <ChevronUp size={15} className="text-text-muted" /> : <ChevronDown size={15} className="text-text-muted" />}
          </button>

          {showHistory && (
            <div className="mt-4 flex flex-col">
              {log.length === 0 ? (
                <p className="text-sm text-text-muted text-center py-6">No expenses logged yet</p>
              ) : (
                log.slice(0, 30).map(e => (
                  <div key={e.id} className="flex items-start justify-between gap-3 py-3 border-b border-border last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{e.description}</p>
                      <p className="text-xs text-text-muted mt-0.5">
                        {e.date} · {e.category} · {e.paidBy}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-accent-red">₹{e.amount.toLocaleString('en-IN')}</p>
                      {e.paymentMethod && (
                        <p className="text-[10px] text-text-muted mt-0.5">{e.paymentMethod}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
