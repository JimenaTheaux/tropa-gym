import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Profesor, ProfesorInsert } from '@/types/db'
import { useProfesores, usePerfilesProfesores } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput, FormSelect } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'

const emptyForm: ProfesorInsert = { nombre: '', apellido: '', perfil_id: null }

function toPayload(form: ProfesorInsert): ProfesorInsert {
  return { ...form, perfil_id: form.perfil_id || null }
}

export function ProfesoresPanel() {
  const { data: profesores = [], isLoading: loading } = useProfesores()
  const { data: perfiles = [] } = usePerfilesProfesores()
  const { crear, actualizar, eliminar } = useCatalogoMutations<ProfesorInsert>('profesores', ['profesores'])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Profesor | null>(null)
  const [form, setForm] = useState<ProfesorInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Profesor | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(profesor: Profesor) {
    setEditing(profesor)
    setForm({
      nombre: profesor.nombre,
      apellido: profesor.apellido,
      perfil_id: profesor.perfil_id,
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

  const columns: DataTableColumn<Profesor>[] = [
    { header: 'Nombre', cell: (p) => p.nombre },
    { header: 'Apellido', cell: (p) => p.apellido },
    {
      header: 'Usuario asociado',
      cell: (p) => perfiles.find((pe) => pe.id === p.perfil_id)?.nombre ?? '—',
    },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Profesores del gimnasio, asociados opcionalmente a un usuario del sistema.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo profesor
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={profesores}
        rowKey={(p) => p.id}
        cardTitle={(p) => `${p.nombre} ${p.apellido}`}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay profesores cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar profesor' : 'Nuevo profesor'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-profesor" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-profesor" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              id="profesor-nombre"
              label="Nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <FormInput
              id="profesor-apellido"
              label="Apellido"
              required
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
            />
          </div>
          <FormSelect
            id="profesor-perfil"
            label="Usuario asociado (opcional)"
            placeholder="Sin usuario asociado"
            value={form.perfil_id ?? ''}
            onChange={(e) => setForm({ ...form, perfil_id: e.target.value || null })}
            options={perfiles.map((p) => ({ value: p.id, label: p.nombre }))}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar profesor"
        message={`¿Eliminar a "${deleting?.nombre} ${deleting?.apellido}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
