/**
 * Import View — three fully browser-side importers.
 * NO API calls. All parsing runs locally in the browser.
 *
 * Libraries loaded on demand from CDN:
 *   PDF.js   — spatial word extraction from PDF
 *   mammoth  — DOCX → plain text table extraction
 *   SheetJS  — XLSX cell reading (already used elsewhere)
 */
import { useState, useRef } from 'react'
import { CheckCircle, Trash2, Plus, AlertTriangle, ArrowRight, RotateCcw, FileText, Calendar, BookOpen, FolderInput } from 'lucide-react'
import { useToast } from '../../lib/toast'
import {
  useClasses, useAddClass, useTimetableSlots, useAddTimetableSlot,
  useDeleteTimetableSlot, useAddHoliday, useHolidays,
  useAddScheme, useSchemes, useProfile,
} from '../../lib/hooks'
import { useQueryClient } from '@tanstack/react-query'

// ─── Constants ────────────────────────────────────────────────────────────────

const CLASS_COLOURS = [
  '#e87d7d','#f0733a','#f0a040','#e8c840','#a8c840',
  '#7db88d','#40b8a0','#4098c0','#6090c0','#7070d0',
  '#b070c0','#d060a0','#c08060','#8090a0','#60a878',
  '#d4a060','#a06080','#507890','#70b0d0','#c0a840',
]
const usedColours = new Set()
function nextColour() {
  const unused = CLASS_COLOURS.filter(c => !usedColours.has(c))
  const pick = unused.length ? unused[0] : CLASS_COLOURS[Math.floor(Math.random() * CLASS_COLOURS.length)]
  usedColours.add(pick)
  return pick
}

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

// ─── CDN loader ───────────────────────────────────────────────────────────────

function loadScript(src, globalKey) {
  if (window[globalKey]) return Promise.resolve(window[globalKey])
  return new Promise((res, rej) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = () => res(window[globalKey])
    s.onerror = () => rej(new Error(`Failed to load ${src}`))
    document.head.appendChild(s)
  })
}

// ─── Drop zone ────────────────────────────────────────────────────────────────

function DropZone({ accept, label, icon: Icon, onFile }) {
  const ref = useRef()
  const [dragging, setDragging] = useState(false)
  const handle = f => f && onFile(f)
  return (
    <div
      onClick={() => ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files[0]) }}
      className="rounded-xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-3 py-8 px-4 text-center"
      style={{ borderColor: dragging ? 'var(--gold)' : 'var(--border)', background: dragging ? 'rgba(230,176,32,0.05)' : 'var(--hover-bg)' }}
    >
      <Icon size={28} style={{ color: 'var(--text-muted)' }} />
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Drop here or click to browse · {accept}</p>
      </div>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => handle(e.target.files[0])} />
    </div>
  )
}

function Spinner({ label }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10">
      <div className="animate-spin w-8 h-8 border-2 rounded-full"
        style={{ borderColor: 'var(--border)', borderTopColor: 'var(--gold)' }} />
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

function InfoBanner({ children }) {
  return (
    <div className="rounded-lg p-3 text-sm"
      style={{ background: 'rgba(230,176,32,0.08)', color: 'var(--gold)', border: '1px solid rgba(230,176,32,0.15)' }}>
      {children}
    </div>
  )
}

function ErrBanner({ msg }) {
  return (
    <div className="rounded-lg p-3 text-sm"
      style={{ background: 'rgba(232,125,125,0.12)', color: '#e87d7d', border: '1px solid rgba(232,125,125,0.2)' }}>
      <AlertTriangle size={14} className="inline mr-1.5" />{msg}
    </div>
  )
}

function DoneScreen({ message, sub, onAgain, onDone }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <CheckCircle size={36} style={{ color: '#7db88d' }} />
      <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{message}</p>
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{sub}</p>
      <div className="flex gap-2">
        <button onClick={onAgain} className="btn-ghost gap-1.5"><RotateCcw size={14} />Import another</button>
        <button onClick={onDone} className="btn-primary">Done</button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMETABLE PARSER — pure browser, uses PDF.js for spatial word extraction
// ═══════════════════════════════════════════════════════════════════════════════

async function parseTimetablePdf(file) {
  // Load PDF.js from CDN
  if (!window.pdfjsLib) {
    await loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
      'pdfjsLib'
    )
    window.pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
  }

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const allSlots = []

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const viewport = page.getViewport({ scale: 1.0 })
    const H = viewport.height

    // PDF.js may emit individual characters for some PDFs.
    // We reconstruct words by merging nearby TextItems on the same y-row.
    const textContent = await page.getTextContent({
      normalizeWhitespace: false,
      disableCombineTextItems: false,
    })

    // Step 1: raw items → {x, y, text, xEnd}
    // PDF coords: y from bottom → flip to top-origin
    const raw = []
    for (const item of textContent.items) {
      if (!item.str || !item.str.trim()) continue
      const x    = item.transform[4]
      const yBot = item.transform[5]
      const y    = H - yBot
      // item.width is how wide the string renders at scale=1
      const xEnd = x + Math.abs(item.width || item.str.length * 5)
      raw.push({ x: Math.round(x), y: Math.round(y), text: item.str, xEnd: Math.round(xEnd) })
    }

    // Step 2: bucket by y (±4px), sort by x within each bucket
    const rowMap = {}
    for (const r of raw) {
      const yk = Math.round(r.y / 4) * 4
      if (!rowMap[yk]) rowMap[yk] = []
      rowMap[yk].push(r)
    }

    // Step 3: within each row, merge adjacent non-space tokens into words
    // Gap threshold: if next.x < prev.xEnd + 5 → merge (handles kerned/spaced chars)
    const words = []  // {x, y, text, xEnd}
    for (const [yk, items] of Object.entries(rowMap)) {
      const sorted = items.sort((a, b) => a.x - b.x)
      let cur = null
      for (const item of sorted) {
        const isSpace = /^\s+$/.test(item.text)
        if (isSpace) {
          if (cur) { words.push(cur); cur = null }
          continue
        }
        if (!cur) {
          cur = { x: item.x, y: Number(yk), text: item.text, xEnd: item.xEnd }
        } else if (item.x <= cur.xEnd + 5) {
          // Merge: concatenate text, extend xEnd
          cur.text += item.text
          cur.xEnd = Math.max(cur.xEnd, item.xEnd)
        } else {
          words.push(cur)
          cur = { x: item.x, y: Number(yk), text: item.text, xEnd: item.xEnd }
        }
      }
      if (cur) words.push(cur)
    }

    // Step 4: rebuild rowMap from reconstructed words
    const wordRows = {}
    for (const w of words) {
      const yk = w.y
      if (!wordRows[yk]) wordRows[yk] = []
      wordRows[yk].push(w)
    }

    const ySorted = Object.keys(wordRows).map(Number).sort((a, b) => a - b)

    // ── Detect orientation ──────────────────────────────────────────────────
    const DAY_NAMES = new Set(['Monday','Tuesday','Wednesday','Thursday','Friday'])
    let dayOrientation = null

    for (const y of ySorted) {
      for (const w of wordRows[y]) {
        if (DAY_NAMES.has(w.text)) {
          dayOrientation = w.x < 150 ? 'days-as-rows' : 'days-as-cols'
          break
        }
      }
      if (dayOrientation) break
    }
    if (!dayOrientation) continue

    // ── Helper: assign a word's x to the nearest period column ──────────────
    let periodXMap = {}  // period number → header x

    // Find period header row (contains P1, P2, P3 …)
    for (const y of ySorted) {
      const row = wordRows[y]
      const pTokens = row.filter(w => /^P\d$/.test(w.text))
      if (pTokens.length >= 2) {
        pTokens.forEach(w => { periodXMap[parseInt(w.text.slice(1))] = w.x })
        break
      }
    }

    const pEntries = Object.entries(periodXMap).map(([p, hx]) => [parseInt(p), hx])

    const assignPeriod = (x) => {
      let best = null, bestDist = 9999
      for (const [p, hx] of pEntries) {
        const d = Math.abs(x - hx)
        if (d < bestDist) { bestDist = d; best = p }
      }
      return bestDist < 130 ? best : null
    }

    // ── SUBJECTS that anchor a lesson block ─────────────────────────────────
    const SUBJECTS = new Set(['French','Science','Maths','English','History','Geography',
      'Spanish','German','Music','Drama','Art','PE','RE','Technology',
      'Computing','Business','Psychology','Sociology','PSHE','Form'])

    // ── FORMAT A: days as rows ───────────────────────────────────────────────
    if (dayOrientation === 'days-as-rows') {
      // Detect week (A=1 / B=2) from page title — look for "Week A," or "Week B,"
      let week = 1
      const titleRow = wordRows[ySorted[0]] || []
      const wkWord = titleRow.find(w => w.text === 'B,')
      if (wkWord) week = 2

      // Find day label positions
      const dayRows = []
      for (const y of ySorted) {
        const dayWord = wordRows[y].find(w => DAY_NAMES.has(w.text))
        if (dayWord) {
          const weekWord = wordRows[y].find(w => w.text === 'A' || w.text === 'B')
          const dayNum = [...DAY_NAMES].indexOf(dayWord.text) + 1 // Mon=1…Fri=5
          const dayWeek = weekWord?.text === 'B' ? 2 : 1
          dayRows.push({ y, dayNum, week: dayWeek })
        }
      }
      dayRows.sort((a, b) => a.y - b.y)

      const headerY = ySorted[0]

      for (let i = 0; i < dayRows.length; i++) {
        const { y: dayY, dayNum, week: dayWeek } = dayRows[i]
        const prevY = i > 0 ? dayRows[i - 1].y : headerY
        const contentYs = ySorted.filter(y => y > prevY && y < dayY)

        const periodClasses = {}

        for (const rowY of contentYs) {
          const row = wordRows[rowY].sort((a, b) => a.x - b.x)

          for (const { x: sx, text } of row) {
            if (!SUBJECTS.has(text)) continue
            const period = assignPeriod(sx)
            if (!period) continue

            // Look for class code (contains /) after this subject on same row
            const afterSubject = row.filter(w => w.x > sx)
            let classCode = null
            let partialCode = null

            for (const { x: cx, text: ct } of afterSubject) {
              if (ct.includes('/') && !ct.startsWith('(') && ct.length < 16) {
                if (ct.endsWith('/')) {
                  partialCode = { text: ct, x: cx, y: rowY }
                } else {
                  classCode = ct
                }
                break
              }
            }

            // Handle split code: "11B/" on one line, "Fr1" on next
            if (partialCode && !classCode) {
              for (const y2 of contentYs) {
                if (y2 <= rowY || y2 > rowY + 20) continue
                for (const w2 of wordRows[y2]) {
                  const p2 = assignPeriod(w2.x)
                  if (p2 === period && /[A-Za-z]/.test(w2.text) &&
                      !['JBU','EWO','CNY','French','Science'].includes(w2.text) &&
                      !w2.text.startsWith('(') && w2.text.length < 8) {
                    classCode = partialCode.text + w2.text
                    break
                  }
                }
                if (classCode) break
              }
              if (!classCode) classCode = partialCode.text.replace(/\/$/, '')
            }

            if (classCode && classCode.includes('/')) {
              if (!periodClasses[period]) periodClasses[period] = []
              if (!periodClasses[period].includes(classCode)) {
                periodClasses[period].push(classCode)
              }
            }
          }
        }

        for (const [period, codes] of Object.entries(periodClasses)) {
          for (const code of codes) {
            allSlots.push({ week: dayWeek, day: dayNum, period: parseInt(period), raw_name: code, short_name: code })
          }
        }
      }
    }

    // ── FORMAT B: days as columns ────────────────────────────────────────────
    if (dayOrientation === 'days-as-cols') {
      let headerY = null
      const dayXMap = {}
      for (const y of ySorted) {
        const days = wordRows[y].filter(w => DAY_NAMES.has(w.text))
        if (days.length >= 3) {
          headerY = y
          days.forEach(w => {
            const dn = [...DAY_NAMES].indexOf(w.text) + 1
            dayXMap[dn] = w.x
          })
          break
        }
      }
      if (!headerY) continue

      // Week per day
      const weekByDay = {}
      const nearHeader = ySorted.filter(y => Math.abs(y - headerY) < 20)
      for (const y of nearHeader) {
        for (const { x, text } of wordRows[y]) {
          if (text === 'A' || text === 'B') {
            let best = null, bestD = 9999
            for (const [dn, dx] of Object.entries(dayXMap)) {
              const d = Math.abs(x - dx)
              if (d < bestD) { bestD = d; best = dn }
            }
            if (best && bestD < 80) weekByDay[best] = text === 'A' ? 1 : 2
          }
        }
      }

      const assignDay = (x) => {
        let best = null, bestDist = 9999
        for (const [dn, dx] of Object.entries(dayXMap)) {
          const d = Math.abs(x - dx)
          if (d < bestDist) { bestDist = d; best = parseInt(dn) }
        }
        return bestDist < 100 ? best : null
      }

      // Period rows on the left
      const periodYMap = {}
      for (const y of ySorted) {
        if (y <= headerY) continue
        const pToken = wordRows[y].find(w => /^P\d$/.test(w.text) && w.x < 80)
        if (pToken) periodYMap[parseInt(pToken.text.slice(1))] = y
      }
      const pYEntries = Object.entries(periodYMap).map(([p, y]) => [parseInt(p), y])
      const assignPeriodFromY = (y) => {
        let best = null, bestD = 9999
        for (const [p, py] of pYEntries) {
          const d = Math.abs(y - py)
          if (d < bestD) { bestD = d; best = p }
        }
        return bestD < 40 ? best : null
      }

      for (const y of ySorted) {
        if (y <= headerY) continue
        const row = wordRows[y].sort((a, b) => a.x - b.x)
        for (const { x: sx, text } of row) {
          if (!SUBJECTS.has(text)) continue
          const dayNum = assignDay(sx)
          const period = assignPeriodFromY(y)
          if (!dayNum || !period) continue
          const dayWeek = weekByDay[dayNum] || 1

          const after = row.filter(w => w.x > sx)
          let code = null, partial = null
          for (const { x: cx, text: ct } of after) {
            if (ct.includes('/') && !ct.startsWith('(') && ct.length < 16) {
              if (ct.endsWith('/')) partial = { text: ct, x: cx, y }
              else code = ct
              break
            }
          }
          if (partial && !code) {
            for (const y2 of ySorted) {
              if (y2 <= y || y2 > y + 20) continue
              for (const w2 of wordRows[y2]) {
                if (assignDay(w2.x) === dayNum && /[A-Za-z]/.test(w2.text) &&
                    !['JBU','EWO','CNY'].includes(w2.text) && w2.text.length < 8) {
                  code = partial.text + w2.text
                  break
                }
              }
              if (code) break
            }
            if (!code) code = partial.text.replace(/\/$/, '')
          }
          if (code && code.includes('/')) {
            allSlots.push({ week: dayWeek, day: dayNum, period, raw_name: code, short_name: code })
          }
        }
      }
    }
  }

  return allSlots
}


// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR PARSER — pure browser, uses SheetJS
// ═══════════════════════════════════════════════════════════════════════════════

async function parseCalendarXlsx(file) {
  if (!window.XLSX) {
    await loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
      'XLSX'
    )
  }
  const XLSX = window.XLSX
  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array', cellDates: true })

  const results = []
  const fmt = d => {
    if (!d) return ''
    try {
      const dt = d instanceof Date ? d : new Date(d)
      return dt.toISOString().slice(0, 10)
    } catch { return '' }
  }

  // ── Assessment tab — holiday weeks ──────────────────────────────────────────
  const assessWs = wb.Sheets['Assessment']
  if (assessWs) {
    const rows = XLSX.utils.sheet_to_json(assessWs, { header: 1, defval: null })
    const HOLIDAY_RE = /half.?term|christmas|easter|whitsun|summer.?break/i

    const holidayWeeks = []
    for (const row of rows) {
      const dateVal = row[0]
      if (!dateVal) continue
      let date = null
      if (dateVal instanceof Date) date = dateVal
      else if (typeof dateVal === 'number') {
        // Excel serial date
        date = XLSX.SSF.parse_date_code ? null : null
        try { date = new Date((dateVal - 25569) * 86400 * 1000) } catch {}
      }
      if (!date || isNaN(date.getTime())) continue

      // Check all cells in row for holiday keyword
      const label = row.slice(1, 5).find(c => c && typeof c === 'string' && HOLIDAY_RE.test(c))
      if (!label) continue
      holidayWeeks.push({ date, label: label.trim() })
    }

    holidayWeeks.sort((a, b) => a.date - b.date)

    // Merge consecutive weeks (Mon-Fri of each week)
    const groups = []
    for (const { date, label } of holidayWeeks) {
      const fri = new Date(date.getTime() + 4 * 86400000)
      const last = groups[groups.length - 1]
      if (last && (date - last.endDate) <= 7 * 86400000 + 1000) {
        last.endDate = fri
      } else {
        // Normalise label
        let cleanLabel = label
          .replace(/break/i, '').replace(/half.?term/i, 'Half Term')
          .replace(/\s+/g, ' ').trim()
        if (!cleanLabel) cleanLabel = 'Holiday'
        groups.push({ startDate: date, endDate: fri, label: cleanLabel })
      }
    }

    groups.forEach((g, i) => {
      const isSummer = /summer/i.test(g.label)
      // Summer: estimate end as last Friday in August
      const endDate = isSummer
        ? (() => {
            const aug31 = new Date(g.startDate.getFullYear(), 7, 31)
            const dow = aug31.getDay()
            const lastFri = new Date(aug31.getTime() - ((dow + 2) % 7) * 86400000)
            return lastFri
          })()
        : g.endDate

      results.push({
        category: 'holiday',
        label: g.label,
        start_date: fmt(g.startDate),
        end_date: fmt(endDate),
        keep: true,
        note: isSummer ? 'End date estimated (last Friday in August) — please verify' : '',
      })
    })
  }

  // ── Directed Time tab — INSET days ──────────────────────────────────────────
  const dirWs = wb.Sheets['Directed Time']
  if (dirWs) {
    const rows = XLSX.utils.sheet_to_json(dirWs, { header: 1, defval: null })
    for (const row of rows) {
      // Pattern: [number 1-10, "Monday September 2nd 2025", null, "8am-2.30pm", ...]
      if (typeof row[0] !== 'number' || row[0] < 1 || row[0] > 15) continue
      const dateText = row[1]
      if (!dateText || typeof dateText !== 'string') continue
      if (!/\d{4}/.test(dateText)) continue // must have a 4-digit year

      // Clean ordinals and parse
      const cleaned = dateText.replace(/\b(\d+)(st|nd|rd|th)\b/gi, '$1').trim()
      const parsed = new Date(cleaned)
      if (isNaN(parsed.getTime())) continue

      results.push({
        category: 'inset',
        label: 'INSET Day',
        start_date: fmt(parsed),
        end_date: fmt(parsed),
        keep: true,
        note: '',
      })
    }
  }

  // ── CE Day tab — curriculum enrichment days ──────────────────────────────
  const ceWs = wb.Sheets['CE Day']
  if (ceWs) {
    const rows = XLSX.utils.sheet_to_json(ceWs, { header: 1, defval: null })
    for (const row of rows.slice(1)) {
      const term = row[0] ? String(row[0]).trim() : ''
      const dateVal = row[1]
      if (!dateVal || typeof term !== 'string' || !term) continue
      if (!(dateVal instanceof Date) && typeof dateVal !== 'number') continue

      let date = dateVal instanceof Date ? dateVal : new Date((dateVal - 25569) * 86400000)
      if (isNaN(date.getTime())) continue

      results.push({
        category: 'ce',
        label: `CE Day (${term})`,
        start_date: fmt(date),
        end_date: fmt(date),
        keep: true,
        note: '',
      })
    }
  }

  return results.sort((a, b) => a.start_date.localeCompare(b.start_date))
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOW PARSER — pure browser, uses mammoth.js
// ═══════════════════════════════════════════════════════════════════════════════

async function parseSoWDocx(file) {
  if (!window.mammoth) {
    await loadScript(
      'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
      'mammoth'
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  // Convert to HTML — this preserves table structure
  const result = await window.mammoth.convertToHtml({ arrayBuffer })
  const html = result.value

  // Parse HTML table using DOMParser
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const table = doc.querySelector('table')
  if (!table) throw new Error('No table found in document')

  const rows = Array.from(table.querySelectorAll('tr'))

  // Ignore patterns
  const IGNORE = /core standards?|checkpoint|dot around|cumulative assessment|^assessment$|^easter$/i
  const EXAMPLE_SENTENCE = /j'ai une|je suis|il s'appelle/i

  const halfTerms = []

  for (const row of rows.slice(1)) { // skip header
    const cells = Array.from(row.querySelectorAll('td, th'))
    if (cells.length < 2) continue

    // First cell = half-term label
    const htLabel = cells[0].textContent.trim()
    if (!htLabel || !/(autumn|spring|summer)/i.test(htLabel)) continue

    const htParts = htLabel.split(/:\s*/)
    const halfTerm = htParts[0].trim()
    const topic = htParts.slice(1).join(': ').trim()

    // All cells except first (label) and last (assessment)
    const contentCells = cells.slice(1, cells.length - 1)

    const lessons = []
    const seen = new Set()

    for (const cell of contentCells) {
      // Each <p> in the cell is a lesson
      const paras = Array.from(cell.querySelectorAll('p'))
      const texts = paras.length > 0
        ? paras.map(p => p.textContent.trim()).filter(Boolean)
        : [cell.textContent.trim()].filter(Boolean)

      for (const text of texts) {
        if (!text || text.length < 2) continue
        if (IGNORE.test(text)) continue
        if (EXAMPLE_SENTENCE.test(text)) continue
        const key = text.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        lessons.push(text)
      }
    }

    if (lessons.length > 0) {
      halfTerms.push({ half_term: halfTerm, topic, lessons })
    }
  }

  return halfTerms
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMETABLE IMPORTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function TimetableImporter({ onDone }) {
  const toast = useToast()
  const { data: existingClasses = [] } = useClasses()
  const { data: existingSlots = [] } = useTimetableSlots()
  const { data: profile } = useProfile()
  const addClass = useAddClass()
  const addSlot = useAddTimetableSlot()
  const deleteSlot = useDeleteTimetableSlot()
  const qc = useQueryClient()

  const [step, setStep] = useState('upload')
  const [error, setError] = useState(null)
  const [editedClasses, setEditedClasses] = useState([])
  const [editedSlots, setEditedSlots] = useState([])

  const reset = () => { setStep('upload'); setEditedClasses([]); setEditedSlots([]); setError(null); usedColours.clear() }

  const handleFile = async (file) => {
    setStep('parsing')
    setError(null)
    try {
      const slots = await parseTimetablePdf(file)
      if (!slots.length) throw new Error('No lessons found. Check the PDF contains a timetable with period columns (P1, P2…).')

      const classMap = {}
      slots.forEach(s => {
        if (!classMap[s.short_name]) {
          classMap[s.short_name] = {
            short_name: s.short_name,
            display_name: s.short_name,
            colour: nextColour(),
            keep: true,
          }
        }
      })

      setEditedClasses(Object.values(classMap))
      setEditedSlots(slots.map(s => ({ ...s, keep: true })))
      setStep('preview')
    } catch (e) {
      setError(e.message)
      setStep('upload')
    }
  }

  const handleImport = async () => {
    setStep('importing')
    try {
      // Wipe existing slots
      for (const slot of existingSlots) await deleteSlot.mutateAsync(slot.id)

      // Create / find classes
      const classIdMap = {}
      for (const cls of editedClasses.filter(c => c.keep)) {
        const existing = existingClasses.find(c => c.name === cls.display_name)
        if (existing) {
          classIdMap[cls.short_name] = existing.id
        } else {
          const result = await addClass.mutateAsync({ name: cls.display_name, color_code: cls.colour, room: '', book_brilliant_done: false })
          classIdMap[cls.short_name] = result?.id
        }
      }
      await qc.invalidateQueries({ queryKey: ['classes'] })

      // Add slots
      for (const slot of editedSlots.filter(s => s.keep && classIdMap[s.short_name])) {
        const cycleWeek = profile?.timetable_type === '1_week' ? 1 : slot.week
        await addSlot.mutateAsync({ class_id: classIdMap[slot.short_name], day_of_week: slot.day, period_number: slot.period, cycle_week: cycleWeek })
      }
      await qc.invalidateQueries({ queryKey: ['timetable_slots'] })
      setStep('done')
    } catch (e) {
      toast.error('Import failed: ' + e.message)
      setStep('preview')
    }
  }

  if (step === 'upload') return (
    <div className="space-y-4">
      {error && <ErrBanner msg={error} />}
      <DropZone accept=".pdf" label="Upload timetable PDF" icon={FileText} onFile={handleFile} />
      <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
        <p>Supports both layouts (days as rows or columns). Week A/B detected from labels like "Monday A".</p>
        <p>Parsing runs entirely in your browser — no data is sent anywhere.</p>
      </div>
    </div>
  )

  if (step === 'parsing') return <Spinner label="Reading PDF…" />

  if (step === 'preview') return (
    <div className="space-y-5 animate-fade-in">
      <InfoBanner>Review and edit what was found. Rename classes, remove wrong entries, then click Import.</InfoBanner>

      {/* Classes */}
      <div>
        <p className="label">Classes found ({editedClasses.filter(c => c.keep).length})</p>
        <div className="space-y-2">
          {editedClasses.map((cls, i) => (
            <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
              style={{ background: 'var(--hover-bg)', opacity: cls.keep ? 1 : 0.4 }}>
              <input type="color" value={cls.colour}
                onChange={e => setEditedClasses(p => p.map((c, j) => j === i ? { ...c, colour: e.target.value } : c))}
                style={{ width: '28px', height: '28px', padding: 0, border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none' }} />
              <input className="input flex-1"
                style={{ minHeight: 'unset', padding: '5px 8px' }}
                value={cls.display_name}
                onChange={e => setEditedClasses(p => p.map((c, j) => j === i ? { ...c, display_name: e.target.value } : c))} />
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)', minWidth: '64px' }}>{cls.short_name}</span>
              <button onClick={() => setEditedClasses(p => p.map((c, j) => j === i ? { ...c, keep: !c.keep } : c))}
                style={{ color: cls.keep ? '#e87d7d' : '#7db88d', padding: '4px', flexShrink: 0 }}>
                {cls.keep ? <Trash2 size={14} /> : <CheckCircle size={14} />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Slots table */}
      <div>
        <p className="label">Timetable slots ({editedSlots.filter(s => s.keep).length})</p>
        <div className="rounded-xl overflow-auto" style={{ maxHeight: '260px', border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                {['Week', 'Day', 'P', 'Class', ''].map(h => (
                  <th key={h} style={{ padding: '6px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {editedSlots.map((slot, i) => {
                const cls = editedClasses.find(c => c.short_name === slot.short_name)
                const active = slot.keep && cls?.keep
                return (
                  <tr key={i} style={{ opacity: active ? 1 : 0.3, borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '4px 10px', color: 'var(--text-muted)' }}>Wk {slot.week === 1 ? 'A' : 'B'}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--text-secondary)' }}>{DAYS[slot.day]}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>P{slot.period}</td>
                    <td style={{ padding: '4px 10px', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <span className="inline-block w-2 h-2 rounded-full mr-1.5"
                        style={{ background: cls?.colour || '#888', verticalAlign: 'middle' }} />
                      {cls?.display_name || slot.short_name}
                    </td>
                    <td style={{ padding: '4px 10px' }}>
                      <button onClick={() => setEditedSlots(p => p.map((s, j) => j === i ? { ...s, keep: !s.keep } : s))}
                        style={{ color: slot.keep ? '#e87d7d' : '#7db88d' }}>
                        {slot.keep ? <Trash2 size={12} /> : <CheckCircle size={12} />}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
          ⚠ Importing will replace all existing timetable slots.
        </p>
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="btn-ghost gap-2"><RotateCcw size={14} />Try again</button>
        <button onClick={handleImport} className="btn-primary flex-1 gap-2"><ArrowRight size={16} />Import timetable</button>
      </div>
    </div>
  )

  if (step === 'importing') return <Spinner label="Saving timetable…" />
  if (step === 'done') return <DoneScreen message="Timetable imported!" sub="Classes and slots saved. You can now link SoWs to classes in Settings." onAgain={reset} onDone={onDone} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALENDAR IMPORTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CalendarImporter({ onDone }) {
  const toast = useToast()
  const addHoliday = useAddHoliday()

  const [step, setStep] = useState('upload')
  const [error, setError] = useState(null)
  const [items, setItems] = useState([])

  const reset = () => { setStep('upload'); setItems([]); setError(null) }

  const handleFile = async (file) => {
    setStep('parsing')
    setError(null)
    try {
      const parsed = await parseCalendarXlsx(file)
      if (!parsed.length) throw new Error('No holidays or INSET days found. Check the spreadsheet has Assessment, Directed Time and CE Day tabs.')
      setItems(parsed)
      setStep('preview')
    } catch (e) {
      setError(e.message)
      setStep('upload')
    }
  }

  const update = (i, changes) => setItems(p => p.map((item, j) => j === i ? { ...item, ...changes } : item))

  const handleImport = async () => {
    setStep('importing')
    try {
      for (const h of items.filter(h => h.keep)) {
        await addHoliday.mutateAsync({ label: h.label, start_date: h.start_date, end_date: h.end_date })
      }
      setStep('done')
    } catch (e) {
      toast.error('Import failed: ' + e.message)
      setStep('preview')
    }
  }

  const CAT_STYLE = {
    holiday: { bg: 'rgba(240,160,64,0.15)', color: '#f0a040', border: 'rgba(240,160,64,0.25)' },
    inset:   { bg: 'rgba(96,144,192,0.15)',  color: '#6090c0', border: 'rgba(96,144,192,0.25)' },
    ce:      { bg: 'rgba(125,184,141,0.15)', color: '#7db88d', border: 'rgba(125,184,141,0.25)' },
  }
  const CAT_LABEL = { holiday: 'Holiday', inset: 'INSET', ce: 'CE Day' }

  if (step === 'upload') return (
    <div className="space-y-4">
      {error && <ErrBanner msg={error} />}
      <DropZone accept=".xlsx,.xls" label="Upload school calendar spreadsheet" icon={Calendar} onFile={handleFile} />
      <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
        <p>Reads three tabs: <strong>Assessment</strong> (holiday weeks) · <strong>Directed Time</strong> (INSET days) · <strong>CE Day</strong> (enrichment days).</p>
        <p>Runs entirely in your browser.</p>
      </div>
    </div>
  )

  if (step === 'parsing') return <Spinner label="Reading spreadsheet…" />

  if (step === 'preview') return (
    <div className="space-y-4 animate-fade-in">
      <InfoBanner>Review all dates before saving. Edit labels, adjust dates, or uncheck anything to skip.</InfoBanner>

      <div className="space-y-2" style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {items.map((item, i) => {
          const s = CAT_STYLE[item.category] || CAT_STYLE.holiday
          return (
            <div key={i} className="rounded-lg p-3 space-y-2"
              style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', opacity: item.keep ? 1 : 0.4 }}>
              <div className="flex items-start gap-2">
                <input type="checkbox" checked={item.keep} onChange={e => update(i, { keep: e.target.checked })}
                  className="mt-0.5" style={{ accentColor: 'var(--gold)', cursor: 'pointer' }} />
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="badge text-xs"
                      style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                      {CAT_LABEL[item.category]}
                    </span>
                    <input className="input flex-1"
                      style={{ minHeight: 'unset', padding: '4px 8px', fontSize: '13px' }}
                      value={item.label} onChange={e => update(i, { label: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="date" className="input"
                      style={{ minHeight: 'unset', padding: '4px 8px', fontSize: '13px', width: 'auto' }}
                      value={item.start_date} onChange={e => update(i, { start_date: e.target.value })} />
                    <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>→</span>
                    <input type="date" className="input"
                      style={{ minHeight: 'unset', padding: '4px 8px', fontSize: '13px', width: 'auto' }}
                      value={item.end_date} onChange={e => update(i, { end_date: e.target.value })} />
                  </div>
                  {item.note && <p className="text-xs italic" style={{ color: '#f0a040' }}>{item.note}</p>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {items.filter(i => i.keep).length} of {items.length} items will be imported (added to existing holidays).
      </p>

      <div className="flex gap-2">
        <button onClick={reset} className="btn-ghost gap-2"><RotateCcw size={14} />Try again</button>
        <button onClick={handleImport} className="btn-primary flex-1 gap-2"><ArrowRight size={16} />Import calendar</button>
      </div>
    </div>
  )

  if (step === 'importing') return <Spinner label="Saving calendar dates…" />
  if (step === 'done') return <DoneScreen message="Calendar imported!" sub="Holidays and INSET days saved." onAgain={reset} onDone={onDone} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// SOW IMPORTER COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function SoWImporter({ onDone }) {
  const toast = useToast()
  const addScheme = useAddScheme()

  const [step, setStep] = useState('upload')
  const [error, setError] = useState(null)
  const [sowName, setSowName] = useState('')
  const [halfTerms, setHalfTerms] = useState([])
  const [mergeMode, setMergeMode] = useState('separate')

  const reset = () => { setStep('upload'); setHalfTerms([]); setError(null) }

  const handleFile = async (file) => {
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ').replace(/^\d+\s*/, '').trim()
    setSowName(name)
    setStep('parsing')
    setError(null)
    try {
      const parsed = await parseSoWDocx(file)
      if (!parsed.length) throw new Error('No half-term rows found. Check the document has a table with Autumn/Spring/Summer rows.')
      setHalfTerms(parsed.map(ht => ({
        ...ht,
        keep: true,
        lessons: ht.lessons.map(l => ({ text: l, keep: true }))
      })))
      setStep('preview')
    } catch (e) {
      setError(e.message)
      setStep('upload')
    }
  }

  const handleImport = async () => {
    setStep('importing')
    try {
      const kept = halfTerms.filter(ht => ht.keep)
      if (mergeMode === 'single') {
        const allLessons = kept.flatMap(ht => ht.lessons.filter(l => l.keep).map(l => l.text))
        await addScheme.mutateAsync({ title: sowName, lessons: allLessons })
      } else {
        for (const ht of kept) {
          const lessons = ht.lessons.filter(l => l.keep).map(l => l.text)
          const title = `${sowName} — ${ht.half_term}${ht.topic ? ': ' + ht.topic : ''}`
          await addScheme.mutateAsync({ title, lessons })
        }
      }
      setStep('done')
    } catch (e) {
      toast.error('Import failed: ' + e.message)
      setStep('preview')
    }
  }

  const updateLesson = (hti, li, text) =>
    setHalfTerms(p => p.map((ht, i) => i !== hti ? ht : { ...ht, lessons: ht.lessons.map((l, j) => j !== li ? l : { ...l, text }) }))
  const toggleLesson = (hti, li) =>
    setHalfTerms(p => p.map((ht, i) => i !== hti ? ht : { ...ht, lessons: ht.lessons.map((l, j) => j !== li ? l : { ...l, keep: !l.keep }) }))
  const addLesson = (hti) =>
    setHalfTerms(p => p.map((ht, i) => i !== hti ? ht : { ...ht, lessons: [...ht.lessons, { text: '', keep: true }] }))

  if (step === 'upload') return (
    <div className="space-y-4">
      {error && <ErrBanner msg={error} />}
      <DropZone accept=".docx" label="Upload Scheme of Work (.docx)" icon={BookOpen} onFile={handleFile} />
      <div className="text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
        <p>Expects a Word table: half-term labels in column 1, lesson topics in the middle columns, assessment column at the right end (ignored automatically).</p>
        <p>Runs entirely in your browser.</p>
      </div>
    </div>
  )

  if (step === 'parsing') return <Spinner label="Reading document…" />

  if (step === 'preview') return (
    <div className="space-y-4 animate-fade-in">
      <InfoBanner>Review lessons before saving. Edit, remove or add topics. Choose how to save at the bottom.</InfoBanner>

      <div>
        <label className="label">Scheme name</label>
        <input className="input" value={sowName} onChange={e => setSowName(e.target.value)} />
      </div>

      <div className="flex gap-4">
        {[['separate', 'One SoW per half-term'], ['single', 'Single SoW (full year sequence)']].map(([val, lbl]) => (
          <label key={val} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: 'var(--text-secondary)' }}>
            <input type="radio" name="merge" value={val} checked={mergeMode === val} onChange={() => setMergeMode(val)}
              style={{ accentColor: 'var(--gold)' }} />
            {lbl}
          </label>
        ))}
      </div>

      <div className="space-y-3" style={{ maxHeight: '380px', overflowY: 'auto' }}>
        {halfTerms.map((ht, hti) => (
          <div key={hti} className="rounded-xl p-3 space-y-2"
            style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', opacity: ht.keep ? 1 : 0.4 }}>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={ht.keep}
                onChange={e => setHalfTerms(p => p.map((h, i) => i === hti ? { ...h, keep: e.target.checked } : h))}
                style={{ accentColor: 'var(--gold)' }} />
              <p className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                {ht.half_term}{ht.topic ? `: ${ht.topic}` : ''}
              </p>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {ht.lessons.filter(l => l.keep).length} lessons
              </span>
            </div>
            {ht.keep && (
              <div className="pl-5 space-y-1">
                {ht.lessons.map((lesson, li) => (
                  <div key={li} className="flex items-center gap-2" style={{ opacity: lesson.keep ? 1 : 0.35 }}>
                    <span className="text-xs font-mono w-5 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{li + 1}</span>
                    <input className="input flex-1"
                      style={{ minHeight: 'unset', padding: '3px 7px', fontSize: '12px' }}
                      value={lesson.text}
                      onChange={e => updateLesson(hti, li, e.target.value)} />
                    <button onClick={() => toggleLesson(hti, li)}
                      style={{ color: lesson.keep ? '#e87d7d' : '#7db88d', padding: '2px', flexShrink: 0 }}>
                      {lesson.keep ? <Trash2 size={12} /> : <CheckCircle size={12} />}
                    </button>
                  </div>
                ))}
                <button onClick={() => addLesson(hti)}
                  className="btn-ghost text-xs gap-1"
                  style={{ minHeight: 'unset', padding: '3px 8px', marginTop: '4px' }}>
                  <Plus size={11} /> Add lesson
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={reset} className="btn-ghost gap-2"><RotateCcw size={14} />Try again</button>
        <button onClick={handleImport} className="btn-primary flex-1 gap-2"><ArrowRight size={16} />Save scheme</button>
      </div>
    </div>
  )

  if (step === 'importing') return <Spinner label="Saving scheme of work…" />
  if (step === 'done') return <DoneScreen message="Scheme of work saved!" sub="Link it to a class in Settings → Classes." onAgain={reset} onDone={onDone} />
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN IMPORT VIEW
// ═══════════════════════════════════════════════════════════════════════════════

export default function ImportView() {
  const [activeTab, setActiveTab] = useState('timetable')

  const tabs = [
    { id: 'timetable', label: 'Timetable',      icon: FileText,  desc: 'PDF' },
    { id: 'calendar',  label: 'Calendar',        icon: Calendar,  desc: 'Excel' },
    { id: 'sow',       label: 'Scheme of Work',  icon: BookOpen,  desc: 'Word' },
  ]

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in">
      <h2 className="font-display text-2xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Import</h2>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Upload files to populate your timetable, calendar, and schemes of work. You'll see a full preview before anything is saved. All parsing runs locally in your browser.
      </p>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {tabs.map(tab => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                background: active ? 'var(--nav-active-bg)' : 'var(--hover-bg)',
                border: active ? '2px solid var(--gold)' : '1px solid var(--border)',
              }}>
              <Icon size={18} style={{ color: active ? 'var(--gold)' : 'var(--text-muted)', marginBottom: '6px' }} />
              <p className="text-sm font-medium" style={{ color: active ? 'var(--nav-active-color)' : 'var(--text-primary)' }}>
                {tab.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{tab.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="card p-5">
        {activeTab === 'timetable' && <TimetableImporter onDone={() => {}} />}
        {activeTab === 'calendar'  && <CalendarImporter  onDone={() => {}} />}
        {activeTab === 'sow'       && <SoWImporter       onDone={() => {}} />}
      </div>
    </div>
  )
}
