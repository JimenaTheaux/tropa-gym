import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { navItems, getHomePath } from '@/config/nav'
import { Home } from '@/pages/Home'
import { Login } from '@/pages/Login'
import { Placeholder } from '@/pages/Placeholder'
import { AlumnosPage } from '@/pages/alumnos/AlumnosPage'
import { Asistencia } from '@/pages/Asistencia'
import { CheckinAlumno } from '@/pages/asistencia/CheckinAlumno'
import { PagosPage } from '@/pages/pagos/PagosPage'

// Dashboard, Asist. Profesores, Cargos, Egresos y Configuración no son parte
// del flujo diario de todos los roles — lazy para no engordar el bundle
// inicial. Login, Alumnos, Asistencia y Pagos (el flujo principal) van eager.
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const AsistenciaProfesores = lazy(() =>
  import('@/pages/AsistenciaProfesores').then((m) => ({ default: m.AsistenciaProfesores })),
)
const Cargos = lazy(() => import('@/pages/Cargos').then((m) => ({ default: m.Cargos })))
const Egresos = lazy(() => import('@/pages/Egresos').then((m) => ({ default: m.Egresos })))
const ConfiguracionPage = lazy(() =>
  import('@/pages/configuracion/ConfiguracionPage').then((m) => ({ default: m.ConfiguracionPage })),
)

const customPages: Partial<Record<string, ComponentType>> = {
  '/dashboard': DashboardPage,
  '/alumnos': AlumnosPage,
  '/asistencia-alumnos': Asistencia,
  '/asistencia-profesores': AsistenciaProfesores,
  '/pagos': PagosPage,
  '/cargos': Cargos,
  '/egresos': Egresos,
  '/configuracion': ConfiguracionPage,
}

// Con sesión, "/" manda directo a la home del rol. Sin sesión, muestra el
// picker de 3 accesos (Alumnos/Profes/Admin) en vez de ir directo a /login —
// así la misma PWA sirve la pantalla correcta sin instalar nada distinto
// por dispositivo.
function RootRoute() {
  const { session, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-surface-variant">
        Cargando…
      </div>
    )
  }

  if (session && perfil) {
    return <Navigate to={getHomePath(perfil.rol)} replace />
  }

  return <Home />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RootRoute />} />

      {/* Pantalla de check-in de alumnos: pantalla completa, sin sidebar/topbar. */}
      <Route element={<ProtectedRoute allowedRoles={['admin', 'profesor', 'kiosco']} />}>
        <Route path="/checkin" element={<CheckinAlumno />} />
      </Route>

      <Route element={<AppLayout />}>
        {navItems.map((item) => {
          const CustomPage = customPages[item.path]
          return (
            <Route key={item.path} element={<ProtectedRoute allowedRoles={item.roles} />}>
              <Route
                path={item.path}
                element={
                  CustomPage ? (
                    <Suspense fallback={<div className="p-8">Cargando...</div>}>
                      <CustomPage />
                    </Suspense>
                  ) : (
                    <Placeholder title={item.label} />
                  )
                }
              />
            </Route>
          )
        })}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
