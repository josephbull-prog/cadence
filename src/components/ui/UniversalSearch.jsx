import { useState, useMemo, useEffect, useRef } from 'react'
import { Search, X, BookOpen, StickyNote, ClipboardList, CalendarDays } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import {
  useClasses, useLessonPlans, useGeneralNotes, useClassNotes,
  useHomework, useMilestones
} from '../../lib/hooks'

function highlight(text, query) {
  if (!query || !text) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: 'rgba(230,176,32,0.35)', color: 'inherit', borderRadius: '2px', padding: '0 1px' }}>
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  )
}

function snippetAround(text, query, maxLen = 120) {
  if (!text) return ''
  const q = query.toLowerCase()
  const idx = text.toLowerCase().indexOf(q)
  if (idx === -1) return text.slice(0, maxLen)
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + q.length + 60)
  return (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '')
}

const TYPE_META = {
  lesson:       { icon: CalendarDays, label: 'Lesson' },
  general_note: { icon: StickyNote,   label: 'Note'   },
  class_note:   { icon: BookOpen,     label: 'Class note' },
  homework:     { icon: ClipboardList, label: 'Homework' },
  class:        { icon: BookOpen,     label: 'Class'  },
}

export default function UniversalSearch({ autoFocus = false, onClose, compact = false }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  const { data: classes = [] } = useClasses()
  const { data: plans = [] } = useLessonPlans()
  const { data: generalNotes = [] } = useGeneralNotes()
  const { data: classNotes = [] } = useClassNotes()
  const { data: homework = [] } = useHomework()
  const { data: milestones = [] } = useMilestones()

  useEffect(() => { if (autoFocus) inputRef.current?.focus() }, [autoFocus])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q.length < 2) return []
    const hits = []

    // Classes
    classes.forEach(cls => {
      if (cls.name.toLowerCase().includes(q)) {
        hits.push({ type: 'class', id: cls.id, title: cls.name, subtitle: cls.room ? `Room ${cls.room}` : '', color: cls.color_code, action: () => navigate(`/class/${cls.id}`) })
      }
    })

    // Lesson plans
    plans.forEach(plan => {
      const cls = classes.find(c => c.id === plan.class_id)
      const inContent = plan.plan_content?.toLowerCase().includes(q)
      const inNotes = plan.notes?.toLowerCase().includes(q)
      if (!inContent && !inNotes) return
      hits.push({
        type: 'lesson', id: plan.id,
        title: cls?.name || 'Lesson',
        subtitle: plan.date ? format(parseISO(plan.date), 'EEE d MMM yyyy') : 'Unscheduled',
        snippet: snippetAround(inContent ? plan.plan_content : plan.notes, query.trim()),
        color: cls?.color_code,
        action: () => navigate(`/class/${plan.class_id}`)
      })
    })

    // General notes
    generalNotes.forEach(note => {
      const inTitle = note.title?.toLowerCase().includes(q)
      const inContent = note.content?.toLowerCase().includes(q)
      if (!inTitle && !inContent) return
      hits.push({
        type: 'general_note', id: note.id,
        title: note.title || 'Untitled note',
        subtitle: format(parseISO(note.updated_at), 'd MMM yyyy'),
        snippet: snippetAround(note.content, query.trim()),
        action: () => navigate('/notes')
      })
    })

    // Class notes
    classNotes.forEach(note => {
      if (!note.content?.toLowerCase().includes(q)) return
      const cls = classes.find(c => c.id === note.class_id)
      hits.push({
        type: 'class_note', id: note.id,
        title: `${cls?.name || 'Class'} — notes`,
        subtitle: '',
        snippet: snippetAround(note.content, query.trim()),
        color: cls?.color_code,
        action: () => navigate(`/class/${note.class_id}`)
      })
    })

    // Homework
    homework.forEach(hw => {
      if (!hw.description?.toLowerCase().includes(q)) return
      const cls = classes.find(c => c.id === hw.class_id)
      hits.push({
        type: 'homework', id: hw.id,
        title: hw.description,
        subtitle: `${cls?.name || ''} · Due ${hw.date_due ? format(parseISO(hw.date_due), 'd MMM') : '?'}`,
        color: cls?.color_code,
        action: () => navigate('/homework')
      })
    })

    // Milestones
    milestones.forEach(m => {
      if (!m.label?.toLowerCase().includes(q)) return
      const cls = classes.find(c => c.id === m.class_id)
      hits.push({
        type: 'lesson', id: m.id,
        title: m.label,
        subtitle: `${cls?.name || ''} · ${m.date ? format(parseISO(m.date), 'd MMM yyyy') : ''}`,
        color: cls?.color_code,
        action: () => navigate(`/class/${m.class_id}`)
      })
    })

    return hits.slice(0, 12)
  }, [query, classes, plans, generalNotes, classNotes, homework, milestones])

  useEffect(() => { setActiveIndex(0) }, [results])

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIndex(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[activeIndex]) { results[activeIndex].action(); onClose?.() }
    if (e.key === 'Escape') { if (query) setQuery(''); else onClose?.() }
  }

  const handleSelect = (result) => { result.action(); onClose?.() }

  const showResults = query.length >= 2

  return (
    <div className="w-full">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search lessons, notes, homework, classes…"
          className="input pl-9 pr-9"
          style={{ minHeight: compact ? '38px' : '44px' }}
          autoComplete="off"
        />
        {query && (
          <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {showResults && (
        <div className="mt-1.5 rounded-xl overflow-hidden shadow-2xl z-50 relative"
          style={{ border: '1px solid var(--border)', background: 'var(--bg-raised)' }}>
          {results.length === 0 ? (
            <div className="px-4 py-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              No results for "<strong>{query}</strong>"
            </div>
          ) : (
            <>
              {results.map((result, i) => {
                const { icon: Icon } = TYPE_META[result.type] || TYPE_META.lesson
                const isActive = i === activeIndex
                return (
                  <button
                    key={`${result.type}-${result.id}-${i}`}
                    onClick={() => handleSelect(result)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className="w-full text-left px-4 py-2.5 flex items-start gap-3 transition-colors"
                    style={{
                      background: isActive ? 'var(--hover-bg)' : 'transparent',
                      borderBottom: i < results.length - 1 ? '1px solid var(--border-subtle)' : 'none'
                    }}
                  >
                    <div className="shrink-0 mt-0.5 flex items-center justify-center w-6 h-6 rounded"
                      style={{ background: result.color ? result.color + '22' : 'var(--hover-bg)' }}>
                      <Icon size={12} style={{ color: result.color || 'var(--text-muted)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {highlight(result.title, query.trim())}
                        </span>
                        {result.subtitle && (
                          <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>{result.subtitle}</span>
                        )}
                      </div>
                      {result.snippet && (
                        <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                          {highlight(result.snippet, query.trim())}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
              <div className="px-4 py-1.5 text-xs flex items-center gap-3"
                style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', background: 'var(--hover-bg)' }}>
                <span>{results.length} result{results.length !== 1 ? 's' : ''}</span>
                <span>↑↓ navigate</span>
                <span>↵ open</span>
                <span>Esc close</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
