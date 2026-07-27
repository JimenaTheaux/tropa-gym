export function Footer({ prominent = false }: { prominent?: boolean }) {
  if (prominent) {
    return (
      <footer className="mt-auto flex flex-wrap items-center justify-center gap-2 pt-2 font-inter text-xs text-on-surface-variant">
        <img
          src="/branding/decidata-logo-white.png"
          alt="deciDATA"
          className="h-4 w-auto opacity-90"
        />
        <span className="font-semibold text-on-surface">deciDATA</span>
        <span>© 2026 · Todos los derechos reservados</span>
      </footer>
    )
  }

  return (
    <footer className="static mt-8 flex flex-wrap items-center justify-center gap-2 border-t border-outline-variant bg-background py-3 font-inter text-[11px] text-on-surface-variant md:fixed md:inset-x-0 md:bottom-0 md:z-30 md:mt-0 md:h-8 md:flex-nowrap md:px-gutter md:py-0">
      <img
        src="/branding/decidata-logo-white.png"
        alt="deciDATA"
        className="h-[14px] w-auto opacity-70"
      />
      <span>deciDATA</span>
      <span>© 2026 · Todos los derechos reservados</span>
    </footer>
  )
}
