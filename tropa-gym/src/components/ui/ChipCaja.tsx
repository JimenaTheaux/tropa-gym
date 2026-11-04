import type { EstadoCierre } from '@/types/db'

type Tono = 'neutro' | 'ok' | 'suave' | 'alerta'

// Colores de estado — doc 08: solo borde + ícono + texto, sin fondo sólido.
const TONOS: Record<Tono, { borde: string; texto: string }> = {
  neutro: { borde: '#3d4b37', texto: '#bbcbb2' },
  ok: { borde: '#40e432', texto: '#40e432' },
  suave: { borde: '#8fd87f', texto: '#8fd87f' },
  alerta: { borde: '#ffb4ab', texto: '#ffb4ab' },
}

export function ChipCaja({ label, tono = 'neutro', icon }: { label: string; tono?: Tono; icon?: string }) {
  const { borde, texto } = TONOS[tono]
  return (
    <span
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-1 font-inter text-xs font-medium"
      style={{ borderColor: borde, color: texto }}
    >
      {icon && <span className="material-symbols-outlined !text-[14px]">{icon}</span>}
      {label}
    </span>
  )
}

const ESTADO_CIERRE: Record<EstadoCierre, { label: string; tono: Tono; icon: string }> = {
  cerrado: { label: 'Cerrado', tono: 'neutro', icon: 'lock' },
  verificado: { label: 'Verificado', tono: 'ok', icon: 'check_circle' },
  reabierto: { label: 'Reabierto', tono: 'suave', icon: 'lock_open' },
}

export function ChipEstadoCierre({ estado }: { estado: EstadoCierre }) {
  return <ChipCaja {...ESTADO_CIERRE[estado]} />
}
