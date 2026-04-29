import { useState, useEffect, useMemo } from 'react'
import { Plus, Trash2, Edit2, Check, X, Save, RefreshCw, AlertTriangle } from 'lucide-react'
import {
  useProfile, useUpsertProfile,
  useHolidays, useAddHoliday, useDeleteHoliday,
  useClasses, useAddClass, useUpdateClass, useDeleteClass,
  useTimetableSlots, useAddTimetableSlot, useDeleteTimetableSlot,
  useSchemes, useAddScheme, useUpdateScheme, useDeleteScheme,
  useLessonPlans, useHomework, useMilestones, useClassNotes, useGeneralNotes
} from '../../lib/hooks'
import { useToast } from '../../lib/toast'
import { useTheme, STYLES } from '../../lib/theme'
import { setTestMode, isTestMode, db } from '../../lib/storage'
import { useAuth } from '../../lib/auth'
import { useQueryClient } from '@tanstack/react-query'
import { Sun, Moon } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
const PERIODS = [1, 2, 3, 4, 5, 6]

const CLASS_COLOURS = [
  '#e87d7d','#f0733a','#f0a040','#e8c840','#a8c840',
  '#7db88d','#40b8a0','#4098c0','#6090c0','#7070d0',
  '#b070c0','#d060a0','#c08060','#8090a0','#60a878',
  '#d4a060','#a06080','#507890','#70b0d0','#c0a840'
]


function StyleThumbnail({ id }) {
  const c = 'var(--border)'
  const t = 'var(--text-muted)'
  const g = 'var(--gold)'
  const s = 'var(--bg-surface)'
  const r = 'var(--bg-raised)'

  if (id === 'default') return (
    <svg viewBox="0 0 120 64" width="100%" height="64" style={{ display: 'block' }}>
      <rect width="30" height="64" fill={s} />
      <rect x="0.5" y="0" width="29" height="64" stroke={c} strokeWidth="0.5" fill="none" />
      <rect x="6" y="8" width="18" height="5" rx="1" fill={g} opacity="0.7" />
      {[20,30,40,50].map((y,i) => <rect key={i} x="4" y={y} width="22" height="5" rx="1" fill={t} opacity="0.3" />)}
      <rect x="30" width="90" height="64" fill="var(--bg-base)" />
      {[0,1,2,3,4].map(i => <rect key={i} x={34+i*17} y="8" width="13" height="10" rx="1" fill={r} stroke={c} strokeWidth="0.5" />)}
      {[[34,24,'#6090c0'],[51,24,'#1D9E75'],[34,38,'#D85A30'],[68,38,'#6090c0'],[85,24,'#1D9E75']].map(([x,y,col],i) => (
        <rect key={i} x={x} y={y} width="13" height="12" rx="1" fill={col} opacity="0.2" stroke={col} strokeWidth="0.5" />
      ))}
    </svg>
  )

  if (id === 'editorial') return (
    <svg viewBox="0 0 120 64" width="100%" height="64" style={{ display: 'block' }}>
      <rect width="26" height="64" fill={s} />
      <rect x="4" y="8" width="16" height="6" rx="0.5" fill={t} opacity="0.8" />
      {[20,29,38,47].map((y,i) => <rect key={i} x="4" y={y} width="18" height="4" rx="0.5" fill={t} opacity="0.25" />)}
      <rect x="26" width="94" height="64" fill="var(--bg-base)" />
      {[0,1,2,3,4].map(i => <rect key={i} x={30+i*18} y="6" width="14" height="8" rx="0" fill="none" stroke={c} strokeWidth="0.5" />)}
      {[[30,18,'#378ADD'],[48,18,'#D85A30'],[30,30,'#1D9E75'],[66,30,'#378ADD'],[84,18,'#1D9E75']].map(([x,y,col],i) => (
        <g key={i}><rect x={x} y={y} width="2" height="11" fill={col} /><rect x={x+3} y={y} width="11" height="11" rx="0" fill={r} stroke={c} strokeWidth="0.5" /></g>
      ))}
    </svg>
  )

  if (id === 'cards') return (
    <svg viewBox="0 0 120 64" width="100%" height="64" style={{ display: 'block' }}>
      <rect width="18" height="64" fill={s} />
      {[8,22,36,50].map((y,i) => <rect key={i} x="3" y={y} width="12" height="10" rx="2" fill={t} opacity={i===0?0.5:0.2} />)}
      <rect x="18" width="102" height="64" fill="var(--bg-base)" />
      {[0,1,2,3,4].map(i => (
        <rect key={i} x={22+i*20} y="6" width="17" height="52" rx="3" fill={r} stroke={c} strokeWidth="0.5" />
      ))}
      {[[22,14,'#378ADD'],[42,10,'#D85A30'],[42,24,'#1D9E75'],[62,14,'#378ADD'],[82,10,'#D85A30']].map(([x,y,col],i) => (
        <rect key={i} x={x+1} y={y} width="2.5" height="11" rx="1" fill={col} />
      ))}
    </svg>
  )

  if (id === 'timetable') return (
    <svg viewBox="0 0 120 64" width="100%" height="64" style={{ display: 'block' }}>
      <rect width="120" height="14" fill={s} />
      {['W','H','N','C'].map((lbl, i) => (
        <text key={i} x={28+i*22} y="10" fontSize="5" fill={t} textAnchor="middle">{lbl}</text>
      ))}
      <rect y="14" x="0" width="30" height="50" fill={s} />
      {['Yr9 Maths','Yr8 Sci','Yr10 Eng'].map((lbl,i) => (
        <g key={i}><rect x="2" y={18+i*16} width="3" height="11" rx="1" fill={['#378ADD','#1D9E75','#D85A30'][i]} /><text x="8" y={26+i*16} fontSize="4.5" fill={t}>{lbl}</text></g>
      ))}
      {[0,1,2,3,4].map(di => [0,1,2].map(ri => {
        const colors = ['#378ADD','#1D9E75','#D85A30']
        const filled = (di+ri)%3 !== 0
        return filled ? <rect key={`${di}${ri}`} x={31+di*18} y={18+ri*16} width="16" height="11" rx="1.5" fill={colors[ri]} opacity="0.18" stroke={colors[ri]} strokeWidth="0.5" /> : <rect key={`${di}${ri}`} x={31+di*18} y={18+ri*16} width="16" height="11" rx="1.5" fill="none" stroke={c} strokeWidth="0.5" strokeDasharray="2,1.5" />
      }))}
    </svg>
  )

  return null
}

function Section({ title, children }) {
  return (
    <section className="card p-5 space-y-4">
      <h3 className="section-title pb-3" style={{ borderBottom: '1px solid var(--border)' }}>{title}</h3>
      {children}
    </section>
  )
}

// Visual timetable grid for building slots
function TimetableBuilder({ slots, classes, timetableType, onAddSlot, onDeleteSlot }) {
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id || '')
  const [selectedWeek, setSelectedWeek] = useState(1)

  const getSlot = (day, period, week) =>
    slots.find(s => s.day_of_week === day && s.period_number === period && s.cycle_week === week)

  const handleCellClick = async (day, period) => {
    const existing = getSlot(day, period, selectedWeek)
    if (existing) {
      onDeleteSlot(existing.id)
    } else {
      if (!selectedClass) return
      onAddSlot({ class_id: selectedClass, day_of_week: day, period_number: period, cycle_week: selectedWeek })
    }
  }

  const weeks = timetableType === '2_week' ? [1, 2] : [1]

  return (
    <div className="space-y-4">
      {/* Class picker */}
      <div>
        <label className="label">Click a cell to assign the selected class</label>
        <div className="flex flex-wrap gap-2">
          {classes.map(cls => (
            <button key={cls.id} onClick={() => setSelectedClass(cls.id)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all border"
              style={{
                background: selectedClass === cls.id ? (cls.color_code || '#888') + '30' : 'var(--hover-bg)',
                borderColor: selectedClass === cls.id ? (cls.color_code || '#888') : 'var(--border)',
                color: 'var(--text-primary)',
                fontWeight: selectedClass === cls.id ? 600 : 400
              }}>
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: cls.color_code || '#888' }} />
              {cls.name}
            </button>
          ))}
        </div>
      </div>

      {/* Week tabs */}
      {timetableType === '2_week' && (
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
          {[1,2].map(w => (
            <button key={w} onClick={() => setSelectedWeek(w)}
              className="px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={selectedWeek === w
                ? { background: 'var(--bg-raised)', color: 'var(--text-primary)' }
                : { color: 'var(--text-secondary)' }
              }>
              Week {w === 1 ? 'A' : 'B'}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      <div className="overflow-x-auto">
        <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(5, 1fr)', gap: '4px', minWidth: '400px' }}>
          {/* Header */}
          <div />
          {DAYS.map(d => (
            <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
          ))}
          {/* Cells */}
          {PERIODS.map(period => (
            <>
              <div key={`p${period}`} className="flex items-center justify-center text-xs font-mono"
                style={{ color: 'var(--text-muted)' }}>P{period}</div>
              {[1,2,3,4,5].map(day => {
                const slot = getSlot(day, period, selectedWeek)
                const cls = slot ? classes.find(c => c.id === slot.class_id) : null
                const pendingCls = !slot ? classes.find(c => c.id === selectedClass) : null
                return (
                  <button key={day} onClick={() => handleCellClick(day, period)}
                    className="h-12 rounded-lg text-xs font-medium transition-all relative group"
                    style={slot && cls
                      ? { background: (cls.color_code || '#888') + '30', border: `2px solid ${cls.color_code || '#888'}`, color: 'var(--text-primary)' }
                      : { background: 'var(--hover-bg)', border: '1px dashed var(--border)', color: 'var(--text-muted)' }
                    }
                    title={slot ? `Click to remove ${cls?.name}` : `Click to add ${pendingCls?.name || 'class'}`}
                  >
                    {slot && cls ? (
                      <>
                        <span className="block truncate px-1 leading-tight">{cls.name}</span>
                        <span className="absolute inset-0 rounded-lg bg-red-500/0 group-hover:bg-red-500/15 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <X size={14} />
                        </span>
                      </>
                    ) : (
                      <span className="opacity-0 group-hover:opacity-40 transition-all">+</span>
                    )}
                  </button>
                )
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function SettingsView() {
  const toast = useToast()
  const { style, setStyle, mode, toggleMode } = useTheme()
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: profile } = useProfile()
  const upsertProfile = useUpsertProfile()
  const { data: holidays = [] } = useHolidays()
  const addHoliday = useAddHoliday()
  const deleteHoliday = useDeleteHoliday()
  const { data: classes = [] } = useClasses()
  const addClass = useAddClass()
  const updateClass = useUpdateClass()
  const deleteClass = useDeleteClass()
  const { data: slots = [] } = useTimetableSlots()
  const addSlot = useAddTimetableSlot()
  const deleteSlot = useDeleteTimetableSlot()
  const { data: schemes = [] } = useSchemes()
  const addScheme = useAddScheme()
  const updateScheme = useUpdateScheme()
  const deleteScheme = useDeleteScheme()

  const [profileForm, setProfileForm] = useState({ display_name: '', timetable_type: '2_week', cycle_start_date: '' })
  useEffect(() => {
    if (profile) setProfileForm({
      display_name: profile.display_name || '',
      timetable_type: profile.timetable_type || '2_week',
      cycle_start_date: profile.cycle_start_date || ''
    })
  }, [profile])

  const handleSaveProfile = async () => {
    try { await upsertProfile.mutateAsync(profileForm); toast.success('Profile saved') }
    catch { toast.error('Failed to save') }
  }

  const [holidayForm, setHolidayForm] = useState({ start_date: '', end_date: '', label: '' })
  const handleAddHoliday = async () => {
    if (!holidayForm.start_date || !holidayForm.end_date || !holidayForm.label) return
    try { await addHoliday.mutateAsync(holidayForm); setHolidayForm({ start_date: '', end_date: '', label: '' }); toast.success('Holiday added') }
    catch { toast.error('Failed') }
  }

  const [classForm, setClassForm] = useState({ name: '', room: '', color_code: CLASS_COLOURS[0], sow_id: '' })
  const [editingClass, setEditingClass] = useState(null)
  const handleAddClass = async () => {
    if (!classForm.name) return
    try { await addClass.mutateAsync(classForm); setClassForm({ name: '', room: '', color_code: CLASS_COLOURS[0], sow_id: '' }); toast.success('Class added') }
    catch { toast.error('Failed') }
  }
  const handleSaveClass = async () => {
    if (!editingClass?.name) return
    try { await updateClass.mutateAsync(editingClass); setEditingClass(null); toast.success('Class updated') }
    catch { toast.error('Failed') }
  }

  const handleAddSlot = async (slotData) => {
    const dup = slots.find(s => s.class_id === slotData.class_id && s.day_of_week === slotData.day_of_week && s.period_number === slotData.period_number && s.cycle_week === slotData.cycle_week)
    if (dup) return
    try { await addSlot.mutateAsync(slotData) }
    catch { toast.error('Failed to add slot') }
  }

  const [schemeForm, setSchemeForm] = useState({ title: '' })
  const [lessonInputs, setLessonInputs] = useState({})
  const handleAddScheme = async () => {
    if (!schemeForm.title) return
    try { await addScheme.mutateAsync(schemeForm); setSchemeForm({ title: '' }); toast.success('SoW created') }
    catch { toast.error('Failed') }
  }
  const handleAddLesson = async (scheme) => {
    const val = lessonInputs[scheme.id] || ''
    if (!val.trim()) return
    try {
      await updateScheme.mutateAsync({ id: scheme.id, lessons: [...(scheme.lessons || []), val.trim()] })
      setLessonInputs(p => ({ ...p, [scheme.id]: '' }))
    } catch { toast.error('Failed') }
  }
  const handleRemoveLesson = async (scheme, index) => {
    await updateScheme.mutateAsync({ id: scheme.id, lessons: scheme.lessons.filter((_, i) => i !== index) })
  }

  // Year-end reset
  const [showReset, setShowReset] = useState(false)
  const [resetConfirm, setResetConfirm] = useState('')
  const handleYearEnd = async () => {
    if (resetConfirm !== 'RESET') { toast.error('Type RESET to confirm'); return }
    try {
      const database = db()
      const uid = user.id
      const del = async (table) => {
        const { data } = await database.from(table).select('*').eq('user_id', uid)
        for (const row of data || []) await database.from(table).delete().eq('id', row.id)
      }
      // Clear all per-year data
      await del('lesson_plans')
      await del('milestones')
      await del('cover_slips')
      await del('homework')
      await del('timetable_slots')
      await del('holidays')
      await del('class_notes')
      // Delete classes (cascades to slots already deleted)
      await del('classes')
      await qc.invalidateQueries()
      toast.success('New school year started — classes, timetable, holidays and lesson data cleared. Schemes of work kept.')
      setShowReset(false)
      setResetConfirm('')
    } catch (e) { toast.error('Reset failed: ' + e.message) }
  }


  // School logo — stored as base64 in localStorage for both test and prod
  const [logoDataUrl, setLogoDataUrl] = useState(() => localStorage.getItem('cadence_school_logo') || '')
  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 200 * 1024) { toast.error('Logo must be under 200KB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target.result
      localStorage.setItem('cadence_school_logo', dataUrl)
      setLogoDataUrl(dataUrl)
      toast.success('Logo saved')
    }
    reader.readAsDataURL(file)
  }
  const handleRemoveLogo = () => {
    localStorage.removeItem('cadence_school_logo')
    setLogoDataUrl('')
    toast.success('Logo removed')
  }

  const testMode = isTestMode()

  return (
    <div className="p-4 lg:p-6 max-w-2xl mx-auto animate-fade-in space-y-5">
      <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h2>
      <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)' }}>
        <div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Got files to import?</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Import timetable (PDF), calendar (Excel) or schemes of work (Word)</p>
        </div>
        <a href="/import" className="btn-secondary text-xs gap-2" style={{ minHeight: 'unset', padding: '6px 12px', textDecoration: 'none' }}>
          Import →
        </a>
      </div>

      {/* Profile */}
      <Section title="Your Profile">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Display Name</label>
            <input className="input" value={profileForm.display_name}
              onChange={e => setProfileForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Used on cover slips" />
          </div>
          <div>
            <label className="label">Timetable</label>
            <select className="input" value={profileForm.timetable_type}
              onChange={e => setProfileForm(f => ({ ...f, timetable_type: e.target.value }))}>
              <option value="1_week">1-week cycle</option>
              <option value="2_week">2-week cycle (A/B)</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Cycle Start Date (Week A / Week 1)</label>
          <input type="date" className="input max-w-xs" value={profileForm.cycle_start_date}
            onChange={e => setProfileForm(f => ({ ...f, cycle_start_date: e.target.value }))} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>The Monday on which Week A begins.</p>
        </div>
        <button onClick={handleSaveProfile} className="btn-primary gap-2">
          <Save size={16} /> Save Profile
        </button>
      </Section>

      {/* Appearance */}
      <Section title="Appearance">
        <div>
          <label className="label">Layout style</label>
          <div className="grid grid-cols-2 gap-2 mt-1">
            {STYLES.map(s => (
              <button key={s.id} onClick={() => setStyle(s.id)}
                className="flex flex-col items-start gap-1 rounded-lg border text-left transition-all overflow-hidden"
                style={{
                  background: style === s.id ? 'var(--nav-active-bg)' : 'var(--hover-bg)',
                  border: style === s.id ? '2px solid var(--gold)' : '1px solid var(--border)',
                }}>
                {/* Mini preview thumbnail */}
                <div style={{ width: '100%', height: '64px', background: 'var(--bg-base)', overflow: 'hidden', position: 'relative', flexShrink: 0 }}>
                  <StyleThumbnail id={s.id} />
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <div className="text-sm font-medium" style={{ color: style === s.id ? 'var(--nav-active-color)' : 'var(--text-primary)' }}>{s.label}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{s.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Mode</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Switch between dark and light</p>
          </div>
          <button onClick={toggleMode}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all"
            style={{ background: 'var(--hover-bg)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
            {mode === 'dark' ? <><Sun size={16} /> Light mode</> : <><Moon size={16} /> Dark mode</>}
          </button>
        </div>
      </Section>

      {/* Holidays */}
      <Section title="School Holidays & INSET Days">
        <div className="space-y-2">
          {holidays.map(h => (
            <div key={h.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--hover-bg)' }}>
              <div className="flex-1">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{h.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{h.start_date} → {h.end_date}</p>
              </div>
              <button onClick={() => deleteHoliday.mutate(h.id)} className="p-1 transition-colors" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Start Date</label><input type="date" className="input" value={holidayForm.start_date} onChange={e => setHolidayForm(f => ({ ...f, start_date: e.target.value }))} /></div>
            <div><label className="label">End Date</label><input type="date" className="input" value={holidayForm.end_date} onChange={e => setHolidayForm(f => ({ ...f, end_date: e.target.value }))} /></div>
          </div>
          <div><label className="label">Label</label><input className="input" placeholder="e.g. Half Term, INSET Day" value={holidayForm.label} onChange={e => setHolidayForm(f => ({ ...f, label: e.target.value }))} /></div>
          <button onClick={handleAddHoliday} className="btn-secondary gap-2"><Plus size={14} /> Add</button>
        </div>
      </Section>

      {/* Classes */}
      <Section title="Classes">
        <div className="space-y-2">
          {classes.map(cls => (
            editingClass?.id === cls.id ? (
              <div key={cls.id} className="card p-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input className="input" value={editingClass.name} onChange={e => setEditingClass(c => ({ ...c, name: e.target.value }))} />
                  <input className="input" placeholder="Room" value={editingClass.room || ''} onChange={e => setEditingClass(c => ({ ...c, room: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Colour</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {CLASS_COLOURS.map(col => (
                      <button key={col} onClick={() => setEditingClass(c => ({ ...c, color_code: col }))}
                        className="w-7 h-7 rounded-full transition-all"
                        style={{ background: col, outline: editingClass.color_code === col ? `3px solid var(--text-primary)` : 'none', outlineOffset: '2px' }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label">Scheme of Work</label>
                  <select className="input" value={editingClass.sow_id || ''} onChange={e => setEditingClass(c => ({ ...c, sow_id: e.target.value || null }))}>
                    <option value="">No SoW linked</option>
                    {schemes.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSaveClass} className="btn-primary flex-1 gap-1.5"><Check size={14} /> Save</button>
                  <button onClick={() => setEditingClass(null)} className="btn-ghost flex-1"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <div key={cls.id} className="flex items-center gap-3 rounded-lg px-3 py-2" style={{ background: 'var(--hover-bg)' }}>
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: cls.color_code || '#888' }} />
                <div className="flex-1">
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{cls.name}</p>
                  {cls.room && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Room {cls.room}</p>}
                </div>
                <button onClick={() => setEditingClass({ ...cls })} className="p-1" style={{ color: 'var(--text-muted)' }}><Edit2 size={13} /></button>
                <button onClick={() => deleteClass.mutate(cls.id)} className="p-1" style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Trash2 size={13} /></button>
              </div>
            )
          ))}
        </div>
        <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="grid grid-cols-2 gap-2">
            <div><label className="label">Class Name</label><input className="input" placeholder="e.g. Year 9 Maths" value={classForm.name} onChange={e => setClassForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><label className="label">Default Room</label><input className="input" placeholder="e.g. B12" value={classForm.room} onChange={e => setClassForm(f => ({ ...f, room: e.target.value }))} /></div>
          </div>
          <div>
            <label className="label">Colour</label>
            <div className="flex gap-1.5 flex-wrap">
              {CLASS_COLOURS.map(col => (
                <button key={col} onClick={() => setClassForm(f => ({ ...f, color_code: col }))}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{ background: col, outline: classForm.color_code === col ? `3px solid var(--text-primary)` : 'none', outlineOffset: '2px' }} />
              ))}
            </div>
          </div>
          <button onClick={handleAddClass} className="btn-secondary gap-2"><Plus size={14} /> Add Class</button>
        </div>
      </Section>

      {/* Visual timetable builder */}
      <Section title="Timetable">
        {classes.length === 0
          ? <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Add classes first, then build your timetable here.</p>
          : <TimetableBuilder slots={slots} classes={classes} timetableType={profileForm.timetable_type} onAddSlot={handleAddSlot} onDeleteSlot={id => deleteSlot.mutate(id)} />
        }
      </Section>

      {/* Schemes of Work */}
      <Section title="Schemes of Work">
        {schemes.map(scheme => (
          <div key={scheme.id} className="rounded-xl p-4 space-y-3" style={{ background: 'var(--hover-bg)' }}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{scheme.title}</p>
              <button onClick={() => deleteScheme.mutate(scheme.id)} className="p-1" style={{ color: 'var(--text-muted)' }}
                onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><Trash2 size={13} /></button>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {(scheme.lessons || []).map((lesson, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs w-6 shrink-0" style={{ color: 'var(--text-muted)' }}>{i+1}</span>
                  <span className="flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>{lesson}</span>
                  <button onClick={() => handleRemoveLesson(scheme, i)} className="p-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}><X size={12} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input className="input text-xs" placeholder="Add next lesson title…"
                value={lessonInputs[scheme.id] || ''}
                onChange={e => setLessonInputs(p => ({ ...p, [scheme.id]: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') handleAddLesson(scheme) }} />
              <button onClick={() => handleAddLesson(scheme)} className="btn-secondary text-xs px-3 shrink-0"><Plus size={12} /></button>
            </div>
          </div>
        ))}
        <div className="pt-2 flex gap-2" style={{ borderTop: '1px solid var(--border)' }}>
          <input className="input" placeholder="New SoW title…" value={schemeForm.title}
            onChange={e => setSchemeForm({ title: e.target.value })}
            onKeyDown={e => { if (e.key === 'Enter') handleAddScheme() }} />
          <button onClick={handleAddScheme} className="btn-secondary gap-2 shrink-0"><Plus size={14} /> Create</button>
        </div>
      </Section>

      {/* Year-end reset */}
      <Section title="End of Year">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          At the end of the school year, clear all lesson plans, cover slips, milestones and homework while keeping your classes, timetable, and schemes of work.
        </p>
        {!showReset ? (
          <button onClick={() => setShowReset(true)} className="btn-danger gap-2">
            <RefreshCw size={16} /> Start New School Year…
          </button>
        ) : (
          <div className="space-y-3 p-4 rounded-lg border border-red-400/30" style={{ background: 'rgba(232,125,125,0.08)' }}>
            <div className="flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">This will permanently delete: all classes, timetable slots, holidays, lesson plans, cover slips, milestones, and homework. Schemes of work and notes are kept. This cannot be undone.</p>
            </div>
            <input className="input" placeholder='Type RESET to confirm' value={resetConfirm} onChange={e => setResetConfirm(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleYearEnd} className="btn-danger flex-1">Confirm Reset</button>
              <button onClick={() => { setShowReset(false); setResetConfirm('') }} className="btn-ghost flex-1">Cancel</button>
            </div>
          </div>
        )}
      </Section>

      {/* School Logo */}
      <Section title="School Logo">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Appears on printed cover slips. Upload a PNG or JPG under 200KB.
        </p>
        {logoDataUrl ? (
          <div className="flex items-center gap-4">
            <img src={logoDataUrl} alt="School logo" className="h-12 object-contain rounded border" style={{ borderColor: 'var(--border)', background: 'white', padding: '4px' }} />
            <button onClick={handleRemoveLogo} className="btn-danger gap-2 text-xs"><Trash2 size={13} /> Remove</button>
          </div>
        ) : (
          <label className="flex items-center gap-3 cursor-pointer">
            <div className="btn-secondary gap-2 text-sm">
              <Plus size={14} /> Upload logo
            </div>
            <input type="file" accept="image/png,image/jpeg,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
          </label>
        )}
      </Section>

      {/* Developer */}
      <Section title="Developer">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Test Mode</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>All data stored in localStorage. No Supabase needed.</p>
          </div>
          <button onClick={() => { setTestMode(!testMode); window.location.reload() }}
            className="relative w-12 h-6 rounded-full transition-colors"
            style={{ background: testMode ? '#f0a040' : 'var(--border)' }}>
            <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all"
              style={{ left: testMode ? '1.5rem' : '0.125rem' }} />
          </button>
        </div>
      </Section>
    </div>
  )
}
