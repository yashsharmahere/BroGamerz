// ─── Bro Gamerz — Google Apps Script Backend ─────────────────────────────────
// Instructions:
//   1. Open your Google Sheet → Extensions → Apps Script
//   2. Replace the default code with this entire file
//   3. Click Deploy → New deployment → Web App
//      - Execute as: Me
//      - Who has access: Anyone
//   4. Copy the Web App URL and paste it in src/config.js → APPS_SCRIPT_URL

const SHEET_ID = '1EWFKh46f8c4bkxYbx0A-AekARfQj5Fmr0-2dTDvYav8'
const ss = SpreadsheetApp.openById(SHEET_ID)

// ─── Router ───────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents)
    let result

    switch (payload.action) {
      case 'logSession':       result = logSession(payload);        break
      case 'logExpense':       result = logExpense(payload);        break
      case 'logUdhar':         result = logUdhar(payload);          break
      case 'logManualRevenue': result = logManualRevenue(payload);  break
      case 'updateDayRevenue': result = updateDayRevenue(payload);  break
      case 'settleUdhar':      result = settleUdharEntry(payload);  break
      case 'saveActiveSessions': result = saveActiveSessions(payload); break
      case 'updateSession':      result = updateSession(payload);      break
      case 'deleteSession':      result = deleteSession(payload);      break
      default:                 result = { error: 'Unknown action' }
    }

    // Installable onEdit triggers DON'T fire for programmatic (API) edits, so the
    // app writing to the sheet via doPost would never rebuild Firebase. Rebuild
    // here for any action that changes the session log.
    if (['logSession', 'logManualRevenue', 'updateDayRevenue', 'updateSession', 'deleteSession'].indexOf(payload.action) !== -1) {
      try { rebuildSessions() } catch (e) { Logger.log('rebuild after ' + payload.action + ': ' + e.message) }
    }

    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action
    let result

    switch (action) {
      case 'getDashboard':    result = getDashboard();                      break
      case 'getUdhar':        result = getUdharList();                      break
      case 'getDailyRevenue':    result = getDailyRevenue(e.parameter.month);  break
      case 'getActiveSessions':  result = getActiveSessions();                  break
      case 'getSessions':        result = getSessions(e.parameter.month);       break
      case 'getExpenses':        result = getExpensesList();                     break
      default:                result = { error: 'Unknown action' }
    }

    return jsonResponse(result)
  } catch (err) {
    return jsonResponse({ error: err.message })
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getOrCreateSheet(name, headers) {
  let sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
    sheet.getRange(1, 1, 1, headers.length).setValues([headers])
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold')
  }
  return sheet
}

function findRowByDate(sheet, dateStr) {
  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const cellDate = data[i][0]
    if (!cellDate) continue
    const rowDate = typeof cellDate === 'string'
      ? cellDate
      : Utilities.formatDate(new Date(cellDate), 'Asia/Kolkata', 'yyyy-MM-dd')
    if (rowDate === dateStr) return i + 1 // 1-indexed row number
  }
  return -1
}

// Add `delta` to a station's Daily Revenue cell (B/C/D) for a date. Incremental
// and exact (the server knows the real session amount), so it NEVER wipes a
// value that was typed straight into the sheet — a logged session ADDS to
// whatever total is already there, and delete/edit subtract the exact amount.
// stationIndex: 1 → col B, 2 → col C, 0 (Other) → col D.
function adjustDailyRevenue(dateStr, stationIndex, delta) {
  if (!delta) return
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) return
  let rowNum = findRowByDate(sheet, dateStr)
  if (rowNum === -1) { sheet.appendRow([dateStr, '', '', '', '', '', '']); rowNum = sheet.getLastRow() }
  const col = stationIndex === 1 ? 2 : stationIndex === 2 ? 3 : 4
  const existing = Number(sheet.getRange(rowNum, col).getValue()) || 0
  const val = existing + delta
  sheet.getRange(rowNum, col).setValue(val > 0 ? val : '') // clear to blank at 0 → drops out
}

// ─── Log Session → Sessions tab, then sync Daily Revenue from the sessions ────
function logSession({ id, date, stationIndex, amount, players, durationMins, notes, station, savedAt }) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) throw new Error('Daily Revenue sheet not found')

  // Write individual session to Sessions tab (for cross-device log sharing)
  const sessSheet = getOrCreateSheet('Sessions', [
    'ID', 'Date', 'Station', 'StationIndex', 'Amount', 'Players', 'DurationMins', 'Notes', 'SavedAt', 'EditedAt'
  ])
  const stationName = station || (stationIndex === 1 ? 'PS5 Station 1' : stationIndex === 2 ? 'PS5 Station 2' : 'Other')
  sessSheet.appendRow([String(id || ''), date, stationName, stationIndex, amount, players || 1, durationMins || 0, notes || '', savedAt || date, ''])

  // Customers + notes accumulate on the Daily Revenue row
  let rowNum = findRowByDate(sheet, date)
  if (rowNum === -1) { sheet.appendRow([date, '', '', '', '', '', '']); rowNum = sheet.getLastRow() }
  const existingCust = sheet.getRange(rowNum, 6).getValue() || 0
  sheet.getRange(rowNum, 6).setValue(existingCust + (players || 1))
  if (notes) {
    const existingNotes = sheet.getRange(rowNum, 7).getValue() || ''
    sheet.getRange(rowNum, 7).setValue(existingNotes ? `${existingNotes}; ${notes}` : notes)
  }

  // ADD this session's amount to whatever total is already there (never wipes it)
  adjustDailyRevenue(date, stationIndex, Number(amount) || 0)
  return { success: true }
}

// ─── Log Manual Revenue → Daily Revenue tab + Sessions tab ───────────────────
function logManualRevenue({ id, date, otherRevenue, customers, notes }) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) throw new Error('Daily Revenue sheet not found')

  // Record it as an individual "Other" session too, so it keeps its own log
  // entry (matched to the app by id) instead of collapsing into a daily total.
  if (otherRevenue) {
    const sessSheet = getOrCreateSheet('Sessions', [
      'ID', 'Date', 'Station', 'StationIndex', 'Amount', 'Players', 'DurationMins', 'Notes', 'SavedAt', 'EditedAt'
    ])
    sessSheet.appendRow([String(id || ''), date, 'Other', 0, otherRevenue, customers || 0, 0, notes || '', new Date().toISOString(), ''])
  }

  // Customers + notes accumulate on the Daily Revenue row
  let rowNum = findRowByDate(sheet, date)
  if (rowNum === -1) { sheet.appendRow([date, '', '', '', '', '', '']); rowNum = sheet.getLastRow() }
  if (customers) {
    const existing = sheet.getRange(rowNum, 6).getValue() || 0
    sheet.getRange(rowNum, 6).setValue(existing + customers)
  }
  if (notes) {
    const existing = sheet.getRange(rowNum, 7).getValue() || ''
    sheet.getRange(rowNum, 7).setValue(existing ? `${existing}; ${notes}` : notes)
  }

  // ADD the other-revenue amount to whatever is already there (never wipes it)
  adjustDailyRevenue(date, 0, Number(otherRevenue) || 0)
  return { success: true }
}

// ─── Log Expense → Expenses tab ──────────────────────────────────────────────
function logExpense({ date, paidBy, category, description, amount, paymentMethod, recurring, notes }) {
  const sheet = ss.getSheetByName('Expenses')
  if (!sheet) throw new Error('Expenses sheet not found')

  sheet.appendRow([date, paidBy, category, description, amount, paymentMethod, recurring, notes || ''])
  return { success: true }
}

// ─── Update a station's daily total (after edit/delete) ──────────────────────
function updateDayRevenue({ date, stationIndex, newTotal }) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) throw new Error('Daily Revenue sheet not found')

  let rowNum = findRowByDate(sheet, date)
  if (rowNum === -1) {
    // Create the row if it doesn't exist yet
    const newRow = [date, '', '', '', '', '', '']
    sheet.appendRow(newRow)
    rowNum = sheet.getLastRow()
  }

  const col = stationIndex === 1 ? 2 : stationIndex === 2 ? 3 : 4  // B, C, or D (other)
  sheet.getRange(rowNum, col).setValue(newTotal)
  return { success: true }
}

// ─── Log Udhar → Udhar tab (new tab) ─────────────────────────────────────────
function logUdhar({ customerName, amount, type, date, notes }) {
  const sheet = getOrCreateSheet('Udhar', [
    'Date', 'Customer Name', 'Type', 'Amount', 'Notes', 'Settled', 'Settled Date'
  ])
  sheet.appendRow([date, customerName, type, amount, notes || '', 'No', ''])
  return { success: true }
}

// ─── Get Dashboard Data ───────────────────────────────────────────────────────
function getDashboard() {
  const revenueSheet = ss.getSheetByName('Daily Revenue')
  const expenseSheet = ss.getSheetByName('Expenses')

  const today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd')
  const month = today.slice(0, 7)

  // Revenue
  const revData = revenueSheet ? revenueSheet.getDataRange().getValues().slice(1) : []
  let todayRevenue = 0, todayCustomers = 0, monthRevenue = 0, totalCustomers = 0, ps5_1 = 0, ps5_2 = 0, otherRev = 0

  revData.forEach(row => {
    if (!row[0]) return
    const rowDate = typeof row[0] === 'string'
      ? row[0]
      : Utilities.formatDate(new Date(row[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
    const s1 = Number(row[1]) || 0
    const s2 = Number(row[2]) || 0
    const other = Number(row[3]) || 0
    const total = s1 + s2 + other
    const cust = Number(row[5]) || 0

    if (rowDate === today) { todayRevenue += total; todayCustomers += cust }
    if (rowDate.startsWith(month)) { monthRevenue += total; totalCustomers += cust }
    ps5_1 += s1; ps5_2 += s2; otherRev += other
  })

  // Expenses
  const expData = expenseSheet ? expenseSheet.getDataRange().getValues().slice(1) : []
  let monthExpenses = 0, totalExpenses = 0
  const categoryTotals = {}

  expData.forEach(row => {
    if (!row[0]) return
    const rowDate = typeof row[0] === 'string'
      ? row[0]
      : Utilities.formatDate(new Date(row[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
    const amt = Number(row[4]) || 0
    const cat = row[2] || 'Other'
    totalExpenses += amt
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt
    if (rowDate.startsWith(month)) monthExpenses += amt
  })

  return {
    today: { revenue: todayRevenue, customers: todayCustomers },
    month: {
      revenue: monthRevenue,
      expenses: monthExpenses,
      netProfit: monthRevenue - monthExpenses,
      customers: totalCustomers,
    },
    allTime: {
      revenue: ps5_1 + ps5_2 + otherRev,
      expenses: totalExpenses,
      ps5_1, ps5_2, otherRev,
    },
    categoryTotals,
  }
}

// ─── Get Udhar List ───────────────────────────────────────────────────────────
function getUdharList() {
  const sheet = ss.getSheetByName('Udhar')
  if (!sheet) return { entries: [] }

  const data = sheet.getDataRange().getValues().slice(1)
  const entries = data
    .filter(r => r[0])
    .map((r, i) => ({
      rowIndex: i + 2,
      date: r[0],
      customerName: r[1],
      type: r[2],
      amount: Number(r[3]),
      notes: r[4],
      settled: r[5] === 'Yes',
      settledDate: r[6],
    }))

  return { entries }
}

// ─── Settle Udhar Entry ───────────────────────────────────────────────────────
function settleUdharEntry({ customerName, amount, type, date }) {
  const sheet = ss.getSheetByName('Udhar')
  if (!sheet) return { success: false, error: 'Udhar sheet not found' }

  const data = sheet.getDataRange().getValues()
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const rowDate = typeof row[0] === 'string'
      ? row[0]
      : Utilities.formatDate(new Date(row[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
    const nameMatch = String(row[1]).trim().toLowerCase() === String(customerName).trim().toLowerCase()
    const amtMatch  = Number(row[3]) === Number(amount)
    const typeMatch = String(row[2]).trim().toLowerCase() === String(type).trim().toLowerCase()
    const dateMatch = rowDate === date
    const notSettled = row[5] !== 'Yes'

    if (nameMatch && amtMatch && typeMatch && dateMatch && notSettled) {
      const settledDate = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd')
      sheet.getRange(i + 1, 6).setValue('Yes')
      sheet.getRange(i + 1, 7).setValue(settledDate)
      return { success: true }
    }
  }
  return { success: false, error: 'Matching unsettled entry not found' }
}

// ─── Sessions Log (individual entries, cross-device) ─────────────────────────
function getSessions(month) {
  const sheet = ss.getSheetByName('Sessions')
  if (!sheet) return { sessions: [] }

  const data = sheet.getDataRange().getValues().slice(1)
  const sessions = data
    .filter(r => r[0] && r[1] && (!month || String(r[1]).startsWith(month)))
    .map((r, i) => ({
      id: Number(r[0]) || String(r[0]),
      date: typeof r[1] === 'string' ? r[1] : Utilities.formatDate(new Date(r[1]), 'Asia/Kolkata', 'yyyy-MM-dd'),
      station: r[2],
      stationIndex: Number(r[3]),
      amount: Number(r[4]),
      players: Number(r[5]) || 1,
      durationMins: Number(r[6]) || 0,
      notes: r[7] || '',
      savedAt: r[8] ? String(r[8]) : '',
      editedAt: r[9] ? String(r[9]) : '',
      rowIndex: i + 2,
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))

  return { sessions }
}

function updateSession({ id, date, station, stationIndex, amount, players, durationMins, notes }) {
  const sheet = ss.getSheetByName('Sessions')
  if (!sheet) return { success: false, error: 'Sessions sheet not found' }

  const data = sheet.getDataRange().getValues()
  const sid = String(id)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === sid) {
      // Remember the row's old date/station/amount so we can adjust exactly.
      const oldRaw = data[i][1]
      const oldDate = typeof oldRaw === 'string' ? oldRaw : Utilities.formatDate(new Date(oldRaw), 'Asia/Kolkata', 'yyyy-MM-dd')
      const oldStationIndex = Number(data[i][3])
      const oldAmount = Number(data[i][4]) || 0

      const editedAt = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm')
      sheet.getRange(i + 1, 2).setValue(date)
      sheet.getRange(i + 1, 3).setValue(station)
      sheet.getRange(i + 1, 4).setValue(stationIndex)
      sheet.getRange(i + 1, 5).setValue(amount)
      sheet.getRange(i + 1, 6).setValue(players || 1)
      sheet.getRange(i + 1, 7).setValue(durationMins || 0)
      sheet.getRange(i + 1, 8).setValue(notes || '')
      sheet.getRange(i + 1, 10).setValue(editedAt)

      // Remove the old amount from where it was, add the new amount where it is now.
      adjustDailyRevenue(oldDate, oldStationIndex, -oldAmount)
      adjustDailyRevenue(date, stationIndex, Number(amount) || 0)
      return { success: true }
    }
  }
  return { success: false, error: 'Session not found' }
}

function deleteSession({ id }) {
  const sheet = ss.getSheetByName('Sessions')
  if (!sheet) return { success: false, error: 'Sessions sheet not found' }

  const data = sheet.getDataRange().getValues()
  const sid = String(id)
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === sid) {
      const raw = data[i][1]
      const dateStr = typeof raw === 'string' ? raw : Utilities.formatDate(new Date(raw), 'Asia/Kolkata', 'yyyy-MM-dd')
      const si = Number(data[i][3])
      const amt = Number(data[i][4]) || 0
      sheet.deleteRow(i + 1)
      adjustDailyRevenue(dateStr, si, -amt) // subtract exactly this session's amount
      return { success: true }
    }
  }
  return { success: false, error: 'Session not found' }
}

// ─── Cross-Device Session Sync (PropertiesService) ───────────────────────────
function saveActiveSessions({ sessions }) {
  PropertiesService.getScriptProperties().setProperty('activeSessions', JSON.stringify(sessions))
  return { success: true }
}

function getActiveSessions() {
  const raw = PropertiesService.getScriptProperties().getProperty('activeSessions')
  return { sessions: raw ? JSON.parse(raw) : null, serverTime: Date.now() }
}

// ─── Get All Expenses ─────────────────────────────────────────────────────────
function getExpensesList() {
  const sheet = ss.getSheetByName('Expenses')
  if (!sheet) return { expenses: [] }

  const data = sheet.getDataRange().getValues().slice(1)
  const expenses = data
    .filter(r => r[0])
    .map((r, i) => ({
      rowIndex: i + 2,
      date: typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd'),
      paidBy: r[1] || '',
      category: r[2] || 'Miscellaneous',
      description: r[3] || '',
      amount: Number(r[4]) || 0,
      paymentMethod: r[5] || 'Cash',
      recurring: r[6] || 'One-time',
      notes: r[7] || '',
    }))

  return { expenses }
}

// ─── Firebase REST Sync (onEdit trigger) ─────────────────────────────────────
const FIREBASE_URL = 'https://brogamerz-default-rtdb.asia-southeast1.firebasedatabase.app/brogamerz'

// Run this once from Apps Script editor to install the trigger
function setupTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'onSheetEdit')
    .forEach(t => ScriptApp.deleteTrigger(t))
  ScriptApp.newTrigger('onSheetEdit').forSpreadsheet(ss).onEdit().create()
  Logger.log('onSheetEdit trigger installed')
}

function firebasePut(path, data) {
  UrlFetchApp.fetch(FIREBASE_URL + path + '.json', {
    method: 'PUT',
    contentType: 'application/json',
    payload: JSON.stringify(data),
    muteHttpExceptions: true,
  })
}

function stableIdGs(dateStr, offset) {
  try { return new Date(dateStr + 'T00:00:00').getTime() + offset }
  catch(e) { return Date.now() + offset }
}

function stationName(si) {
  return si === 1 ? 'PS5 Station 1' : si === 2 ? 'PS5 Station 2' : 'Other'
}

function onSheetEdit(e) {
  const sheet = e.range.getSheet()
  const row = e.range.getRow()
  try {
    switch (sheet.getName()) {
      // Daily Revenue is the source of truth for the session log. Any edit
      // (add / change / clear a cell) rebuilds the entire /sessions node.
      case 'Daily Revenue': rebuildSessions();          break
      case 'Sessions':      rebuildSessions();          break
      case 'Expenses':      syncExpenseRow(sheet, row); break
      case 'Udhar':         syncUdharRow(sheet, row);   break
    }
  } catch(err) { Logger.log('onSheetEdit error: ' + err.message) }
}

// Rebuild the ENTIRE Firebase /sessions node with one atomic PUT.
//
// Daily Revenue holds the authoritative TOTAL per date+station; the Sessions tab
// holds the individual breakdown. For each date+station that has a value:
//   • if the individual sessions add up to the Daily Revenue total → emit them
//     individually (so each start/stop keeps its own log entry)
//   • if they DON'T add up (a total was typed/edited straight into the sheet, or
//     there are no individual rows) → emit ONE aggregate entry at the sheet's
//     total, so the PWA total always matches the sheet
//   • a cleared Daily Revenue cell drops out entirely (the delete fix)
// A full-node PUT is a reliable WRITE (unlike REST DELETE) and leaves no orphans.
function rebuildSessions() {
  const drSheet = ss.getSheetByName('Daily Revenue')
  if (!drSheet) return
  const sessSheet = ss.getSheetByName('Sessions')

  // 1. Authoritative totals per date|stationIndex from Daily Revenue.
  const active = {}
  const dr = drSheet.getDataRange().getValues()
  for (let i = 1; i < dr.length; i++) {
    const r = dr[i]
    if (!r[0]) continue
    const dateStr = typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
    const customers = Number(r[5]) || 1
    const notes = r[6] || ''
    ;[[1, Number(r[1]) || 0], [2, Number(r[2]) || 0], [0, Number(r[3]) || 0]].forEach(function (pair) {
      const si = pair[0], amt = pair[1]
      if (amt > 0) active[dateStr + '|' + si] = { date: dateStr, stationIndex: si, amount: amt, customers, notes }
    })
  }

  // 2. Collect the individual Sessions-tab rows for each active date|station.
  const rowsByKey = {}
  if (sessSheet) {
    const sd = sessSheet.getDataRange().getValues()
    for (let i = 1; i < sd.length; i++) {
      const r = sd[i]
      if (!r[0] || !r[1]) continue
      const dateStr = typeof r[1] === 'string' ? r[1] : Utilities.formatDate(new Date(r[1]), 'Asia/Kolkata', 'yyyy-MM-dd')
      const si = Number(r[3])
      const key = dateStr + '|' + si
      if (!active[key]) continue // deleted from Daily Revenue → skip
      ;(rowsByKey[key] = rowsByKey[key] || []).push({
        id: Number(r[0]) || String(r[0]), date: dateStr,
        station: r[2] || stationName(si), stationIndex: si,
        amount: Number(r[4]) || 0, players: Number(r[5]) || 1,
        durationMins: Number(r[6]) || 0, notes: r[7] || '',
        savedAt: r[8] ? String(r[8]) : dateStr,
        editedAt: r[9] ? String(r[9]) : '',
        source: 'session', // logged from the app
      })
    }
  }

  // 3. Emit, per date+station:
  //    • sessions add up to the Daily Revenue total  → show each session SEPARATELY
  //      (normal app use — the sheet total equals the sessions).
  //    • sessions add up to LESS than the total      → show each session separately
  //      PLUS a "from sheets" entry for the leftover (a value typed into the sheet
  //      on top of the sessions) — nothing is hidden or deleted.
  //    • sessions add up to MORE than the total (the sheet total was manually
  //      lowered) OR there are no sessions → one aggregate at the sheet's total.
  const out = {}
  Object.keys(active).forEach(function (key) {
    const a = active[key]
    const rows = rowsByKey[key]
    const aggId = stableIdGs(a.date, 0) + (a.stationIndex + 1)
    const aggEntry = function (amt) {
      return {
        id: aggId, date: a.date, station: stationName(a.stationIndex), stationIndex: a.stationIndex,
        amount: amt, players: a.stationIndex === 0 ? 0 : a.customers,
        durationMins: 0, notes: a.notes, savedAt: new Date(a.date + 'T00:00:00').toISOString(),
        source: 'sheet', // amount entered/changed directly in the Google Sheet
      }
    }
    if (rows && rows.length) {
      const sum = rows.reduce(function (s, x) { return s + x.amount }, 0)
      if (sum <= a.amount) {
        rows.forEach(function (x) { out[x.id] = x })          // each session separate
        if (sum < a.amount) out[aggId] = aggEntry(a.amount - sum) // leftover from the sheet
        return
      }
      // sum > total → the sheet total was lowered below the sessions; respect it.
    }
    out[aggId] = aggEntry(a.amount)
  })

  firebasePut('/sessions', out)
}

// Run once from the Apps Script editor to force a full resync / cleanup.
function forceSync() {
  rebuildSessions()
  Logger.log('Sessions rebuilt')
}

function syncExpenseRow(sheet, row) {
  if (row <= 1) return
  const r = sheet.getRange(row, 1, 1, 8).getValues()[0]
  if (!r[0]) return
  const dateStr = typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
  const id = stableIdGs(dateStr, row)
  firebasePut('/expenses/' + id, {
    id, date: dateStr, paidBy: r[1] || '', category: r[2] || 'Miscellaneous',
    description: r[3] || '', amount: Number(r[4]) || 0, paymentMethod: r[5] || 'Cash',
    recurring: r[6] || 'One-time', notes: r[7] || '', savedAt: new Date().toISOString(),
  })
}

function syncUdharRow(sheet, row) {
  if (row <= 1) return
  const r = sheet.getRange(row, 1, 1, 7).getValues()[0]
  if (!r[0]) return
  const dateStr = typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
  const id = stableIdGs(dateStr, row)
  firebasePut('/udhar/' + id, {
    id, date: dateStr, customerName: r[1] || '', type: r[2] || 'udhar',
    amount: Number(r[3]) || 0, notes: r[4] || '', settled: r[5] === 'Yes',
    settledAt: r[6] ? String(r[6]) : null, savedAt: new Date().toISOString(),
  })
}

// ─── Get Daily Revenue ────────────────────────────────────────────────────────
function getDailyRevenue(month) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) return { rows: [] }

  const data = sheet.getDataRange().getValues().slice(1)
  const rows = data
    .filter(r => {
      if (!r[0]) return false
      const rowDate = typeof r[0] === 'string'
        ? r[0]
        : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
      return month ? rowDate.startsWith(month) : true
    })
    .map(r => ({
      date: typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd'),
      ps5_1: Number(r[1]) || 0,
      ps5_2: Number(r[2]) || 0,
      other: Number(r[3]) || 0,
      total: (Number(r[1]) || 0) + (Number(r[2]) || 0) + (Number(r[3]) || 0),
      customers: Number(r[5]) || 0,
      notes: r[6] || '',
    }))

  return { rows }
}
