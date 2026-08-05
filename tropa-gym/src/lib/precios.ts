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

function hoyISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function precioVigenteEn(precios: Precio[], comboId: string | null, fechaLimite: string): number | null {
  if (!comboId) return null
  const candidatos = precios
    .filter((p) => p.combo_id === comboId && p.vigente_desde <= fechaLimite)
    .sort((a, b) => (a.vigente_desde < b.vigente_desde ? 1 : -1))
  return candidatos[0]?.monto ?? null
}

export function precioVigente(precios: Precio[], comboId: string | null, periodo: string): number | null {
  if (!comboId || !periodo) return null
  return precioVigenteEn(precios, comboId, finDeMes(periodo))
}

// Adelantado: períodos ya transcurridos (fin de período <= hoy) cobran el precio
// vigente a su cierre — mismo criterio que generar_cargos_periodo (migración 15).
// Períodos en curso o futuros (fin de período > hoy) cobran el precio vigente HOY:
// no existe un precio "histórico" de algo que todavía no pasó.
export function precioVigenteAdelantado(precios: Precio[], comboId: string | null, periodo: string): number | null {
  if (!comboId || !periodo) return null
  const finPeriodo = finDeMes(periodo)
  const hoy = hoyISO()
  return precioVigenteEn(precios, comboId, finPeriodo < hoy ? finPeriodo : hoy)
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
