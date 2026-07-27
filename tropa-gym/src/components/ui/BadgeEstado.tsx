import type { EstadoAlumno, EstadoPago } from '@/types/db'

// Colores de estado — doc 08: solo borde + icono + texto, sin fondo sólido.
const ESTADO_CONFIG: Record<EstadoAlumno, { color: string; icon: string; label: string }> = {
  activo: { color: '#40e432', icon: 'check_circle', label: 'Activo' },
  inactivo: { color: '#ffb4ab', icon: 'cancel', label: 'Inactivo' },
}

export function BadgeEstado({ estado }: { estado: EstadoAlumno }) {
  const cfg = ESTADO_CONFIG[estado]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-inter text-xs font-medium"
      style={{ borderColor: cfg.color, color: cfg.color }}
    >
      <span className="material-symbols-outlined !text-[14px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// Estado del cargo (doc 03/08) — pagado usa el color de acento (primary);
// pendiente y parcial quedan neutros a propósito (outline-variant, sin color
// de acento) y se distinguen por ícono/texto, no por color.
const ESTADO_CARGO_CONFIG: Record<EstadoPago, { color: string; icon: string; label: string }> = {
  pagado: { color: '#40e432', icon: 'check_circle', label: 'Pagado' },
  parcial: { color: '#3d4b37', icon: 'donut_small', label: 'Parcial' },
  pendiente: { color: '#3d4b37', icon: 'schedule', label: 'Pendiente' },
}

export function BadgeEstadoCargo({ estado }: { estado: EstadoPago }) {
  const cfg = ESTADO_CARGO_CONFIG[estado]
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-inter text-xs font-medium text-on-surface-variant"
      style={{ borderColor: cfg.color, color: estado === 'pagado' ? cfg.color : undefined }}
    >
      <span className="material-symbols-outlined !text-[14px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}

// Pill genérico activo/inactivo — para entidades de Configuración (turnos, disciplinas, combos).
const ACTIVO_CONFIG = {
  true: { color: '#40e432', icon: 'check_circle', label: 'Activo' },
  false: { color: '#ffb4ab', icon: 'cancel', label: 'Inactivo' },
} as const

export function BadgeActivo({ activo }: { activo: boolean }) {
  const cfg = ACTIVO_CONFIG[activo ? 'true' : 'false']
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-inter text-xs font-medium"
      style={{ borderColor: cfg.color, color: cfg.color }}
    >
      <span className="material-symbols-outlined !text-[14px]">{cfg.icon}</span>
      {cfg.label}
    </span>
  )
}
