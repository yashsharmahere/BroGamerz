// ─── Google Sheets Configuration ────────────────────────────────────────────
// After deploying the Google Apps Script (see /google-apps-script/Code.gs),
// paste the Web App URL below.
export const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz0zA6jVndUlhnvAYEOz9bba0JUhjfNkTTxD0zC1V7Py4bED6ZerRyQ_UzApHrCDprA/exec'

// Your Google Spreadsheet ID (from the URL)
export const SPREADSHEET_ID = '1EWFKh46f8c4bkxYbx0A-AekARfQj5Fmr0-2dTDvYav8'

// ─── Pricing ─────────────────────────────────────────────────────────────────
export const PRICING = {
  ps5: {
    single: 120,   // ₹/hour for 1 player
    multi: 100,    // ₹/hour per player for 2+ players
  }
}

// ─── Stations ────────────────────────────────────────────────────────────────
export const STATIONS = [
  { id: 'ps5_1', name: 'PS5 Station 1', sheetColumn: 'B', color: 'blue' },
  { id: 'ps5_2', name: 'PS5 Station 2', sheetColumn: 'C', color: 'purple' },
]

// ─── Dropdown Options (must match Google Sheet Setup tab) ────────────────────
export const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Internet',
  'Game Purchase',
  'Equipment',
  'Repairs/Maintenance',
  'Marketing',
  'Food/Drinks',
  'Miscellaneous',
]

export const PAYMENT_METHODS = ['UPI', 'Card', 'Cash', 'Bank Transfer']
export const OWNERS = ['Yash', 'Anuj']

// ─── Camera ──────────────────────────────────────────────────────────────────
export const CAMERA = {
  model: 'M1078S',
  ip: '192.168.1.33',
  rtspUrl: 'rtsp://192.168.1.33/stream', // update with actual RTSP path
}
