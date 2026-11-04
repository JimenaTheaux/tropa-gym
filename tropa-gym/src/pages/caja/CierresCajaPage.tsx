import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchCajaActiva } from '@/lib/caja'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DiaView } from './DiaView'
import { VerificarView } from './VerificarView'
import { SinCierreView } from './SinCierreView'

type Vista = 'dia' | 'verificar' | 'sin-cierre'

const VISTAS: { value: Vista; label: string }[] = [
  { value: 'dia', label: 'Día' },
  { value: 'verificar', label: 'Para verificar' },
  { value: 'sin-cierre', label: 'Sin cierre' },
]

export function CierresCajaPage() {
  const [vista, setVista] = useState<Vista>('dia')
  const { data: activa } = useQuery({
    queryKey: queryKeys.cajaActiva,
    queryFn: fetchCajaActiva,
    staleTime: STALE_OPERATIVO,
  })

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">Cierres de caja</h1>

      {activa === false && (
        <p className="rounded-lg border border-outline-variant bg-surface-container-high px-4 py-3 font-inter text-sm text-on-surface-variant">
          El cierre de caja está apagado.
        </p>
      )}

      <SegmentedControl value={vista} onChange={setVista} options={VISTAS} />

      {vista === 'dia' && <DiaView />}
      {vista === 'verificar' && <VerificarView />}
      {vista === 'sin-cierre' && <SinCierreView />}
    </div>
  )
}
