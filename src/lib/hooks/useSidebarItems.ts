// src/lib/hooks/useSidebarItems.ts
import { SidebarItem } from '@/components/layout/AutoSidebar'

export function useSidebarItems(
    routeConfig: any[],
    currentFilter: string,
    onFilterChange: (id: string) => void
): SidebarItem[] {
    return routeConfig.map(config => ({
        id: config.id,
        label: config.label,
        icon: config.icon,
        count: config.count,
        active: currentFilter === config.id,
        onClick: () => onFilterChange(config.id)
    }))
}