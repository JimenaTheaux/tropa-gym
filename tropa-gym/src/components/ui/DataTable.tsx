import type { ReactNode } from 'react'

export interface DataTableColumn<T> {
  header: string
  cell: (row: T) => ReactNode
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[]
  data: T[]
  rowKey: (row: T) => string
  cardTitle: (row: T) => ReactNode
  onEdit: (row: T) => void
  onDelete: (row: T) => void
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage: string
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  cardTitle,
  onEdit,
  onDelete,
  onRowClick,
  loading,
  emptyMessage,
}: DataTableProps<T>) {
  if (loading) {
    return <p className="py-10 text-center font-inter text-sm text-on-surface-variant">Cargando…</p>
  }

  if (data.length === 0) {
    return (
      <p className="py-10 text-center font-inter text-sm text-on-surface-variant">{emptyMessage}</p>
    )
  }

  return (
    <>
      {/* Desktop: tabla */}
      <div className="hidden overflow-x-auto rounded-card border border-outline-variant md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="bg-surface-container-high/50">
              {columns.map((col) => (
                <th
                  key={col.header}
                  className="px-4 py-3 font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant"
                >
                  {col.header}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-oswald text-[11px] font-medium uppercase tracking-[0.05em] text-on-surface-variant">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={`border-t border-outline-variant hover:bg-surface-container-high/50 ${onRowClick ? 'cursor-pointer' : ''}`}
              >
                {columns.map((col) => (
                  <td key={col.header} className="px-4 py-3 font-inter text-sm text-on-surface">
                    {col.cell(row)}
                  </td>
                ))}
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onEdit(row)
                      }}
                      aria-label="Editar"
                      className="text-on-surface-variant hover:text-primary"
                    >
                      <span className="material-symbols-outlined !text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(row)
                      }}
                      aria-label="Eliminar"
                      className="text-on-surface-variant hover:text-error"
                    >
                      <span className="material-symbols-outlined !text-[18px]">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <div className="flex flex-col gap-3 md:hidden">
        {data.map((row) => (
          <div
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-card border border-outline-variant bg-surface-container p-4 ${onRowClick ? 'cursor-pointer' : ''}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="font-oswald text-sm font-bold uppercase text-on-surface">
                {cardTitle(row)}
              </div>
              <div className="flex shrink-0 gap-3">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(row)
                  }}
                  aria-label="Editar"
                  className="text-on-surface-variant hover:text-primary"
                >
                  <span className="material-symbols-outlined !text-[18px]">edit</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(row)
                  }}
                  aria-label="Eliminar"
                  className="text-on-surface-variant hover:text-error"
                >
                  <span className="material-symbols-outlined !text-[18px]">delete</span>
                </button>
              </div>
            </div>
            <dl className="mt-3 flex flex-col gap-1.5">
              {columns.map((col) => (
                <div key={col.header} className="flex justify-between gap-3 text-sm">
                  <dt className="font-inter text-on-surface-variant">{col.header}</dt>
                  <dd className="font-inter text-on-surface">{col.cell(row)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}
