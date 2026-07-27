import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import type { Combo, ComboInsert } from '@/types/db'
import { useCombos } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormInput, FormCheckbox } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { BadgeActivo } from '@/components/ui/BadgeEstado'

const emptyForm: ComboInsert = { nombre: '', frecuencia_semanal: 1, activo: true }

export function CombosPanel() {
  const { data: combos = [], isLoading: loading } = useCombos()
  const { crear, actualizar, eliminar } = useCatalogoMutations<ComboInsert>('combos', queryKeys.combos)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Combo | null>(null)
  const [form, setForm] = useState<ComboInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Combo | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(combo: Combo) {
    setEditing(combo)
    setForm({ nombre: combo.nombre, frecuencia_semanal: combo.frecuencia_semanal, activo: combo.activo })
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

  const columns: DataTableColumn<Combo>[] = [
    { header: 'Nombre', cell: (c) => c.nombre },
    { header: 'Frecuencia semanal', cell: (c) => `${c.frecuencia_semanal} día(s)` },
    { header: 'Estado', cell: (c) => <BadgeActivo activo={c.activo} /> },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Combos de frecuencia semanal. Es lo único que define el precio.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo combo
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={combos}
        rowKey={(c) => c.id}
        cardTitle={(c) => c.nombre}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay combos cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar combo' : 'Nuevo combo'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-combo" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-combo" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              id="combo-nombre"
              label="Nombre"
              required
              placeholder="ej. 2 días, 3 días, 5 días"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            />
            <FormInput
              id="combo-frecuencia"
              label="Frecuencia semanal (días)"
              type="number"
              min={1}
              step="1"
              required
              value={form.frecuencia_semanal}
              onChange={(e) => setForm({ ...form, frecuencia_semanal: Number(e.target.value) })}
            />
          </div>
          <FormCheckbox
            id="combo-activo"
            label="Combo activo"
            checked={form.activo}
            onChange={(e) => setForm({ ...form, activo: e.target.checked })}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar combo"
        message={`¿Eliminar el combo "${deleting?.nombre}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
