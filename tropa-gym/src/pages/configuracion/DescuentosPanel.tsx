import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Descuento, DescuentoInsert } from '@/types/db'
import { useDescuentos } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'

const emptyForm: DescuentoInsert = { nombre: '', descripcion: '', porcentaje: 0 }

function toPayload(form: DescuentoInsert): DescuentoInsert {
  return { ...form, descripcion: form.descripcion?.trim() ? form.descripcion.trim() : null }
}

export function DescuentosPanel() {
  const { data: descuentos = [], isLoading: loading } = useDescuentos()
  const { crear, actualizar, eliminar } = useCatalogoMutations<DescuentoInsert>('descuentos', queryKeys.descuentos)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Descuento | null>(null)
  const [form, setForm] = useState<DescuentoInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Descuento | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(descuento: Descuento) {
    setEditing(descuento)
    setForm({
      nombre: descuento.nombre,
      descripcion: descuento.descripcion ?? '',
      porcentaje: descuento.porcentaje,
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

  const columns: DataTableColumn<Descuento>[] = [
    { header: 'Nombre', cell: (d) => d.nombre },
    { header: 'Descripción', cell: (d) => d.descripcion ?? '—' },
    { header: 'Porcentaje', cell: (d) => `${d.porcentaje}%` },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Descuentos disponibles para aplicar en pagos.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo descuento
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={descuentos}
        rowKey={(d) => d.id}
        cardTitle={(d) => d.nombre}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay descuentos cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar descuento' : 'Nuevo descuento'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-descuento" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-descuento" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
            <FormInput
              id="descuento-nombre"
              label="Nombre"
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <FormInput
              id="descuento-porcentaje"
              label="Porcentaje"
              type="number"
              min={0}
              max={100}
              step="0.01"
              required
              value={form.porcentaje}
              onChange={(e) => setForm({ ...form, porcentaje: Number(e.target.value) })}
            />
          </div>
          <FormInput
            id="descuento-descripcion"
            label="Descripción (opcional)"
            value={form.descripcion ?? ''}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar descuento"
        message={`¿Eliminar el descuento "${deleting?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
