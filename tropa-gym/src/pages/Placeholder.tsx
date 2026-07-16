interface PlaceholderProps {
  title: string
}

export function Placeholder({ title }: PlaceholderProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
      <h1 className="font-oswald text-2xl font-bold uppercase text-on-surface">{title}</h1>
      <p className="font-inter text-sm text-on-surface-variant">Módulo en construcción.</p>
    </div>
  )
}
