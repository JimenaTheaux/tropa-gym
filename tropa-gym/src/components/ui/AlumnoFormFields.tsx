import type { AlumnoInsert, Combo, Disciplina } from '@/types/db'
import { FormDateInput, FormInput, FormSelect } from '@/components/ui/FormField'

interface AlumnoFormFieldsProps {
  idPrefix: string
  form: AlumnoInsert
  onChange: (patch: Partial<AlumnoInsert>) => void
  disciplinas: Disciplina[]
  combos: Combo[]
}

// Campos del alumno (alta/edición), compartidos entre la página Alumnos y el
// alta rápida desde el buscador de Pagos — mismo formulario, dos puntos de entrada.
export function AlumnoFormFields({ idPrefix, form, onChange, disciplinas, combos }: AlumnoFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <FormInput
        id={`${idPrefix}-nombre`}
        label="Nombre"
        required
        value={form.nombre}
        onChange={(e) => onChange({ nombre: e.target.value })}
      />
      <FormInput
        id={`${idPrefix}-apellido`}
        label="Apellido"
        required
        value={form.apellido}
        onChange={(e) => onChange({ apellido: e.target.value })}
      />
      <FormInput
        id={`${idPrefix}-dni`}
        label="DNI"
        required
        value={form.dni}
        onChange={(e) => onChange({ dni: e.target.value })}
      />
      <FormInput
        id={`${idPrefix}-telefono`}
        label="Teléfono (opcional)"
        value={form.telefono ?? ''}
        onChange={(e) => onChange({ telefono: e.target.value })}
      />
      <div className="sm:col-span-2">
        <FormDateInput
          id={`${idPrefix}-fecha-nacimiento`}
          label="Fecha de nacimiento (opcional)"
          value={form.fecha_nacimiento ?? ''}
          onChange={(fecha_nacimiento) => onChange({ fecha_nacimiento })}
        />
      </div>
      <FormSelect
        id={`${idPrefix}-disciplina`}
        label="Disciplina (plan actual, opcional)"
        placeholder="Sin disciplina asignada"
        value={form.disciplina_id ?? ''}
        onChange={(e) => onChange({ disciplina_id: e.target.value || null })}
        options={disciplinas.map((d) => ({ value: d.id, label: d.nombre }))}
      />
      <FormSelect
        id={`${idPrefix}-combo`}
        label="Combo (plan actual, opcional)"
        placeholder="Sin combo asignado"
        value={form.combo_id ?? ''}
        onChange={(e) => onChange({ combo_id: e.target.value || null })}
        options={combos.map((c) => ({ value: c.id, label: c.nombre }))}
      />
    </div>
  )
}
