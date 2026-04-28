/**
 * Storage abstraction layer.
 *
 * When VITE_TEST_MODE=true (or localStorage key 'cadence_test_mode' is set),
 * all data is stored in localStorage under the key 'cadence_data'.
 *
 * In production mode, this module re-exports the Supabase client.
 * All hooks import from this file, never directly from Supabase.
 */

import { createClient } from '@supabase/supabase-js'

// ─── Mode detection ───────────────────────────────────────────────────────────

export const isTestMode = () => {
  if (typeof window === 'undefined') return false
  return (
    import.meta.env.VITE_TEST_MODE === 'true' ||
    localStorage.getItem('cadence_test_mode') === 'true'
  )
}

export const setTestMode = (val) => {
  if (val) {
    localStorage.setItem('cadence_test_mode', 'true')
  } else {
    localStorage.removeItem('cadence_test_mode')
    // Clear test data too
    localStorage.removeItem('cadence_data')
    localStorage.removeItem('cadence_auth')
  }
}

// ─── Supabase client (used in prod mode) ─────────────────────────────────────

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// ─── LocalStorage DB (test mode) ─────────────────────────────────────────────

const STORAGE_KEY = 'cadence_data'
const AUTH_KEY = 'cadence_auth'

const DEMO_USER_ID = 'test-user-local-001'
const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'demo@cadence.app',
  user_metadata: { full_name: 'Demo Teacher', avatar_url: null }
}

function getDB() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : getEmptyDB()
  } catch {
    return getEmptyDB()
  }
}

function getEmptyDB() {
  return {
    profiles: [],
    holidays: [],
    classes: [],
    timetable_slots: [],
    schemes_of_work: [],
    lesson_plans: [],
    milestones: [],
    cover_slips: [],
    homework: [],
    class_notes: [],
    general_notes: [],
  }
}

function saveDB(db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// A minimal query builder that mimics Supabase's chainable API
class LocalQueryBuilder {
  constructor(tableName) {
    this.tableName = tableName
    this._filters = []
    this._orderBy = null
    this._orderAsc = true
    this._selectCols = '*'
    this._single = false
    this._upsert = false
    this._insertData = null
    this._updateData = null
    this._deleteFlag = false
  }

  select(cols = '*') { this._selectCols = cols; return this }
  single() { this._single = true; return this }

  eq(col, val) { this._filters.push({ type: 'eq', col, val }); return this }
  neq(col, val) { this._filters.push({ type: 'neq', col, val }); return this }
  gte(col, val) { this._filters.push({ type: 'gte', col, val }); return this }
  lte(col, val) { this._filters.push({ type: 'lte', col, val }); return this }
  is(col, val) { this._filters.push({ type: 'is', col, val }); return this }
  in(col, vals) { this._filters.push({ type: 'in', col, vals }); return this }

  order(col, opts = {}) {
    this._orderBy = col
    this._orderAsc = opts.ascending !== false
    return this
  }

  insert(data) { this._insertData = data; this._mode = 'insert'; return this }
  update(data) { this._updateData = data; this._mode = 'update'; return this }
  delete() { this._deleteFlag = true; this._mode = 'delete'; return this }
  upsert(data, opts) { this._insertData = data; this._mode = 'upsert'; return this }

  _applyFilters(rows) {
    return rows.filter(row => {
      return this._filters.every(f => {
        if (f.type === 'eq') return row[f.col] == f.val
        if (f.type === 'neq') return row[f.col] != f.val
        if (f.type === 'gte') return row[f.col] >= f.val
        if (f.type === 'lte') return row[f.col] <= f.val
        if (f.type === 'is') return row[f.col] === f.val
        if (f.type === 'in') return f.vals.includes(row[f.col])
        return true
      })
    })
  }

  then(resolve, reject) {
    return Promise.resolve().then(() => {
      try {
        const db = getDB()
        const table = db[this.tableName] || []

        if (this._mode === 'insert') {
          const items = Array.isArray(this._insertData) ? this._insertData : [this._insertData]
          const inserted = items.map(item => {
            const row = { id: uuid(), user_id: DEMO_USER_ID, ...item }
            if (!row.id) row.id = uuid()
            table.push(row)
            return row
          })
          db[this.tableName] = table
          saveDB(db)
          return resolve({ data: Array.isArray(this._insertData) ? inserted : inserted[0], error: null })
        }

        if (this._mode === 'upsert') {
          const items = Array.isArray(this._insertData) ? this._insertData : [this._insertData]
          const upserted = items.map(item => {
            const existing = table.findIndex(r => r.id === item.id)
            if (existing >= 0) {
              table[existing] = { ...table[existing], ...item }
              return table[existing]
            } else {
              const row = { id: uuid(), user_id: DEMO_USER_ID, ...item }
              table.push(row)
              return row
            }
          })
          db[this.tableName] = table
          saveDB(db)
          return resolve({ data: upserted, error: null })
        }

        if (this._mode === 'update') {
          const filtered = this._applyFilters(table)
          filtered.forEach(row => Object.assign(row, this._updateData))
          db[this.tableName] = table
          saveDB(db)
          return resolve({ data: filtered, error: null })
        }

        if (this._mode === 'delete') {
          const toDelete = new Set(this._applyFilters(table).map(r => r.id))
          db[this.tableName] = table.filter(r => !toDelete.has(r.id))
          saveDB(db)
          return resolve({ data: null, error: null })
        }

        // SELECT
        let rows = this._applyFilters(table)
        if (this._orderBy) {
          rows.sort((a, b) => {
            const av = a[this._orderBy], bv = b[this._orderBy]
            if (av < bv) return this._orderAsc ? -1 : 1
            if (av > bv) return this._orderAsc ? 1 : -1
            return 0
          })
        }
        if (this._single) {
          return resolve({ data: rows[0] || null, error: null })
        }
        return resolve({ data: rows, error: null })
      } catch (err) {
        return resolve({ data: null, error: { message: err.message } })
      }
    }).then(resolve, reject)
  }
}

// localStorage auth mock
export const localAuth = {
  getSession: async () => {
    const auth = localStorage.getItem(AUTH_KEY)
    if (auth === 'logged_in') {
      return { data: { session: { user: DEMO_USER } }, error: null }
    }
    return { data: { session: null }, error: null }
  },
  signInWithOAuth: async () => {
    // In test mode, just auto-login
    localStorage.setItem(AUTH_KEY, 'logged_in')
    // Ensure profile exists
    const db = getDB()
    const existing = db.profiles.find(p => p.id === DEMO_USER_ID)
    if (!existing) {
      db.profiles.push({
        id: DEMO_USER_ID,
        display_name: 'Demo Teacher',
        timetable_type: '2_week',
        cycle_start_date: '2024-09-02'
      })
      saveDB(db)
    }
    window.location.reload()
    return { data: {}, error: null }
  },
  signOut: async () => {
    localStorage.removeItem(AUTH_KEY)
    window.location.reload()
    return { error: null }
  },
  onAuthStateChange: (callback) => {
    // Immediately fire with current state
    const auth = localStorage.getItem(AUTH_KEY)
    setTimeout(() => {
      callback('INITIAL_SESSION', auth === 'logged_in' ? { user: DEMO_USER } : null)
    }, 0)
    return { data: { subscription: { unsubscribe: () => {} } } }
  }
}

// The unified DB interface
export function db() {
  if (isTestMode()) {
    return {
      from: (table) => new LocalQueryBuilder(table),
      auth: localAuth
    }
  }
  if (!supabase) {
    console.error('Supabase not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, or enable test mode.')
    return null
  }
  return supabase
}

export function auth() {
  if (isTestMode()) return localAuth
  return supabase?.auth
}
