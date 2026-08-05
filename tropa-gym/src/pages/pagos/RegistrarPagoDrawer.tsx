import { useEffect, useState } from 'react'
import { Drawer } from '@/components/ui/Drawer'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { IndividualPanel } from './IndividualPanel'
import { FamiliarPanel } from './FamiliarPanel'
import { AdelantadoPanel } from './AdelantadoPanel'

type ModoPago = 'individual' | 'familiar' | 'adelantado'

// El segmented control tiene solo 2 opciones (Familiar / Adelantado) — no hay
// un tercer botón para "Individual" porque ese es el estado default del
// drawer (doc 08: mismo patrón de segmented control, uso puntual con default
// implícito). Cambiar de modo desmonta el panel anterior y monta el nuevo,
// lo que resetea su form — no se arrastra estado entre modos.
const MODOS_ALTERNATIVOS: { value: ModoPago; label: string }[] = [
  { value: 'familiar', label: 'Pago familiar' },
  { value: 'adelantado', label: 'Pago adelantado' },
]

interface RegistrarPagoDrawerProps {
  open: boolean
  onClose: () => void
}

export function RegistrarPagoDrawer({ open, onClose }: RegistrarPagoDrawerProps) {
  const [modo, setModo] = useState<ModoPago>('individual')

  useEffect(() => {
    if (open) setModo('individual')
  }, [open])

  return (
    <Drawer open={open} title="Registrar pago" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <SegmentedControl id="registrar-pago-modo" value={modo} onChange={setModo} options={MODOS_ALTERNATIVOS} />

        {modo === 'individual' && <IndividualPanel onSuccess={onClose} onCancel={onClose} />}
        {modo === 'familiar' && <FamiliarPanel onSuccess={onClose} onCancel={onClose} />}
        {modo === 'adelantado' && <AdelantadoPanel onSuccess={onClose} onCancel={onClose} />}
      </div>
    </Drawer>
  )
}
