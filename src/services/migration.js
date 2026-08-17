import { getSessions, getUdharList, getExpenses } from './sheetsApi'
import { writeSession, writeExpense, writeUdhar } from './firebaseDb'

// Generates a stable numeric ID for sheet rows that have no ID stored.
// Uses the date timestamp + rowIndex offset, well below real Date.now() values.
function stableId(dateStr, rowIndex) {
  try {
    return new Date(dateStr + 'T00:00:00').getTime() + rowIndex
  } catch {
    return Date.now() + rowIndex
  }
}

export async function migrateFromSheets(onProgress) {
  const results = { sessions: 0, expenses: 0, udhar: 0, errors: [] }

  // ── Sessions ────────────────────────────────────────────────────────────────
  try {
    onProgress('Fetching sessions from Google Sheets…')
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
      results.sessions = sessions.length
    }
  } catch (e) {
    results.errors.push(`sessions fetch: ${e.message}`)
  }

  // ── Expenses ────────────────────────────────────────────────────────────────
  try {
    onProgress('Fetching expenses from Google Sheets…')
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

  // ── Udhar ───────────────────────────────────────────────────────────────────
  try {
    onProgress('Fetching udhar from Google Sheets…')
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
