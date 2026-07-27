import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Alumno, AlumnoInsert } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { useCombosActivos, useDisciplinasActivas } from '@/hooks/useCatalogos'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { AlumnoFormFields } from '@/components/ui/AlumnoFormFields'

function formInicial(query: string): AlumnoInsert {
  const term = query.trim()
  const esDni = /^\d+$/.test(term)
  return {
    nombre: esDni ? '' : term,
    apellido: '',
    dni: esDni ? term : '',
    telefono: null,
    fecha_nacimiento: null,
    disciplina_id: null,
    combo_id: null,
  }
}

interface NuevoAlumnoDrawerProps {
  open: boolean
  query: string
  onClose: () => void
  onCreated: (alumno: Alumno) => void
}

// Alta rápida de alumno desde el buscador (Pagos, Asistencia): mismos campos
// que la página Alumnos, pero sin salir de la pantalla donde se lo necesita.
export function NuevoAlumnoDrawer({ open, query, onClose, onCreated }: NuevoAlumnoDrawerProps) {
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const [form, setForm] = useState<AlumnoInsert>(() => formInicial(query))
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const crear = useMutation({
    mutationFn: async (payload: AlumnoInsert) => {
      const { data, error } = await supabase.from('alumnos').insert(payload).select().single()
      if (error || !data) throw new Error(error?.message)
      return data as Alumno
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.alumnos }),
  })
  const saving = crear.isPending

  useEffect(() => {
    if (!open) return
    setForm(formInicial(query))
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const payload: AlumnoInsert = {
      ...form,
      telefono: form.telefono?.trim() ? form.telefono.trim() : null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      disciplina_id: form.disciplina_id || null,
      combo_id: form.combo_id || null,
    }

    try {
      const data = await crear.mutateAsync(payload)
      onCreated(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message?.includes('duplicate') ? 'Ya existe un alumno con ese DNI.' : traducirError(message, 'No se pudo crear el alumno.'))
    }
  }

  return (
    <Drawer
      open={open}
      title="Nuevo alumno"
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="form-nuevo-alumno-inline" variant="solido" disabled={saving}>
            {saving ? 'Guardando…' : 'Guardar y seleccionar'}
          </Button>
        </>
      }
    >
      <form id="form-nuevo-alumno-inline" className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <AlumnoFormFields
          idPrefix="nuevo-alumno-inline"
          form={form}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          disciplinas={disciplinas}
          combos={combos}
        />
        {error && <p className="font-inter text-sm text-error">{error}</p>}
      </form>
    </Drawer>
  )
}
