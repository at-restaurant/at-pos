// src/lib/hooks/useSidebarItems.ts
import { useMemo } from 'react'

interface SidebarItemInput {
    id: string
    label: string
    icon: string
    count: number
}

export function useSidebarItems(
    items: SidebarItemInput[],
    activeFilter: string,
    setFilter: (filter: string) => void
) {
    return useMemo(() => {
        return items.map(item => ({
            ...item,
            active: activeFilter === item.id,
            onClick: () => setFilter(item.id),
        }))
    }, [items, activeFilter, setFilter])
}
