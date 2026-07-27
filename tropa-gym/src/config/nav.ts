import type { RolUsuario } from '@/types/db'

export interface NavItem {
  label: string
  path: string
  icon: string
  roles: RolUsuario[]
}

// Matriz de acceso por módulo — doc 02
export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'dashboard', roles: ['admin'] },
  { label: 'Alumnos', path: '/alumnos', icon: 'group', roles: ['admin', 'profesor'] },
  { label: 'Pagos', path: '/pagos', icon: 'payments', roles: ['admin', 'profesor'] },
  {
    label: 'Asistencia',
    path: '/asistencia-alumnos',
    icon: 'event_available',
    roles: ['admin', 'profesor'],
  },
  {
    label: 'Asist. Profesores',
    path: '/asistencia-profesores',
    icon: 'badge',
    roles: ['admin', 'profesor'],
  },
  { label: 'Cargos', path: '/cargos', icon: 'request_quote', roles: ['admin'] },
  { label: 'Egresos', path: '/egresos', icon: 'receipt_long', roles: ['admin'] },
  { label: 'Configuración', path: '/configuracion', icon: 'settings', roles: ['admin'] },
]

const homeByRole: Record<RolUsuario, string> = {
  admin: '/dashboard',
  profesor: '/asistencia-profesores',
  kiosco: '/checkin',
}

export function getHomePath(rol: RolUsuario): string {
  return homeByRole[rol]
}
