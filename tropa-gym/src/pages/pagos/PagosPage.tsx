import { useState } from 'react'
import { HistorialPagos } from './HistorialPagos'
import { RegistrarPagoDrawer } from './RegistrarPagoDrawer'
import { Button } from '@/components/ui/button'

export function PagosPage() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">Pagos</h1>
        <Button type="button" variant="solido" onClick={() => setDrawerOpen(true)}>
          <span className="material-symbols-outlined !text-[16px]">add</span>
          Registrar pago
        </Button>
      </div>

      <HistorialPagos />

      <RegistrarPagoDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  )
}
