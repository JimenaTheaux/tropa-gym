import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Disciplina, DisciplinaInsert } from '@/types/db'
import { useDisciplinas } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput, FormCheckbox } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { BadgeActivo } from '@/components/ui/BadgeEstado'

const emptyForm: DisciplinaInsert = { nombre: '', activo: true, horario_libre: false }

export function DisciplinasPanel() {
  const { data: disciplinas = [], isLoading: loading } = useDisciplinas()
  const { crear, actualizar, eliminar } = useCatalogoMutations<DisciplinaInsert>('disciplinas', queryKeys.disciplinas)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Disciplina | null>(null)
  const [form, setForm] = useState<DisciplinaInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Disciplina | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(disciplina: Disciplina) {
    setEditing(disciplina)
    setForm({ nombre: disciplina.nombre, activo: disciplina.activo, horario_libre: disciplina.horario_libre })
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

  const columns: DataTableColumn<Disciplina>[] = [
    { header: 'Nombre', cell: (d) => d.nombre },
    { header: 'Estado', cell: (d) => <BadgeActivo activo={d.activo} /> },
    { header: 'Horario libre', cell: (d) => (d.horario_libre ? 'Sí' : 'No') },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Disciplinas disponibles. No afectan el precio.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nueva disciplina
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={disciplinas}
        rowKey={(d) => d.id}
        cardTitle={(d) => d.nombre}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay disciplinas cargadas."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar disciplina' : 'Nueva disciplina'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-disciplina" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-disciplina" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <FormInput
            id="disciplina-nombre"
            label="Nombre"
            required
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
          <FormCheckbox
            id="disciplina-activo"
            label="Disciplina activa"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          <FormCheckbox
            id="disciplina-horario-libre"
            label="Horario libre (sin turno fijo, ej. Musculación)"
            checked={form.horario_libre}
            onChange={(e) => setForm({ ...form, horario_libre: e.target.checked })}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar disciplina"
        message={`¿Eliminar la disciplina "${deleting?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
