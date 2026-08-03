import type { Combo, Disciplina, Precio, TipoAjuste, TipoCargo } from '@/types/db'
import { supabase } from '@/lib/supabase'

export async function fetchPrecios(): Promise<Precio[]> {
  const { data, error } = await supabase
    .from('precios')
    .select('*')
    .order('vigente_desde', { ascending: false })
  if (error) return []
  return data as Precio[]
}

export async function fetchDisciplinasActivas(): Promise<Disciplina[]> {
  const { data, error } = await supabase
    .from('disciplinas')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) return []
  return data as Disciplina[]
}

export async function fetchCombosActivos(): Promise<Combo[]> {
  const { data, error } = await supabase
    .from('combos')
    .select('*')
    .eq('activo', true)
    .order('nombre')
  if (error) return []
  return data as Combo[]
}

function finDeMes(periodo: string): string {
  const [anio, mes] = periodo.split('-').map(Number)
  const ultimoDia = new Date(anio, mes, 0).getDate()
  return `${periodo}-${String(ultimoDia).padStart(2, '0')}`
}

export function precioVigente(precios: Precio[], comboId: string | null, periodo: string): number | null {
  if (!comboId || !periodo) return null
  const limite = finDeMes(periodo)
  const candidatos = precios
    .filter((p) => p.combo_id === comboId && p.vigente_desde <= limite)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1))
  return candidatos[0]?.monto ?? null
}

// Aplica un descuento (resta) o recargo (suma) sobre el precio del combo,
// según `tipo` — mismo campo `descuentos.porcentaje`, signo distinto.
export function aplicarDescuento(
  monto: number,
  ajuste?: { porcentaje: number; tipo: TipoAjuste } | null,
): number {
  if (!ajuste || !ajuste.porcentaje) return monto
  const signo = ajuste.tipo === 'recargo' ? 1 : -1
  return Math.round(monto * (1 + (signo * ajuste.porcentaje) / 100) * 100) / 100
}

// Media cuota (RN-017/018) es una regla de facturación, no un descuento —
// se aplica sobre el precio base, antes de cualquier descuento comercial.
export function aplicarTipoCuota(monto: number, tipo: TipoCargo): number {
  return tipo === 'media' ? Math.round((monto / 2) * 100) / 100 : monto
}
