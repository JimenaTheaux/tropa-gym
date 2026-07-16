import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/routes/ProtectedRoute'
import { useAuth } from '@/contexts/AuthContext'
import { navItems, getHomePath } from '@/config/nav'
import { Login } from '@/pages/Login'
import { Placeholder } from '@/pages/Placeholder'

function RoleHome() {
  const { perfil } = useAuth()
  return <Navigate to={perfil ? getHomePath(perfil.rol) : '/login'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<AppLayout />}>
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<RoleHome />} />
        </Route>

        {navItems.map((item) => (
          <Route key={item.path} element={<ProtectedRoute allowedRoles={item.roles} />}>
            <Route path={item.path} element={<Placeholder title={item.label} />} />
          </Route>
        ))}
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
