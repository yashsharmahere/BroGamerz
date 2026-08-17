import { useState } from 'react'
import { X, Clock, Users, IndianRupee } from 'lucide-react'

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  return `${m}m ${s}s`
}

export default function EndSessionModal({ session, onConfirm, onCancel }) {
  const [amount, setAmount] = useState(String(session.currentCharge))
  const [players, setPlayers] = useState(String(session.players))
  const [notes, setNotes] = useState('')

  const handleConfirm = () => {
    const parsedAmount = parseInt(amount, 10) || 0
    const parsedPlayers = parseInt(players, 10) || 1
    onConfirm({
      amount: parsedAmount,
      players: parsedPlayers,
      durationMins: Math.round(session.elapsed / 60),
      notes,
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
            <h2 className="text-lg font-bold text-text-primary">End Session</h2>
            <p className="text-sm text-text-secondary mt-0.5">{session.name}</p>
          </div>
          <button onClick={onCancel} className="text-text-muted p-1">
            <X size={22} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-4">
          {/* Session Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-secondary rounded-xl p-3 flex items-center gap-2.5">
              <Clock size={16} className="text-accent-blue shrink-0" />
              <div>
                <p className="text-[11px] text-text-muted">Duration</p>
                <p className="text-sm font-semibold text-text-primary font-mono">
                  {formatDuration(session.elapsed)}
                </p>
              </div>
            </div>
            <div className="bg-bg-secondary rounded-xl p-3 flex items-center gap-2.5">
              <Users size={16} className="text-accent-purple shrink-0" />
              <div>
                <p className="text-[11px] text-text-muted">Players</p>
                <p className="text-sm font-semibold text-text-primary">{session.players}</p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div>
            <label className="label">Amount Charged (₹)</label>
            <div className="relative">
              <IndianRupee size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="input-field pl-9 text-lg font-semibold"
                inputMode="numeric"
              />
            </div>
            <p className="text-xs text-text-muted mt-1">
              Auto-calculated · edit if you gave a discount or extra charge
            </p>
          </div>

          <div>
            <label className="label">Players</label>
            <input
              type="number"
              value={players}
              onChange={e => setPlayers(e.target.value)}
              className="input-field"
              inputMode="numeric"
              min="1"
            />
          </div>

          <div>
            <label className="label">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. gave 10 min free"
              className="input-field"
            />
          </div>
        </div>

        {/* Actions — always visible at bottom */}
        <div className="flex gap-3 px-6 pt-4 pb-8 shrink-0">
          <button onClick={onCancel} className="btn-ghost flex-1">Keep Running</button>
          <button onClick={handleConfirm} className="btn-primary flex-1">
            Save Session
          </button>
        </div>
      </div>
    </div>
  )
}
