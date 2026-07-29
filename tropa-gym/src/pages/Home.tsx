import { useNavigate } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

interface Tile {
  label: string
  description: string
  icon: string
}

const tiles: Tile[] = [
  { label: 'Alumnos', description: 'Registrar asistencia', icon: 'fitness_center' },
  { label: 'Profes', description: 'Ingresar al sistema', icon: 'person' },
  { label: 'Admin', description: 'Ingresar al sistema', icon: 'admin_panel_settings' },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="flex flex-1 flex-col items-center justify-center gap-10 px-gutter">
        <img src="/logo_tropa_blanco.png" alt="Tropa Gym" className="h-auto w-full max-w-[280px]" />

        <div className="grid w-full max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
          {tiles.map((tile) => (
            <button
              key={tile.label}
              type="button"
              onClick={() => navigate('/login')}
              className="flex flex-col items-center gap-3 rounded-card border border-outline-variant bg-surface-container p-8 transition-colors hover:bg-surface-container-high"
            >
              <span className="material-symbols-outlined !text-[40px] text-primary">{tile.icon}</span>
              <span className="font-oswald text-lg font-bold uppercase tracking-[0.02em] text-on-surface">
                {tile.label}
              </span>
              <span className="font-inter text-xs text-on-surface-variant">{tile.description}</span>
            </button>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  )
}
