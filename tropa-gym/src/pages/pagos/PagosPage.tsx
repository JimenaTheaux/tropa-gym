import { useState } from 'react'
import { IndividualPanel } from './IndividualPanel'
import { FamiliarPanel } from './FamiliarPanel'
import { AdelantadoPanel } from './AdelantadoPanel'
import { HistorialPagos } from './HistorialPagos'

const tabs = [
  { key: 'individual', label: 'Individual' },
  { key: 'familiar', label: 'Familiar' },
  { key: 'adelantado', label: 'Adelantado' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function PagosPage() {
  const [active, setActive] = useState<TabKey>('individual')

  return (
    <div>
      <h1 className="mb-6 font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">Pagos</h1>

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

      {active === 'individual' && <IndividualPanel />}
      {active === 'familiar' && <FamiliarPanel />}
      {active === 'adelantado' && <AdelantadoPanel />}

      <HistorialPagos />
    </div>
  )
}
