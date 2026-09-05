import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { traducirError } from '@/lib/errores'
import { formatFecha } from '@/lib/utils'
import type { Egreso, EgresoInsert } from '@/types/db'
import { useCatalogoMutations } from '@/hooks/useCatalogoMutations'
import { queryKeys } from '@/lib/queryKeys'
import { periodoActual, inicioDeMes, primerDiaSiguiente } from '@/lib/dashboard'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { Button } from '@/components/ui/button'
import { Drawer } from '@/components/ui/Drawer'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { FormCurrencyInput, FormDateInput, FormInput, FormMonthInput } from '@/components/ui/FormField'
import { DataTable, type DataTableColumn } from '@/components/ui/DataTable'
import { fechaLocalISO } from '@/lib/fecha'

const emptyForm: EgresoInsert = { concepto: '', monto: 0, fecha: fechaLocalISO(), categoria: '' }

async function fetchEgresos(periodo: string): Promise<Egreso[]> {
  const { data, error } = await supabase
    .from('egresos')
    .select('*')
    .gte('fecha', inicioDeMes(periodo))
    .lt('fecha', primerDiaSiguiente(periodo))
    .order('fecha', { ascending: false })
  if (error) return []
  return data as Egreso[]
}

export function Egresos() {
  const [periodo, setPeriodo] = useState(periodoActual())
  const { data: egresos = [], isLoading: loading } = useQuery({
    queryKey: queryKeys.egresos(periodo),
    queryFn: () => fetchEgresos(periodo),
    staleTime: STALE_OPERATIVO,
  })
  const { crear, actualizar, eliminar } = useCatalogoMutations<EgresoInsert>('egresos', ['egresos'])
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Egreso | null>(null)
  const [form, setForm] = useState<EgresoInsert>(emptyForm)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Egreso | null>(null)

  const saving = crear.isPending || actualizar.isPending
  const deleteLoading = eliminar.isPending

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm, fecha: fechaLocalISO() })
    setError(null)
    setDrawerOpen(true)
  }

  function openEdit(egreso: Egreso) {
    setEditing(egreso)
    setForm({
      concepto: egreso.concepto,
      monto: egreso.monto,
      fecha: egreso.fecha,
      categoria: egreso.categoria,
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

  const totalPeriodo = egresos.reduce((sum, e) => sum + Number(e.monto), 0)

  const columns: DataTableColumn<Egreso>[] = [
    { header: 'Concepto', cell: (e) => e.concepto },
    { header: 'Categoría', cell: (e) => e.categoria },
    { header: 'Fecha', cell: (e) => formatFecha(e.fecha) },
    { header: 'Monto', cell: (e) => `$${Number(e.monto).toLocaleString('es-AR')}` },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
            Egresos
          </h1>
          <p className="mt-1 font-inter text-sm text-on-surface-variant">
            Total registrado: ${totalPeriodo.toLocaleString('es-AR')}
          </p>
        </div>
        <Button type="button" variant="solido" onClick={openCreate}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Nuevo egreso
        </Button>
      </div>

      <div className="mb-4">
        <FormMonthInput id="egresos-periodo" label="Período" required value={periodo} onChange={setPeriodo} />
      </div>

      {error && !drawerOpen && <p className="mb-4 font-inter text-sm text-error">{error}</p>}

      <DataTable
        columns={columns}
        data={egresos}
        rowKey={(e) => e.id}
        cardTitle={(e) => e.concepto}
        onEdit={openEdit}
        onDelete={setDeleting}
        loading={loading}
        emptyMessage="Todavía no hay egresos cargados."
      />

      <Drawer
        open={drawerOpen}
        title={editing ? 'Editar egreso' : 'Nuevo egreso'}
        onClose={() => setDrawerOpen(false)}
        footer={
          <>
            <Button type="button" variant="ghost" onClick={() => setDrawerOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="form-egreso" variant="solido" disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          </>
        }
      >
        <form id="form-egreso" className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormInput
              id="egreso-concepto"
              label="Concepto"
              required
              value={form.concepto}
              onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            />
            <FormInput
              id="egreso-categoria"
              label="Categoría"
              required
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
            />
          </div>
          <div className="flex flex-wrap items-start gap-4">
            <FormDateInput
              id="egreso-fecha"
              label="Fecha"
              required
              value={form.fecha}
              onChange={(fecha) => setForm({ ...form, fecha })}
            />
            <FormCurrencyInput
              id="egreso-monto"
              label="Monto"
              min={0}
              step="0.01"
              required
              value={form.monto}
              onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
            />
          </div>
          {error && <p className="font-inter text-sm text-error">{error}</p>}
        </form>
      </Drawer>

      <ConfirmDialog
        open={!!deleting}
        title="Eliminar egreso"
        message={`¿Eliminar el egreso "${deleting?.concepto}"? Esta acción no se puede deshacer.`}
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  )
}
