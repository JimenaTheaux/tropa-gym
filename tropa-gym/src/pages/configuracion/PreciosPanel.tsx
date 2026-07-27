import { useState, type FormEvent } from 'react'
import { traducirError } from '@/lib/errores'
import { formatFecha } from '@/lib/utils'
import type { Precio, PrecioInsert } from '@/types/db'
import { usePrecios, useCombos } from '@/hooks/useCatalogos'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormCurrencyInput, FormDateInput, FormSelect } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'

const emptyForm: PrecioInsert = { combo_id: '', vigente_desde: '', monto: 0 }

export function PreciosPanel() {
  const { data: precios = [], isLoading: loading } = usePrecios()
  const { data: combos = [] } = useCombos()
  const { crear, actualizar, eliminar } = useCatalogoMutations<PrecioInsert>('precios', queryKeys.precios)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Precio | null>(null)
  const [form, setForm] = useState<PrecioInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Precio | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm(emptyForm)
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(precio: Precio) {
    setEditing(precio)
    setForm({
      combo_id: precio.combo_id,
      vigente_desde: precio.vigente_desde,
      monto: precio.monto,
    })
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

  function comboNombre(id: string) {
    return combos.find((c) => c.id === id)?.nombre ?? '—'
  }

  const columns: DataTableColumn<Precio>[] = [
    { header: 'Combo', cell: (p) => comboNombre(p.combo_id) },
    { header: 'Vigente desde', cell: (p) => formatFecha(p.vigente_desde) },
    { header: 'Monto', cell: (p) => `$${p.monto.toLocaleString('es-AR')}` },
  ]

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="font-inter text-sm text-on-surface-variant">
          Precios vigentes por combo. Los cambios no afectan pagos históricos.
        </p>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo precio
        </Button>
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={precios}
        rowKey={(p) => p.id}
        cardTitle={(p) => comboNombre(p.combo_id)}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay precios cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar precio' : 'Nuevo precio'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-precio" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-precio" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormSelect
              id="precio-combo"
              label="Combo"
              placeholder="Seleccionar combo"
              required
              value={form.combo_id}
              onChange={(e) => setForm({ ...form, combo_id: e.target.value })}
              options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
            />
            <FormDateInput
              id="precio-vigente-desde"
              label="Vigente desde"
              required
              value={form.vigente_desde}
              onChange={(vigente_desde) => setForm({ ...form, vigente_desde })}
            />
          </div>
          <FormCurrencyInput
            id="precio-monto"
            label="Monto"
            min={0}
            step="0.01"
            required
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
          />
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar precio"
        message={`¿Eliminar el precio de "${comboNombre(deleting?.combo_id ?? '')}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
