# Bro Gamerz — Project Memory

> Keep this file updated after every significant change. Claude reads this at the start of each session.

---

## What This App Is

A **PWA (Progressive Web App)** for managing a small gaming café — specifically a 2-PS5-station setup. Owners are **Yash** and **Anuj**. Built as a mobile-first dark-themed React app used on phones/tablets at the café counter.

Core jobs:
- Start/stop timed PS5 sessions and auto-calculate charges
- Log revenue, expenses, udhar (credit), and advances
- Sync everything to a Google Sheet as the real database
- View a dashboard with today's + monthly + all-time stats

---

## Tech Stack

| Layer | Choice |
|---|---|
| UI | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 (custom dark theme) |
| Routing | React Router v6 |
| Icons | lucide-react |
| PWA | vite-plugin-pwa |
| Real-time DB | **Firebase Realtime Database** (WebSocket, instant sync) |
| Backup DB | Google Sheets via Apps Script (all writes go here too) |
| Local persistence | `localStorage` (device cache, offline fallback) |
| Cross-device sync | Firebase `onValue` listeners — no polling |

---

## File Structure

```
src/
  App.jsx                  — Router + ToastProvider wrapper
  config.js                — Central config (Firebase, Sheets URL, pricing, stations)
  main.jsx                 — React entry point
  index.css                — Global styles + Tailwind directives

  pages/
    Sessions.jsx           — Main page: active timers + session log
    AddData.jsx            — Log other revenue + customer count
    AddExpense.jsx         — Log business expenses
    Udhar.jsx              — Track customer credit (udhar) + advance payments
    Dashboard.jsx          — Stats: today / month / all-time (all live from Firebase)

  components/
    Navigation.jsx         — Fixed bottom tab bar (5 tabs)
    EndSessionModal.jsx    — Bottom sheet to confirm & save a session
    EditSessionModal.jsx   — Bottom sheet to edit/delete a logged session
    Toast.jsx              — Toast notification system (context-based)

  hooks/
    useSessions.js         — Core session state: timer, pricing, Firebase sync

  services/
    firebaseDb.js          — Firebase Realtime DB: all listeners + write helpers
    sheetsApi.js           — Google Apps Script calls (backup writes only)
    storage.js             — localStorage CRUD (device cache / offline fallback)
    audio.js               — Web Audio API: confirm beep, hourly chime, notifications

google-apps-script/
  Code.gs                  — Google Sheets backend (still receives all writes as backup)
```

---

## Config (`src/config.js`)

```js
// Firebase (fill in after creating project at console.firebase.google.com)
FIREBASE_CONFIG = { apiKey, authDomain, databaseURL, projectId, storageBucket, messagingSenderId, appId }

// Google Sheets (backup — still receives all writes)
APPS_SCRIPT_URL  = 'https://script.google.com/macros/s/AKfycbz0zA6jVndUlhnvAYEOz9bba0JUhjfNkTTxD0zC1V7Py4bED6ZerRyQ_UzApHrCDprA/exec'
SPREADSHEET_ID   = '1EWFKh46f8c4bkxYbx0A-AekARfQj5Fmr0-2dTDvYav8'

PRICING = {
  ps5: { single: 120, multi: 100 }  // ₹/hr; multi = per-player rate when 2+ players
}

STATIONS = [
  { id: 'ps5_1', name: 'PS5 Station 1', sheetColumn: 'B', color: 'blue' },
  { id: 'ps5_2', name: 'PS5 Station 2', sheetColumn: 'C', color: 'purple' },
]

EXPENSE_CATEGORIES = [Rent, Electricity, Internet, Game Purchase, Equipment, Repairs/Maintenance, Marketing, Food/Drinks, Miscellaneous]
PAYMENT_METHODS   = [UPI, Card, Cash, Bank Transfer]
OWNERS            = ['Yash', 'Anuj']
```

---

## Pricing Logic

- **1 player**: ₹120/hr flat
- **2+ players**: ₹100/hr × number of players (e.g. 2 players = ₹200/hr)
- Charge is calculated live in `useSessions.js → calcPrice(elapsedSecs, players)`
- On session end, the auto-calculated amount is shown but editable (for discounts/extras)

---

## Data Architecture

### Local Storage (offline-first)
Keys in `storage.js`:
- `bg_active_sessions` — running timer state per station
- `bg_revenue_log` — completed sessions (max 500 entries)
- `bg_expense_log` — expense entries (max 500)
- `bg_udhar_log` — udhar/advance entries

All IDs are `Date.now()` timestamps.

### Google Sheet Tabs
| Sheet Tab | Columns | Written by |
|---|---|---|
| `Daily Revenue` | Date, PS5-1, PS5-2, Other, ?, Customers, Notes | `logSession`, `logManualRevenue`, `updateDayRevenue` |
| `Sessions` | ID, Date, Station, StationIndex, Amount, Players, DurationMins, Notes, SavedAt, EditedAt | `logSession`, `updateSession`, `deleteSession` |
| `Expenses` | Date, PaidBy, Category, Description, Amount, PaymentMethod, Recurring, Notes | `logExpense` |
| `Udhar` | Date, CustomerName, Type, Amount, Notes, Settled, SettledDate | `logUdhar`, `settleUdharEntry` |

### PropertiesService (cross-device active session sync)
- Key: `activeSessions` — JSON blob of all station timer states
- Polled every 10s by `useSessions.js`
- Includes `serverTime` for clock offset correction

---

## Pages & Key Behaviors

### Sessions (`/`)
- Shows 2 `SessionCard`s — one per PS5 station
- Each card: timer display, live ₹ charge, player count +/- buttons, Start/Stop
- Stop → opens `EndSessionModal` (session keeps running while modal is open)
- Save → `appendRevenue()` locally + `logSession()` to sheet
- Session log below cards merges local entries + sheet entries (by ID) — no duplicates
- Sheet entries fetched every 15s + on tab focus
- "Sync Sheet" button manually refreshes
- Entries from other devices show a "Sheet" badge and edit via Sheet API

### AddData (`/add`)
- Logs other revenue (F&B, merchandise, etc.) + extra customer count
- Goes to `Daily Revenue` sheet column D + customer count

### AddExpense (`/expense`)
- Form: date, paid-by (Yash/Anuj), category (dropdown), description, amount, payment method, recurring/one-time, notes
- Shows collapsible expense history (last 30 entries)

### Udhar (`/udhar`)
- Two types: **Udhar** (customer owes us, shown in red) and **Advance** (customer paid ahead, shown in green)
- Can mark entries as "Settled"
- Syncs with Udhar sheet tab
- Sheet-only entries deduped by customerName + amount + type + date

### Dashboard (`/dashboard`)
- Data source: Google Sheet (read via `getDashboard`)
- Session cache (`bg_dash_cache`) in sessionStorage — survives tab switches, cleared on browser close
- Shows: today revenue+customers, month revenue/expenses/P&L/customers, station breakdown bars, expense category bars, udhar summary, all-time numbers
- Refresh button re-fetches from sheet

---

## Cross-Device Sync Flow (Firebase)

```
Device A starts session
  → startSession() updates localStorage
  → pushToCloud() (debounced 300ms) → pushActiveSessions() to Firebase RTDB

Device B has onValue listener on brogamerz/activeSessions
  → Firebase pushes change instantly (WebSocket, <1s)
  → useSessions merges cloud state into local, saves to localStorage
  → timer starts ticking on Device B

Session log: subscribeSessions() on brogamerz/sessions
  → any completed session appears on all devices instantly
  → local entries + Firebase entries merged by ID in mergedLog

Dashboard: subscribeSessions + subscribeExpenses + subscribeUdhar
  → all stats computed client-side from live Firebase data
  → updates instantly when any entry changes anywhere

Sheets: still receives every write as a fire-and-forget backup
  → logSession, logExpense, logUdhar, updateDayRevenue all still called
  → used for accounting history; NOT read from anymore (Firebase is source of truth)
```

## Firebase Database Structure

```
brogamerz/
  activeSessions/
    ps5_1: { id, isRunning, startTime, accumulatedSecs, players, lastHourNotified }
    ps5_2: { ... }

  sessions/
    {timestamp-id}: { id, date, station, stationIndex, amount, players, durationMins, notes, savedAt, editedAt }

  expenses/
    {timestamp-id}: { id, date, paidBy, category, description, amount, paymentMethod, recurring, notes, savedAt }

  udhar/
    {timestamp-id}: { id, customerName, amount, type, date, notes, settled, settledAt, savedAt }
```

## Firebase Setup (for new environments)

1. Go to console.firebase.google.com → Create project → "brogamerz"
2. Add Web App → copy `firebaseConfig` into `src/config.js → FIREBASE_CONFIG`
3. Build → Realtime Database → Create database → **Start in test mode** → pick Asia region
4. Set Database Rules (Realtime Database → Rules tab):
```json
{
  "rules": {
    "brogamerz": {
      ".read": true,
      ".write": true
    }
  }
}
```

---

## Audio
- `playConfirmBeep()` — 880Hz sine, 0.3s — plays on save
- `playHourlyChime()` — C5-E5-G5-C6 arpeggio — plays at each completed hour
- `showHourlyNotification()` — browser Notification API, `tag: hourly-{stationName}` (replaces previous)
- Permission requested on Sessions page mount

---

## Tailwind Theme (dark, custom colors)

```
bg-primary:   #0a0a0f   (page background)
bg-secondary: #12121a   (inputs, secondary areas)
bg-card:      #1a1a25   (cards)
bg-hover:     #22223a

border:       #252535
border-bright:#353550

accent-blue:  #4f9cf9   (primary actions, Station 1)
accent-green: #22c55e   (revenue, profit)
accent-red:   #ef4444   (expense, loss, udhar)
accent-orange:#f59e0b   (warnings)
accent-purple:#a855f7   (Station 2)

text-primary:  #f1f5f9
text-secondary:#8892a4
text-muted:    #4a5568
```

Fonts: `Inter` (UI), `JetBrains Mono` (timer display via `font-mono`)

---

## CSS Utility Classes (defined in `index.css`)
- `.card` — bg-card, rounded-2xl, border, padding
- `.stat-card` — smaller card variant for dashboard grid
- `.input-field` — standardized form input
- `.label` — form label
- `.btn-primary` — blue filled button
- `.btn-ghost` — outline/ghost button
- `.btn-danger` — red filled button
- `.badge-active` / `.badge-idle` — status chips
- `.timer-display` — uses JetBrains Mono font

---

## Google Apps Script Backend (`Code.gs`)

Deployed as a Web App at the `APPS_SCRIPT_URL`.
- **POST** → `doPost(e)` — routes by `payload.action`
- **GET** → `doGet(e)` — routes by `e.parameter.action`

Actions (POST): `logSession`, `logExpense`, `logUdhar`, `logManualRevenue`, `updateDayRevenue`, `settleUdhar`, `saveActiveSessions`, `updateSession`, `deleteSession`

Actions (GET): `getDashboard`, `getUdhar`, `getDailyRevenue`, `getActiveSessions`, `getSessions`

When modifying `Code.gs`, must redeploy the script (new deployment version) for changes to take effect. The URL stays the same — just create a new version under the existing deployment.

---

## PWA Config
- `vite-plugin-pwa` with `autoUpdate`
- Manifest: standalone, portrait, dark theme `#0a0a0f`
- Icons expected at `/icons/icon-192.png` and `/icons/icon-512.png`
- `index.html` has: `user-scalable=no`, `apple-mobile-web-app-capable`, black-translucent status bar

---

## Known Patterns / Gotchas

1. **Sheet writes are fire-and-forget** — `.catch(() => {})` everywhere. App never blocks on sheet calls; localStorage is the source of truth for the device.
2. **IDs are `Date.now()` timestamps** — integer milliseconds. Sheet entries have the same ID stored in column A of the Sessions tab.
3. **StationIndex convention**: `1` = PS5 Station 1, `2` = PS5 Station 2, `0` = Other/manual
4. **Daily Revenue sheet** uses column B for Station 1, C for Station 2, D for Other. Column E is currently unused. Column F is customer count, G is notes.
5. **EditSessionModal** handles both local entries (updates `localStorage` + triggers sheet `updateSession`) and sheet-only entries (updates only via sheet API).
6. **Udhar sheet-only entry dedup**: matched by `customerName + amount + type + date` — no unique ID stored in Udhar sheet.
7. **Clock offset**: `useSessions` tracks `serverTime - Date.now()` from the Apps Script response to keep timers consistent across devices.
8. **Session keeps running while EndSessionModal is open** — intentional, so the elapsed time stays live.
9. **`node_modules/` and `dist/` were committed** on the first push (no .gitignore at that point). The .gitignore exists now but those folders are tracked.

---

## Dev Commands

```bash
npm run dev      # Start Vite dev server
npm run build    # Build to /dist
npm run preview  # Preview /dist locally
```

---

## Branch

- Main branch: `main`
- Claude's feature branch: `claude/brogamerz-github-auth-rm32ni`
