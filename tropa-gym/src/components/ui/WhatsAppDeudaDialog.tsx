import { useState } from 'react'
import { createPortal } from 'react-dom'
import { whatsappUrl, type Deudor } from '@/lib/dashboard'
import { armarMensajeDeuda } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FormTextarea } from '@/components/ui/FormField'
import { WhatsAppIcon } from '@/components/ui/WhatsAppIcon'

interface WhatsAppDeudaDialogProps {
  deudor: Deudor
  onClose: () => void
}

// Mensaje precargado y editable antes de abrir wa.me. Se monta al abrirse, así
// el texto arranca de cero para cada alumno.
export function WhatsAppDeudaDialog({ deudor, onClose }: WhatsAppDeudaDialogProps) {
  const [mensaje, setMensaje] = useState(() =>
    armarMensajeDeuda(deudor.nombre, deudor.detalleTotal, deudor.aFavor, deudor.netoTotal),
  )

  function enviar() {
    window.open(whatsappUrl(deudor.telefono as string, mensaje), '_blank', 'noopener,noreferrer')
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`WhatsApp a ${deudor.nombre} ${deudor.apellido}`}
        className="absolute left-1/2 top-1/2 max-h-[90dvh] w-[90%] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[20px] border border-outline-variant bg-surface-container p-6"
      >
        <h2 className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">
          WhatsApp a {deudor.nombre} {deudor.apellido}
        </h2>

        {deudor.netoTotal === 0 && (
          <p className="mt-2 font-inter text-sm text-error">
            El saldo a favor cubre toda la deuda: el total a abonar da $0. Revisá los pagos antes de enviar.
          </p>
        )}

        <div className="mt-4">
          <FormTextarea
            id="whatsapp-deuda-mensaje"
            label="Mensaje"
            rows={9}
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="solido" disabled={!mensaje.trim()} onClick={enviar}>
            <WhatsAppIcon className="h-[16px] w-[16px]" />
            Abrir WhatsApp
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
