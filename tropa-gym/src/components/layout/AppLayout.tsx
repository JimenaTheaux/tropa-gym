import { Outlet } from 'react-router-dom'
import { useSyncEstadosAutomaticos } from '@/hooks/useSyncEstadosAutomaticos'
import { Header } from './Header'
import { BottomNav } from './BottomNav'
import { Footer } from './Footer'

export function AppLayout() {
  useSyncEstadosAutomaticos()

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-container-max px-gutter pb-20 pt-24 md:pb-16">
        <Outlet />
        <Footer />
      </main>
      <BottomNav />
    </div>
  )
}
