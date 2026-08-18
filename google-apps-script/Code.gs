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

// ─── Log Session → Daily Revenue tab + Sessions tab ──────────────────────────
function logSession({ id, date, stationIndex, amount, players, durationMins, notes, station, savedAt }) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) throw new Error('Daily Revenue sheet not found')

  // Write individual session to Sessions tab (for cross-device log sharing)
  const sessSheet = getOrCreateSheet('Sessions', [
    'ID', 'Date', 'Station', 'StationIndex', 'Amount', 'Players', 'DurationMins', 'Notes', 'SavedAt', 'EditedAt'
  ])
  const stationName = station || (stationIndex === 1 ? 'PS5 Station 1' : stationIndex === 2 ? 'PS5 Station 2' : 'Other')
  sessSheet.appendRow([String(id || ''), date, stationName, stationIndex, amount, players || 1, durationMins || 0, notes || '', savedAt || date, ''])

  const rowNum = findRowByDate(sheet, date)

  if (rowNum === -1) {
    // Append a new row for this date
    const newRow = [date, '', '', '', '', '', '']
    if (stationIndex === 1) newRow[1] = amount
    else if (stationIndex === 2) newRow[2] = amount
    newRow[5] = players
    newRow[6] = notes || ''
    sheet.appendRow(newRow)
  } else {
    // Add to the existing row's station column
    const col = stationIndex === 1 ? 2 : 3 // B or C
    const existing = sheet.getRange(rowNum, col).getValue() || 0
    sheet.getRange(rowNum, col).setValue(existing + amount)

    // Add players to customer count
    const custCol = 6
    const existingCust = sheet.getRange(rowNum, custCol).getValue() || 0
    sheet.getRange(rowNum, custCol).setValue(existingCust + players)

    // Append to notes
    if (notes) {
      const notesCol = 7
      const existingNotes = sheet.getRange(rowNum, notesCol).getValue() || ''
      sheet.getRange(rowNum, notesCol).setValue(
        existingNotes ? `${existingNotes}; ${notes}` : notes
      )
    }
  }

  return { success: true }
}

// ─── Log Manual Revenue → Daily Revenue tab ───────────────────────────────────
function logManualRevenue({ date, otherRevenue, customers, notes }) {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) throw new Error('Daily Revenue sheet not found')

  const rowNum = findRowByDate(sheet, date)

  if (rowNum === -1) {
    sheet.appendRow([date, '', '', otherRevenue || '', '', customers || '', notes || ''])
  } else {
    if (otherRevenue) {
      const existing = sheet.getRange(rowNum, 4).getValue() || 0
      sheet.getRange(rowNum, 4).setValue(existing + otherRevenue)
    }
    if (customers) {
      const existing = sheet.getRange(rowNum, 6).getValue() || 0
      sheet.getRange(rowNum, 6).setValue(existing + customers)
    }
    if (notes) {
      const existing = sheet.getRange(rowNum, 7).getValue() || ''
      sheet.getRange(rowNum, 7).setValue(existing ? `${existing}; ${notes}` : notes)
    }
  }

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
      const editedAt = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm')
      sheet.getRange(i + 1, 2).setValue(date)
      sheet.getRange(i + 1, 3).setValue(station)
      sheet.getRange(i + 1, 4).setValue(stationIndex)
      sheet.getRange(i + 1, 5).setValue(amount)
      sheet.getRange(i + 1, 6).setValue(players || 1)
      sheet.getRange(i + 1, 7).setValue(durationMins || 0)
      sheet.getRange(i + 1, 8).setValue(notes || '')
      sheet.getRange(i + 1, 10).setValue(editedAt)
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
      sheet.deleteRow(i + 1)
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

// Rebuild the ENTIRE Firebase /sessions node from the Daily Revenue sheet.
// One atomic PUT replaces the whole node, so adds, edits AND deletes all
// propagate: a cleared cell simply isn't in the rebuilt object, so it's gone.
// This is a WRITE (reliable) instead of a DELETE (unreliable via REST) and
// leaves no orphan entries and needs no delete markers.
function rebuildSessions() {
  const sheet = ss.getSheetByName('Daily Revenue')
  if (!sheet) return
  const data = sheet.getDataRange().getValues()
  const out = {}

  for (let i = 1; i < data.length; i++) {
    const r = data[i]
    if (!r[0]) continue
    const dateStr = typeof r[0] === 'string' ? r[0] : Utilities.formatDate(new Date(r[0]), 'Asia/Kolkata', 'yyyy-MM-dd')
    const ps5_1 = Number(r[1]) || 0
    const ps5_2 = Number(r[2]) || 0
    const other = Number(r[3]) || 0
    const customers = Number(r[5]) || 1
    const notes = r[6] || ''
    const savedAt = new Date(dateStr + 'T00:00:00').toISOString()
    const base = stableIdGs(dateStr, 0)

    if (ps5_1 > 0) { const id = base + 1; out[id] = { id, date: dateStr, station: 'PS5 Station 1', stationIndex: 1, amount: ps5_1, players: customers, durationMins: 0, notes, savedAt } }
    if (ps5_2 > 0) { const id = base + 2; out[id] = { id, date: dateStr, station: 'PS5 Station 2', stationIndex: 2, amount: ps5_2, players: customers, durationMins: 0, notes, savedAt } }
    if (other > 0) { const id = base + 3; out[id] = { id, date: dateStr, station: 'Other', stationIndex: 0, amount: other, players: 0, durationMins: 0, notes, savedAt } }
  }

  firebasePut('/sessions', out)
}

// Run once from the Apps Script editor to force a full resync / cleanup.
function forceSync() {
  rebuildSessions()
  Logger.log('Sessions rebuilt from Daily Revenue')
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
