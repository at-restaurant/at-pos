// src/components/CommandPaletteWrapper.tsx
"use client"

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import UnifiedSidebar from '@/components/layout/UnifiedSidebar'
import CommandPalette from '@/components/CommandPalette'

export default function CommandPaletteWrapper() {
    const [commandOpen, setCommandOpen] = useState(false)
    const pathname = usePathname()

    // ✅ Hide sidebar on login page
    const isLoginPage = pathname === '/admin/login'

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault()
                setCommandOpen(true)
            }
        }

        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [])

    return (
        <>
            {!isLoginPage && <UnifiedSidebar onCommandOpen={() => setCommandOpen(true)} />}
            <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
        </>
    )
}