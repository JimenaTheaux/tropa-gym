import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { Alumno } from '@/types/db'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import { STALE_OPERATIVO } from '@/lib/queryClient'
import { BadgeEstado } from '@/components/ui/BadgeEstado'
import { Button } from '@/components/ui/button'
import { NuevoAlumnoDrawer } from '@/components/ui/NuevoAlumnoDrawer'

interface AlumnoBuscadorProps {
  onSelect: (alumno: Alumno) => void
  placeholder?: string
}

async function buscarAlumnos(term: string): Promise<Alumno[]> {
  const { data, error } = await supabase
    .from('alumnos')
    .select('*')
    .or(`dni.ilike.%${term}%,nombre.ilike.%${term}%,apellido.ilike.%${term}%`)
    .order('apellido')
    .limit(10)
  if (error) return []
  return data as Alumno[]
}

export function AlumnoBuscador({ onSelect, placeholder }: AlumnoBuscadorProps) {
  const [query, setQuery] = useState('')
  const [creandoOpen, setCreandoOpen] = useState(false)
  const term = query.trim()

  const { data: resultados = [], isFetching: loading } = useQuery({
    queryKey: queryKeys.alumnosBusqueda(term),
    queryFn: () => buscarAlumnos(term),
    enabled: term.length >= 2,
    staleTime: STALE_OPERATIVO,
  })

  function seleccionar(alumno: Alumno) {
    onSelect(alumno)
    setQuery('')
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? 'Buscar por DNI, nombre o apellido…'}
        className="w-full rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2 font-inter text-sm text-on-surface outline-none focus:border-primary"
      />

      {loading && <p className="font-inter text-xs text-on-surface-variant">Buscando…</p>}

      {resultados.length > 0 && (
        <div className="flex flex-col overflow-hidden rounded-lg border border-outline-variant">
          {resultados.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => seleccionar(a)}
              className="flex items-center justify-between gap-2 border-b border-outline-variant bg-surface-container-low px-3 py-2 text-left last:border-b-0 hover:bg-surface-container-high"
            >
              <span className="font-inter text-sm text-on-surface">
                {a.nombre} {a.apellido} <span className="text-on-surface-variant">— DNI {a.dni}</span>
              </span>
              <BadgeEstado estado={a.estado} />
            </button>
          ))}
        </div>
      )}

      {!loading && query.trim().length >= 2 && resultados.length === 0 && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant bg-surface-container-low px-3 py-2">
          <p className="font-inter text-sm text-on-surface-variant">No se encontraron alumnos.</p>
          <Button type="button" variant="primario" onClick={() => setCreandoOpen(true)}>
            <span className="material-symbols-outlined !text-[16px]">person_add</span>
            Crear alumno
          </Button>
        </div>
      )}

      <NuevoAlumnoDrawer
        open={creandoOpen}
        query={query}
        onClose={() => setCreandoOpen(false)}
        onCreated={(alumno) => {
          setCreandoOpen(false)
          seleccionar(alumno)
        }}
      />
    </div>
  )
}
