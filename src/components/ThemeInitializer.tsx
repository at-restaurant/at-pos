// src/components/ThemeInitializer.tsx
"use client"

import { useEffect } from 'react'
import { useTheme } from '@/lib/store/theme-store'

/**
 * ThemeInitializer - Manages theme initialization and synchronization
 *
 * Relationships:
 * - Uses theme-store for state management
 * - Applies CSS custom properties from globals.css
 * - Synchronizes with localStorage
 * - Updates DOM for theme switching
 */
export default function ThemeInitializer() {
    const { theme } = useTheme()

    useEffect(() => {
        // Remove previous theme classes
        document.documentElement.classList.remove('light', 'dark')

        // Set data attribute for CSS targeting
        document.documentElement.setAttribute('data-theme', theme)

        // Add current theme class for legacy support
        if (theme === 'light') {
            document.documentElement.classList.add('light')
        } else {
            document.documentElement.classList.add('dark')
        }

        // Dispatch custom event for theme change
        // This allows other components to react to theme changes
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }))
    }, [theme])

    // Prevent FOUC (Flash of Unstyled Content)
    useEffect(() => {
        document.documentElement.style.visibility = 'visible'
    }, [])

    return null
}