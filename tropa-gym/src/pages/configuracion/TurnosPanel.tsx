import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Turno, TurnoInsert } from '@/types/db'
import { useTurnos } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput, FormCheckbox, FormTimeInput } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { BadgeActivo } from '@/components/ui/BadgeEstado'

const emptyForm: TurnoInsert = { nombre: '', hora: '', activo: true }

export function TurnosPanel() {
  const { data: turnos = [], isLoading: loading } = useTurnos()
  const { crear, actualizar, eliminar } = useCatalogoMutations<TurnoInsert>('turnos', queryKeys.turnos)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Turno | null>(null)
  const [form, setForm] = useState<TurnoInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Turno | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(turno: Turno) {
    setEditing(turno)
    setForm({ nombre: turno.nombre, hora: turno.hora, activo: turno.activo })
    setError(null)
    setDrawerOpen(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      if (editing) await actualizar.mutateAsync({ id: editing.id, payload: form })
      else await crear.mutateAsync(form)
    } catch (err) {
      setError(traducirError(err instanceof Error ? err.message : null))
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

  const columns: DataTableColumn<Turno>[] = [
    { header: 'Nombre', cell: (t) => t.nombre },
    { header: 'Hora', cell: (t) => t.hora.slice(0, 5) },
    { header: 'Estado', cell: (t) => <BadgeActivo activo={t.activo} /> },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Turnos disponibles para asistencia de alumnos.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo turno
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={turnos}
        rowKey={(t) => t.id}
        cardTitle={(t) => t.nombre}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay turnos cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar turno' : 'Nuevo turno'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-turno" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-turno" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              id="turno-nombre"
              label="Nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <FormTimeInput
              id="turno-hora"
              label="Hora"
              required
              value={form.hora}
              onChange={(hora) => setForm({ ...form, hora })}
            />
          </div>
          <FormCheckbox
            id="turno-activo"
            label="Turno activo"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar turno"
        message={`¿Eliminar el turno "${deleting?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
