import { useState } from 'react'
import { KpiPanel } from './KpiPanel'
import { ResumenMensualPanel } from './ResumenMensualPanel'

const tabs = [
  { key: 'kpi', label: 'KPI' },
  { key: 'resumen', label: 'Resumen Mensual' },
] as const

type TabKey = (typeof tabs)[number]['key']

export function DashboardPage() {
  const [active, setActive] = useState<TabKey>('kpi')

  return (
    <div>
      <h1 className="mb-6 font-oswald text-2xl font-bold uppercase tracking-[0.02em] text-on-surface">
        Dashboard
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

      {active === 'kpi' && <KpiPanel />}
      {active === 'resumen' && <ResumenMensualPanel />}
    </div>
  )
}
