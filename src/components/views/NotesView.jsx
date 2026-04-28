import { useState, useEffect, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { Plus, Trash2, StickyNote, BookOpen, Edit2, Search, X } from 'lucide-react'
import { useClasses, useClassNotes, useUpsertClassNote, useGeneralNotes, useAddGeneralNote, useUpdateGeneralNote, useDeleteGeneralNote } from '../../lib/hooks'
import { useToast } from '../../lib/toast'

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

export default function NotesView() {
  const [tab, setTab] = useState('class')
  const [searchQuery, setSearchQuery] = useState('')
  const toast = useToast()

  const { data: classes = [] } = useClasses()
  const { data: classNotes = [] } = useClassNotes()
  const { data: generalNotes = [] } = useGeneralNotes()
  const upsertClassNote = useUpsertClassNote()
  const addNote = useAddGeneralNote()
  const updateNote = useUpdateGeneralNote()
  const deleteNote = useDeleteGeneralNote()

  const [selectedClass, setSelectedClass] = useState(null)
  const [classNoteContent, setClassNoteContent] = useState('')
  const [classNoteEditing, setClassNoteEditing] = useState(false)
  const [newNoteForm, setNewNoteForm] = useState({ title: '', content: '' })
  const [showNewNote, setShowNewNote] = useState(false)
  const [editingNote, setEditingNote] = useState(null)

  const q = searchQuery.trim().toLowerCase()
  const isSearching = q.length >= 2

  const handleSelectClass = (cls) => {
    setSelectedClass(cls)
    const note = classNotes.find(n => n.class_id === cls.id)
    setClassNoteContent(note?.content || '')
    setClassNoteEditing(false)
  }

  useEffect(() => {
    if (selectedClass) {
      const note = classNotes.find(n => n.class_id === selectedClass.id)
      setClassNoteContent(note?.content || '')
    }
  }, [classNotes, selectedClass])

  // When searching, auto-switch to whichever tab has results
  useEffect(() => {
    if (!isSearching) return
    const hasGeneralHits = generalNotes.some(n =>
      n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    )
    const hasClassHits = classNotes.some(n => n.content?.toLowerCase().includes(q)) ||
      classes.some(c => c.name.toLowerCase().includes(q))
    if (hasGeneralHits && !hasClassHits) setTab('general')
    if (hasClassHits && !hasGeneralHits) setTab('class')
  }, [isSearching, q])

  const handleSaveClassNote = async () => {
    const existing = classNotes.find(n => n.class_id === selectedClass.id)
    try {
      await upsertClassNote.mutateAsync({ ...(existing?.id ? { id: existing.id } : {}), class_id: selectedClass.id, content: classNoteContent })
      toast.success('Saved'); setClassNoteEditing(false)
    } catch { toast.error('Failed to save') }
  }

  const handleAddGeneralNote = async () => {
    if (!newNoteForm.content.trim()) return
    try { await addNote.mutateAsync(newNoteForm); setNewNoteForm({ title: '', content: '' }); setShowNewNote(false); toast.success('Note added') }
    catch { toast.error('Failed') }
  }

  const handleUpdateNote = async (note) => {
    try { await updateNote.mutateAsync({ id: note.id, title: note.title, content: note.content }); setEditingNote(null); toast.success('Saved') }
    catch { toast.error('Failed') }
  }

  // Filtered data
  const filteredClasses = useMemo(() => {
    if (!isSearching) return classes
    return classes.filter(cls => {
      if (cls.name.toLowerCase().includes(q)) return true
      const note = classNotes.find(n => n.class_id === cls.id)
      return note?.content?.toLowerCase().includes(q)
    })
  }, [classes, classNotes, isSearching, q])

  const filteredGeneralNotes = useMemo(() => {
    if (!isSearching) return generalNotes
    return generalNotes.filter(n =>
      n.title?.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q)
    )
  }, [generalNotes, isSearching, q])

  // Count hits for tab badge
  const classHitCount = isSearching ? filteredClasses.length : null
  const generalHitCount = isSearching ? filteredGeneralNotes.length : null

  return (
    <div className="p-4 lg:p-6 max-w-3xl mx-auto animate-fade-in">
      {/* Header + search */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <h2 className="font-display text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Notes</h2>
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--text-muted)' }} />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search notes…"
          className="input pl-9 pr-9"
          autoComplete="off"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
            <X size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg w-fit" style={{ background: 'var(--hover-bg)' }}>
        {[['class', 'Class Notes', BookOpen, classHitCount], ['general', 'General Notes', StickyNote, generalHitCount]].map(([val, label, Icon, count]) => (
          <button key={val} onClick={() => setTab(val)}
            className="px-4 py-2 rounded-md text-sm font-medium transition-all flex items-center gap-1.5"
            style={tab === val ? { background: 'var(--bg-raised)', color: 'var(--text-primary)' } : { color: 'var(--text-secondary)' }}>
            <Icon size={14} />
            {label}
            {count !== null && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold"
                style={{ background: count > 0 ? 'rgba(230,176,32,0.25)' : 'var(--hover-bg)', color: count > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Class notes tab */}
      {tab === 'class' && (
        <div className="flex gap-4">
          {/* Class list — filtered when searching */}
          <div className="w-48 shrink-0 space-y-1">
            {filteredClasses.map(cls => {
              const note = classNotes.find(n => n.class_id === cls.id)
              const hasMatch = isSearching && note?.content?.toLowerCase().includes(q)
              return (
                <button key={cls.id} onClick={() => handleSelectClass(cls)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition-all min-h-[44px]"
                  style={selectedClass?.id === cls.id
                    ? { background: 'var(--hover-bg-strong)', color: 'var(--text-primary)' }
                    : { color: 'var(--text-secondary)' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cls.color_code || '#888' }} />
                  <span className="truncate flex-1">{isSearching ? highlight(cls.name, searchQuery) : cls.name}</span>
                  {hasMatch && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--gold)' }} />}
                </button>
              )
            })}
            {filteredClasses.length === 0 && (
              <p className="text-xs px-3" style={{ color: 'var(--text-muted)' }}>
                {isSearching ? 'No matches' : 'No classes yet'}
              </p>
            )}
          </div>

          {/* Note editor */}
          <div className="flex-1 min-w-0">
            {!selectedClass ? (
              <div className="card p-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                {filteredClasses.length > 0 ? 'Select a class to view its notes' : isSearching ? 'No matching class notes' : 'Select a class to view its notes'}
              </div>
            ) : (
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedClass.name}</p>
                  {!classNoteEditing
                    ? <button onClick={() => setClassNoteEditing(true)} className="btn-ghost text-xs gap-1.5"><Edit2 size={12} /> Edit</button>
                    : <div className="flex gap-2">
                        <button onClick={() => setClassNoteEditing(false)} className="btn-ghost text-xs">Cancel</button>
                        <button onClick={handleSaveClassNote} className="btn-primary text-xs py-1.5 px-3">Save</button>
                      </div>
                  }
                </div>
                {classNoteEditing ? (
                  <textarea className="textarea w-full" rows={8} value={classNoteContent}
                    onChange={e => setClassNoteContent(e.target.value)}
                    placeholder={`Notes for ${selectedClass.name}…`} autoFocus />
                ) : (
                  <p className="text-sm whitespace-pre-wrap min-h-[100px]"
                    style={{ color: classNoteContent ? 'var(--text-secondary)' : 'var(--text-muted)', fontStyle: classNoteContent ? 'normal' : 'italic' }}>
                    {isSearching && classNoteContent
                      ? highlight(classNoteContent, searchQuery)
                      : classNoteContent || 'No notes yet.'
                    }
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* General notes tab */}
      {tab === 'general' && (
        <div className="space-y-3">
          {!isSearching && (
            <button onClick={() => setShowNewNote(!showNewNote)} className="btn-primary gap-2">
              <Plus size={16} /> New Note
            </button>
          )}

          {showNewNote && (
            <div className="card p-4 space-y-3 animate-slide-up">
              <input className="input" placeholder="Title (optional)" value={newNoteForm.title}
                onChange={e => setNewNoteForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="textarea" rows={4} placeholder="Your note…" value={newNoteForm.content}
                onChange={e => setNewNoteForm(f => ({ ...f, content: e.target.value }))} autoFocus />
              <div className="flex gap-2">
                <button onClick={handleAddGeneralNote} className="btn-primary flex-1">Save Note</button>
                <button onClick={() => setShowNewNote(false)} className="btn-ghost flex-1">Cancel</button>
              </div>
            </div>
          )}

          {filteredGeneralNotes.length === 0 && !showNewNote && (
            <div className="card p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              <StickyNote size={28} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
              {isSearching ? `No notes matching "${searchQuery}"` : 'No general notes yet'}
            </div>
          )}

          {filteredGeneralNotes.map(note => (
            <div key={note.id} className="card p-4">
              {editingNote?.id === note.id ? (
                <div className="space-y-3">
                  <input className="input" value={editingNote.title || ''} onChange={e => setEditingNote(n => ({ ...n, title: e.target.value }))} placeholder="Title (optional)" />
                  <textarea className="textarea" rows={4} value={editingNote.content || ''} onChange={e => setEditingNote(n => ({ ...n, content: e.target.value }))} />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdateNote(editingNote)} className="btn-primary flex-1">Save</button>
                    <button onClick={() => setEditingNote(null)} className="btn-ghost flex-1">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      {note.title && (
                        <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                          {isSearching ? highlight(note.title, searchQuery) : note.title}
                        </p>
                      )}
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{format(parseISO(note.updated_at), 'd MMM yyyy')}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => setEditingNote({ ...note })} className="btn-ghost p-1.5 min-w-[32px]"><Edit2 size={13} /></button>
                      <button onClick={() => deleteNote.mutate(note.id)} className="btn-ghost p-1.5 min-w-[32px]"
                        onMouseEnter={e => e.currentTarget.style.color = '#e87d7d'}
                        onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                    {isSearching ? highlight(note.content, searchQuery) : note.content}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
