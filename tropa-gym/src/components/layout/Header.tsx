import { NavLink } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { navItems } from '@/config/nav'

export function Header() {
  const { perfil, signOut } = useAuth()
  const items = navItems.filter((item) => perfil && item.roles.includes(perfil.rol))

  return (
    <header className="fixed inset-x-0 top-0 z-40 flex h-20 items-center justify-between border-b border-outline-variant bg-surface/80 px-gutter backdrop-blur-md">
      <div className="flex items-center gap-8">
        {/* <a> nativo (no <Link>) a propósito: recarga completa de la app,
            no una transición de ruta — "actualizar y volver al home". */}
        <a href="/" aria-label="Ir al inicio" className="transition-opacity hover:opacity-80">
          <img src="/logo_tropa_blanco.png" alt="Tropa Gym" className="h-10 w-auto" />
        </a>

        <nav className="hidden items-center gap-6 md:flex">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] transition-colors ${
                  isActive ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <button
        type="button"
        onClick={signOut}
        className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface"
      >
        <span className="hidden font-inter text-sm sm:inline">{perfil?.nombre}</span>
        <span className="material-symbols-outlined">logout</span>
      </button>
    </header>
  )
}
