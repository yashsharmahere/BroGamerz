import { useState } from 'react'
import { X, IndianRupee, Users, Trash2, ChevronDown } from 'lucide-react'
import { STATIONS } from '../config'

export default function EditSessionModal({ entry, onSave, onDelete, onCancel }) {
  const [form, setForm] = useState({
    date:         entry.date,
    stationIndex: entry.stationIndex,
    station:      entry.station,
    amount:       String(entry.amount),
    players:      String(entry.players || 1),
    durationMins: String(entry.durationMins || 0),
    notes:        entry.notes || '',
  })
  const [confirmDelete, setConfirmDelete] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = () => {
    onSave({
      ...entry,
      ...form,
      stationIndex: Number(form.stationIndex),
      amount:       parseInt(form.amount, 10) || 0,
      players:      parseInt(form.players, 10) || 1,
      durationMins: parseInt(form.durationMins, 10) || 0,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
         onClick={onCancel}>
      <div className="w-full max-w-md bg-bg-card rounded-t-3xl border-t border-border flex flex-col max-h-[90dvh]"
           onClick={e => e.stopPropagation()}>

        {/* Header — always visible */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 shrink-0">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Edit Session</h2>
            <p className="text-xs text-text-muted mt-0.5">
              {new Date(entry.savedAt || entry.date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}
            </p>
          </div>
          <button onClick={onCancel} className="text-text-muted p-1"><X size={22} /></button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-4">
          {/* Date */}
          <div>
            <label className="label">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => set('date', e.target.value)}
              className="input-field"
            />
          </div>

          {/* Station */}
          <div>
            <label className="label">Station</label>
            <div className="relative">
              <select
                value={form.stationIndex}
                onChange={e => {
                  const idx = Number(e.target.value)
                  const s = STATIONS.find(s => {
                    if (idx === 0) return true
                    return s.id === `ps5_${idx}`
                  })
                  set('stationIndex', idx)
                  set('station', idx === 0 ? 'Other' : s?.name || '')
                }}
                className="input-field appearance-none pr-10"
              >
                <option value={1}>PS5 Station 1</option>
                <option value={2}>PS5 Station 2</option>
                <option value={0}>Other</option>
              </select>
              <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            </div>
          </div>

          {/* Amount + Players */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label"><IndianRupee size={11} className="inline mr-1 -mt-0.5" />Amount (₹)</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm">₹</span>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set('amount', e.target.value)}
                  className="input-field pl-8"
                  inputMode="numeric"
                />
              </div>
            </div>
            <div>
              <label className="label"><Users size={11} className="inline mr-1 -mt-0.5" />Players</label>
              <input
                type="number"
                value={form.players}
                onChange={e => set('players', e.target.value)}
                className="input-field"
                inputMode="numeric"
                min="1"
              />
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="label">Duration (minutes)</label>
            <input
              type="number"
              value={form.durationMins}
              onChange={e => set('durationMins', e.target.value)}
              className="input-field"
              inputMode="numeric"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="label">Notes</label>
            <input
              type="text"
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Optional note"
              className="input-field"
            />
          </div>
        </div>

        {/* Actions — always visible at bottom */}
        <div className="flex gap-3 px-6 pt-4 pb-8 shrink-0">
          {!confirmDelete ? (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-10 h-11 rounded-xl bg-accent-red/10 border border-accent-red/30
                           flex items-center justify-center shrink-0 active:scale-95"
              >
                <Trash2 size={16} className="text-accent-red" />
              </button>
              <button onClick={onCancel} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleSave} className="btn-primary flex-1">Save</button>
            </>
          ) : (
            <>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1">Keep it</button>
              <button
                onClick={() => onDelete(entry.id)}
                className="btn-danger flex-1 flex items-center justify-center gap-2"
              >
                <Trash2 size={15} />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
