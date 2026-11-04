import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { fetchCierresParaVerificar, fetchPagosSinCierre } from '@/lib/caja'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_CATALOGO } from '@/lib/queryClient'

// Badge del menú "Cierres de caja": cierres para verificar + pagos sin receptor.
export function useConteoCierresCaja(): number {
  const { perfil } = useAuth()
  const { data = 0 } = useQuery({
    queryKey: queryKeys.cajaConteoMenu,
    queryFn: async () => {
      const [verificar, sinCierre] = await Promise.all([fetchCierresParaVerificar(), fetchPagosSinCierre()])
      return verificar.cierres.length + sinCierre.filter((p) => p.grupo === 'sin_receptor').length
    },
    enabled: perfil?.rol === 'admin',
    staleTime: STALE_CATALOGO,
  })
  return data
}
