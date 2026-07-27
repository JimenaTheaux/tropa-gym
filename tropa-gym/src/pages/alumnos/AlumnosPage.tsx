import { useState } from 'react'
import { ListadoAlumnos } from './ListadoAlumnos'
import { CumpleanosPanel } from './CumpleanosPanel'

const tabs = [
  { key: 'listado', label: 'Listado' },
  { key: 'cumpleanos', label: 'Cumpleaños' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function AlumnosPage() {
  const [active, setActive] = useState<TabKey>('listado')
  const [busqueda, setBusqueda] = useState('')

  return (
    <div>
      <h1 className="mb-6 font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Alumnos
      </h1>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant">
        <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`shrink-0 border-b-2 px-4 py-3 font-oswald text-[13px] font-semibold uppercase tracking-[0.03em] transition-colors ${
                active === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {active === 'listado' && (
          <div className="relative mb-2 w-full sm:w-64">
            <span className="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 !text-[16px] text-on-surface-variant">
              search
            </span>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre o apellido…"
              aria-label="Buscar alumno por nombre o apellido"
              className="w-full rounded-lg border border-outline-variant bg-surface-container-low py-2 pl-8 pr-3 font-inter text-sm text-on-surface outline-none focus:border-primary"
            />
          </div>
        )}
      </div>

      {active === 'listado' && <ListadoAlumnos busqueda={busqueda} />}
      {active === 'cumpleanos' && <CumpleanosPanel />}
    </div>
  )
}
