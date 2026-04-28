/**
 * Data hooks - all CRUD operations via TanStack Query + storage abstraction.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { db } from './storage'
import { useAuth } from './auth'
import { format } from 'date-fns'

function getDB() {
  return db()
}

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useProfile() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('profiles').select('*').eq('id', user.id).single()
      if (error && error.code !== 'PGRST116') throw error
      return data
    },
    enabled: !!user,
  })
}

export function useUpsertProfile() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (profile) => {
      const { data, error } = await getDB().from('profiles').upsert({ id: user.id, ...profile })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile'] })
  })
}

// ─── Holidays ─────────────────────────────────────────────────────────────────

export function useHolidays() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['holidays', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('holidays').select('*').eq('user_id', user.id).order('start_date')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddHoliday() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (holiday) => {
      const { data, error } = await getDB().from('holidays').insert({ user_id: user.id, ...holiday })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] })
  })
}

export function useUpdateHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await getDB().from('holidays').update(updates).eq('id', id)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] })
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('holidays').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['holidays'] })
  })
}

// ─── Classes ──────────────────────────────────────────────────────────────────

export function useClasses() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['classes', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('classes').select('*').eq('user_id', user.id).order('name')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddClass() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (cls) => {
      const { data, error } = await getDB().from('classes').insert({ user_id: user.id, book_brilliant_done: false, ...cls })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] })
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await getDB().from('classes').update(updates).eq('id', id)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] })
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('classes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['classes'] })
  })
}

// ─── Timetable Slots ──────────────────────────────────────────────────────────

export function useTimetableSlots() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['timetable_slots', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('timetable_slots').select('*').eq('user_id', user.id)
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddTimetableSlot() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (slot) => {
      const { data, error } = await getDB().from('timetable_slots').insert({ user_id: user.id, ...slot })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable_slots'] })
  })
}

export function useDeleteTimetableSlot() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('timetable_slots').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timetable_slots'] })
  })
}

// ─── Schemes of Work ──────────────────────────────────────────────────────────

export function useSchemes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['schemes_of_work', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('schemes_of_work').select('*').eq('user_id', user.id).order('title')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddScheme() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (scheme) => {
      const { data, error } = await getDB().from('schemes_of_work').insert({ user_id: user.id, lessons: [], ...scheme })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schemes_of_work'] })
  })
}

export function useUpdateScheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await getDB().from('schemes_of_work').update(updates).eq('id', id)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schemes_of_work'] })
  })
}

export function useDeleteScheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('schemes_of_work').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schemes_of_work'] })
  })
}

// ─── Lesson Plans ─────────────────────────────────────────────────────────────

export function useLessonPlans() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['lesson_plans', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('lesson_plans').select('*').eq('user_id', user.id).order('date')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useUpsertLessonPlan() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (plan) => {
      const { data, error } = await getDB().from('lesson_plans').upsert({ user_id: user.id, ...plan })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lesson_plans'] })
  })
}

export function useDeleteLessonPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('lesson_plans').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lesson_plans'] })
  })
}

// ─── Milestones ───────────────────────────────────────────────────────────────

export function useMilestones() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['milestones', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('milestones').select('*').eq('user_id', user.id).order('date')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddMilestone() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (m) => {
      const { data, error } = await getDB().from('milestones').insert({ user_id: user.id, ...m })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones'] })
  })
}

export function useDeleteMilestone() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('milestones').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['milestones'] })
  })
}

// ─── Cover Slips ──────────────────────────────────────────────────────────────

export function useCoverSlips() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['cover_slips', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('cover_slips').select('*').eq('user_id', user.id).order('date', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddCoverSlip() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (slip) => {
      const { data, error } = await getDB().from('cover_slips').insert({ user_id: user.id, ...slip })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cover_slips'] })
  })
}

// ─── Homework ─────────────────────────────────────────────────────────────────

export function useHomework() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['homework', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('homework').select('*').eq('user_id', user.id).order('date_due')
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddHomework() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (hw) => {
      const { data, error } = await getDB().from('homework').insert({ user_id: user.id, ...hw })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homework'] })
  })
}

export function useDeleteHomework() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('homework').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['homework'] })
  })
}

// ─── Notes ────────────────────────────────────────────────────────────────────

export function useClassNotes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['class_notes', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('class_notes').select('*').eq('user_id', user.id)
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useUpsertClassNote() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (note) => {
      const { data, error } = await getDB().from('class_notes').upsert({
        user_id: user.id,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        ...note
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['class_notes'] })
  })
}

export function useGeneralNotes() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['general_notes', user?.id],
    queryFn: async () => {
      const { data, error } = await getDB().from('general_notes').select('*').eq('user_id', user.id).order('updated_at', { ascending: false })
      if (error) throw error
      return data || []
    },
    enabled: !!user,
  })
}

export function useAddGeneralNote() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return useMutation({
    mutationFn: async (note) => {
      const { data, error } = await getDB().from('general_notes').insert({
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...note
      })
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['general_notes'] })
  })
}

export function useUpdateGeneralNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }) => {
      const { data, error } = await getDB().from('general_notes').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['general_notes'] })
  })
}

export function useDeleteGeneralNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await getDB().from('general_notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['general_notes'] })
  })
}
