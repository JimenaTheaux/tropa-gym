import { useState } from 'react'
import { TurnosPanel } from './TurnosPanel'
import { PreciosPanel } from './PreciosPanel'
import { DescuentosPanel } from './DescuentosPanel'
import { ProfesoresPanel } from './ProfesoresPanel'
import { DisciplinasPanel } from './DisciplinasPanel'
import { CombosPanel } from './CombosPanel'

const tabs = [
  { key: 'turnos', label: 'Turnos' },
  { key: 'disciplinas', label: 'Disciplinas' },
  { key: 'combos', label: 'Combos' },
  { key: 'precios', label: 'Precios' },
  { key: 'descuentos', label: 'Descuentos / Recargos' },
  { key: 'profesores', label: 'Profesores' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function ConfiguracionPage() {
  const [active, setActive] = useState<TabKey>('turnos')

  return (
    <div>
      <h1 className="mb-6 font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Configuración
      </h1>

      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-outline-variant">
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

      {active === 'turnos' && <TurnosPanel />}
      {active === 'disciplinas' && <DisciplinasPanel />}
      {active === 'combos' && <CombosPanel />}
      {active === 'precios' && <PreciosPanel />}
      {active === 'descuentos' && <DescuentosPanel />}
      {active === 'profesores' && <ProfesoresPanel />}
    </div>
  )
}
