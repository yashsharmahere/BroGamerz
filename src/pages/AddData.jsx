import { useState } from 'react'
import { IndianRupee, Users, StickyNote, Calendar, CheckCircle } from 'lucide-react'
import { appendRevenue } from '../services/storage'
import { logManualRevenue } from '../services/sheetsApi'
import { writeSession } from '../services/firebaseDb'
import { useToast } from '../components/Toast'
import { playConfirmBeep } from '../services/audio'
import { queueOperation } from '../services/retryQueue'

export default function AddData() {
  const today = new Date().toLocaleDateString('en-CA')
  const [form, setForm] = useState({
    date: today,
    otherRevenue: '',
    customers: '',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const amount = parseInt(form.otherRevenue, 10) || 0
    const customers = parseInt(form.customers, 10) || 0

    if (!amount && !customers) {
      toast('Enter at least revenue or customer count', 'warning')
      return
    }

    setSaving(true)
    try {
      const saved = appendRevenue({
        date: form.date,
        station: 'Other',
        stationIndex: 0,
        amount,
        players: customers,
        notes: form.notes,
      })
      writeSession(saved).catch(err => {
        queueOperation(() => writeSession(saved), 'writeSession', {})
      })
      logManualRevenue({
        date: form.date,
        otherRevenue: amount,
        customers,
        notes: form.notes,
      }).catch(err => {
        queueOperation(
          () => logManualRevenue({ date: form.date, otherRevenue: amount, customers, notes: form.notes }),
          'logManualRevenue',
          {}
        )
      })

      playConfirmBeep()
      toast('Revenue logged successfully', 'success')
      setForm({ date: today, otherRevenue: '', customers: '', notes: '' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3">
        <h1 className="text-xl font-bold text-text-primary">Add Revenue</h1>
        <p className="text-xs text-text-secondary mt-0.5">Log other income & customer count</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 flex flex-col gap-4">
        {/* Date */}
        <div className="card flex flex-col gap-4">
          <div>
            <label className="label">
              <Calendar size={12} className="inline mr-1.5 -mt-0.5" />
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="input-field"
            />
          </div>
        </div>

        {/* Revenue */}
        <div className="card flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-text-primary">Revenue Details</h2>
          <div>
            <label className="label">
              <IndianRupee size={12} className="inline mr-1.5 -mt-0.5" />
              Other Revenue (₹)
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted font-medium">₹</span>
              <input
                type="number"
                value={form.otherRevenue}
                onChange={e => set('otherRevenue', e.target.value)}
                placeholder="0"
                className="input-field pl-8"
                inputMode="numeric"
              />
            </div>
            <p className="text-xs text-text-muted mt-1.5">
              For F&B, merchandise, or any other income (PS5 sessions are auto-logged from the Sessions tab)
            </p>
          </div>

          <div>
            <label className="label">
              <Users size={12} className="inline mr-1.5 -mt-0.5" />
              Additional Customer Count
            </label>
            <input
              type="number"
              value={form.customers}
              onChange={e => set('customers', e.target.value)}
              placeholder="0"
              className="input-field"
              inputMode="numeric"
            />
            <p className="text-xs text-text-muted mt-1.5">
              Customers not already counted in PS5 sessions (walk-ins, spectators, etc.)
            </p>
          </div>
        </div>

        {/* Notes */}
        <div className="card">
          <label className="label">
            <StickyNote size={12} className="inline mr-1.5 -mt-0.5" />
            Notes (optional)
          </label>
          <textarea
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            placeholder="e.g. sold chips, birthday party group..."
            rows={3}
            className="input-field resize-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <CheckCircle size={17} />
          Save Entry
        </button>
      </div>
    </div>
  )
}
