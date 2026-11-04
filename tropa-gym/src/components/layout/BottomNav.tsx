import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { navItems } from '@/config/nav'
import { useConteoCierresCaja } from '@/hooks/useConteoCierresCaja'

export function BottomNav() {
  const { perfil } = useAuth()
  const conteoCaja = useConteoCierresCaja()
  const items = navItems.filter((item) => perfil && item.roles.includes(perfil.rol))

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t border-outline-variant bg-surface-container-lowest/95 backdrop-blur-md md:hidden">
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-inter ${
              isActive ? 'text-primary' : 'text-on-surface-variant'
            }`
          }
        >
          <span className="relative">
            <span className="material-symbols-outlined !text-[22px]">{item.icon}</span>
            {item.path === '/cierres-caja' && conteoCaja > 0 && (
              <span className="absolute -right-3 -top-1 rounded-full border border-error bg-surface-container-lowest px-1 font-inter text-[10px] font-medium text-error">
                {conteoCaja}
              </span>
            )}
          </span>
          <span className="truncate px-1">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
