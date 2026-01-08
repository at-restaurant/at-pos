export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
    return (
    <header className="sticky top-0 z-30 bg-[var(--card)] border-b border-[var(--border)]">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-[var(--fg)] truncate">{title}</h1>
                    {subtitle && <p className="text-xs sm:text-sm text-[var(--muted)] mt-0.5 sm:mt-1 line-clamp-1">{subtitle}</p>}
                </div>
                {action && <div className="flex-shrink-0">{action}</div>}
            </div>
        </div>
    </header>
)
}