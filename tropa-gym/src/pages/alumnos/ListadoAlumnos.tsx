import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Alumno, AlumnoInsert } from '@/types/db'
import { useDisciplinasActivas, useCombosActivos } from '@/hooks/useCatalogos'
import { useAlumnos } from '@/hooks/useAlumnos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { FichaAlumnoDrawer } from '@/components/ui/FichaAlumnoDrawer'
import { AlumnoFormFields } from '@/components/ui/AlumnoFormFields'

const emptyForm: AlumnoInsert = {
  nombre: '',
  apellido: '',
  dni: '',
  telefono: '',
  fecha_nacimiento: '',
  disciplina_id: null,
  combo_id: null,
}

function toPayload(form: AlumnoInsert): AlumnoInsert {
  return {
    ...form,
    telefono: form.telefono?.trim() ? form.telefono.trim() : null,
    fecha_nacimiento: form.fecha_nacimiento || null,
    disciplina_id: form.disciplina_id || null,
    combo_id: form.combo_id || null,
  }
}

export function ListadoAlumnos() {
  const { data: alumnos = [], isLoading: loading } = useAlumnos()
  const { data: disciplinas = [] } = useDisciplinasActivas()
  const { data: combos = [] } = useCombosActivos()
  const { crear, actualizar, eliminar } = useCatalogoMutations<AlumnoInsert>('alumnos', queryKeys.alumnos)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Alumno | null>(null)
  const [form, setForm] = useState<AlumnoInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Alumno | null>(null)
  const [viewing, setViewing] = useState<Alumno | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(alumno: Alumno) {
    setEditing(alumno)
    setForm({
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      dni: alumno.dni,
      telefono: alumno.telefono ?? '',
      fecha_nacimiento: alumno.fecha_nacimiento ?? '',
      disciplina_id: alumno.disciplina_id,
      combo_id: alumno.combo_id,
    })
    setError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const payload = toPayload(form)

    try {
      if (editing) await actualizar.mutateAsync({ id: editing.id, payload })
      else await crear.mutateAsync(payload)
    } catch (err) {
      const message = err instanceof Error ? err.message : null
      setError(message?.includes('duplicate') ? 'Ya existe un alumno con ese DNI.' : traducirError(message))
      return
    }
    setDrawerOpen(false)
  }

  async function handleDelete() {
    if (!deleting) return
    try {
      await eliminar.mutateAsync(deleting.id)
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
      setDeleting(null)
      return
    }
    setDeleting(null)
  }

  const columns: DataTableColumn<Alumno>[] = [
    { header: 'Nombre', cell: (a) => `${a.nombre} ${a.apellido}` },
    { header: 'DNI', cell: (a) => a.dni },
    { header: 'Teléfono', cell: (a) => a.telefono ?? '—' },
    { header: 'Estado', cell: (a) => <BadgeEstado estado={a.estado} /> },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Alumnos registrados en el gimnasio.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo alumno
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={alumnos}
        rowKey={(a) => a.id}
        cardTitle={(a) => `${a.nombre} ${a.apellido}`}
        onEdit={openEdit}
        onDelete={setDeleting}
        onRowClick={setViewing}
        loading={loading}
        emptyMessage="Todavía no hay alumnos cargados."
      />

      <FichaAlumnoDrawer alumno={viewing} onClose={() => setViewing(null)} />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar alumno' : 'Nuevo alumno'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-alumno" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-alumno" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <AlumnoFormFields
            idPrefix="alumno"
            form={form}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            disciplinas={disciplinas}
            combos={combos}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar alumno"
        message={`¿Eliminar a "${deleting?.nombre} ${deleting?.apellido}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
