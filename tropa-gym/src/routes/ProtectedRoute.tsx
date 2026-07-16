import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { getHomePath } from '@/config/nav'
import type { RolUsuario } from '@/types/db'

interface ProtectedRouteProps {
  allowedRoles?: RolUsuario[]
}

export function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { session, perfil, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-on-surface-variant">
        Cargando…
      </div>
    )
  }

  if (!session || !perfil) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(perfil.rol)) {
    return <Navigate to={getHomePath(perfil.rol)} replace />
  }

  return <Outlet />
}
