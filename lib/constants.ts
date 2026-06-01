// ─── Time ────────────────────────────────────────────────────────────────────
export const MS_PER_DAY = 86_400_000

// ─── Sparkline and growth windows ────────────────────────────────────────────
export const SPARKLINE_DAYS = 7
export const GROWTH_WINDOW_DAYS = 7

// ─── Growth thresholds ───────────────────────────────────────────────────────
export const RAPID_GROWTH_DEFAULT_GB = 50
/** GB delta below which day-over-day growth is ignored on the dashboard */
export const GROWTH_IGNORE_THRESHOLD = 0.1

// ─── Gmail ───────────────────────────────────────────────────────────────────
export const GMAIL_MAX_RESULTS = 5

// ─── Admin ───────────────────────────────────────────────────────────────────
export const USER_LIST_LIMIT = 200

// ─── Alert threshold defaults (server-side fallback when DB unavailable) ─────
export const DEFAULT_WARN_THRESHOLD = 80
export const DEFAULT_CRIT_THRESHOLD = 90

// ─── Payload protection ──────────────────────────────────────────────────────
/** 10 MB — protects against oversized payloads while allowing full 20-DB HTML reports */
export const MAX_HTML_BYTES = 10_000_000
