import { getSessions, getUdharList, getExpenses, getDailyRevenue } from './sheetsApi'
import { writeSession, writeExpense, writeUdhar } from './firebaseDb'

function stableId(dateStr, offset) {
  try {
    return new Date(dateStr + 'T00:00:00').getTime() + offset
  } catch {
    return Date.now() + offset
  }
}

export async function migrateFromSheets(onProgress) {
  const results = { sessions: 0, expenses: 0, udhar: 0, errors: [] }

  // ── Individual Sessions (from Sessions tab) ──────────────────────────────────
  try {
    onProgress('Fetching sessions…')
    const res = await getSessions()
    if (res.ok && res.data?.sessions?.length) {
      const sessions = res.data.sessions
      onProgress(`Importing ${sessions.length} sessions…`)
      await Promise.all(sessions.map(s =>
        writeSession({
          id: s.id,
          date: s.date,
          station: s.station,
          stationIndex: s.stationIndex,
          amount: s.amount,
          players: s.players || 1,
          durationMins: s.durationMins || 0,
          notes: s.notes || '',
          savedAt: s.savedAt || new Date().toISOString(),
        }).catch(e => results.errors.push(`session ${s.id}: ${e.message}`))
      ))
      results.sessions += sessions.length
    }
  } catch (e) {
    results.errors.push(`sessions fetch: ${e.message}`)
  }

  // ── Daily Revenue (aggregated rows → synthetic sessions) ─────────────────────
  // Handles the case where history is only in Daily Revenue tab, not Sessions tab.
  try {
    onProgress('Fetching daily revenue history…')
    const res = await getDailyRevenue()
    if (res.ok && res.data?.rows?.length) {
      const rows = res.data.rows
      onProgress(`Importing revenue from ${rows.length} days…`)
      const writes = []
      rows.forEach((row, i) => {
        const base = stableId(row.date, i * 10)
        // Station 1
        if (row.ps5_1 > 0) {
          writes.push(writeSession({
            id: base + 1,
            date: row.date,
            station: 'PS5 Station 1',
            stationIndex: 1,
            amount: row.ps5_1,
            players: row.customers || 1,
            durationMins: 0,
            notes: row.notes || '',
            savedAt: new Date(row.date + 'T00:00:00').toISOString(),
          }).catch(e => results.errors.push(`daily rev S1 ${row.date}: ${e.message}`)))
        }
        // Station 2
        if (row.ps5_2 > 0) {
          writes.push(writeSession({
            id: base + 2,
            date: row.date,
            station: 'PS5 Station 2',
            stationIndex: 2,
            amount: row.ps5_2,
            players: row.customers || 1,
            durationMins: 0,
            notes: row.notes || '',
            savedAt: new Date(row.date + 'T00:00:00').toISOString(),
          }).catch(e => results.errors.push(`daily rev S2 ${row.date}: ${e.message}`)))
        }
        // Other revenue
        if (row.other > 0) {
          writes.push(writeSession({
            id: base + 3,
            date: row.date,
            station: 'Other',
            stationIndex: 0,
            amount: row.other,
            players: 0,
            durationMins: 0,
            notes: row.notes || '',
            savedAt: new Date(row.date + 'T00:00:00').toISOString(),
          }).catch(e => results.errors.push(`daily rev Other ${row.date}: ${e.message}`)))
        }
      })
      await Promise.all(writes)
      results.sessions += writes.length
    }
  } catch (e) {
    results.errors.push(`daily revenue fetch: ${e.message}`)
  }

  // ── Expenses ─────────────────────────────────────────────────────────────────
  try {
    onProgress('Fetching expenses…')
    const res = await getExpenses()
    if (res.ok && res.data?.expenses?.length) {
      const expenses = res.data.expenses
      onProgress(`Importing ${expenses.length} expenses…`)
      await Promise.all(expenses.map(e =>
        writeExpense({
          id: stableId(e.date, e.rowIndex),
          date: e.date,
          paidBy: e.paidBy,
          category: e.category,
          description: e.description,
          amount: e.amount,
          paymentMethod: e.paymentMethod,
          recurring: e.recurring,
          notes: e.notes || '',
          savedAt: new Date().toISOString(),
        }).catch(err => results.errors.push(`expense row ${e.rowIndex}: ${err.message}`))
      ))
      results.expenses = expenses.length
    }
  } catch (e) {
    results.errors.push(`expenses fetch: ${e.message}`)
  }

  // ── Udhar ─────────────────────────────────────────────────────────────────────
  try {
    onProgress('Fetching udhar…')
    const res = await getUdharList()
    if (res.ok && res.data?.entries?.length) {
      const entries = res.data.entries
      onProgress(`Importing ${entries.length} udhar entries…`)
      await Promise.all(entries.map(e =>
        writeUdhar({
          id: stableId(e.date, e.rowIndex),
          customerName: e.customerName,
          amount: e.amount,
          type: e.type,
          date: e.date,
          notes: e.notes || '',
          settled: e.settled || false,
          settledAt: e.settledDate || null,
          savedAt: new Date().toISOString(),
        }).catch(err => results.errors.push(`udhar row ${e.rowIndex}: ${err.message}`))
      ))
      results.udhar = entries.length
    }
  } catch (e) {
    results.errors.push(`udhar fetch: ${e.message}`)
  }

  return results
}
