// src/lib/store/theme-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * Design Token System
 */
export const designTokens = {
    light: {
        bg: {
            primary: '#ffffff',
            secondary: '#f8f9fa',
            tertiary: '#f1f3f5',
            hover: '#e9ecef',
            active: '#dee2e6'
        },
        fg: {
            primary: '#0a0a0a',
            secondary: '#495057',
            tertiary: '#6c757d',
            muted: '#adb5bd'
        },
        border: {
            default: '#e5e7eb',
            hover: '#d1d5db',
            focus: '#3b82f6'
        },
        brand: {
            primary: '#3b82f6',
            primaryHover: '#2563eb',
            secondary: '#8b5cf6',
            accent: '#f59e0b'
        },
        status: {
            success: '#10b981',
            successBg: '#d1fae5',
            warning: '#f59e0b',
            warningBg: '#fef3c7',
            error: '#ef4444',
            errorBg: '#fee2e2',
            info: '#3b82f6',
            infoBg: '#dbeafe'
        }
    },
    dark: {
        bg: {
            primary: '#0a0a0a',
            secondary: '#141414',
            tertiary: '#1a1a1a',
            hover: '#252525',
            active: '#2a2a2a'
        },
        fg: {
            primary: '#ffffff',
            secondary: '#e5e7eb',
            tertiary: '#9ca3af',
            muted: '#6b7280'
        },
        border: {
            default: '#1f1f1f',
            hover: '#2a2a2a',
            focus: '#3b82f6'
        },
        brand: {
            primary: '#3b82f6',
            primaryHover: '#60a5fa',
            secondary: '#8b5cf6',
            accent: '#f59e0b'
        },
        status: {
            success: '#10b981',
            successBg: '#064e3b',
            warning: '#f59e0b',
            warningBg: '#78350f',
            error: '#ef4444',
            errorBg: '#7f1d1d',
            info: '#3b82f6',
            infoBg: '#1e3a8a'
        }
    }
}

type Theme = 'dark' | 'light'
type DesignTokens = typeof designTokens.light

interface ThemeStore {
    theme: Theme
    toggleTheme: () => void
    setTheme: (theme: Theme) => void
    getTokens: () => DesignTokens
}

export const useTheme = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: 'light',

            toggleTheme: () => set(state => {
                const newTheme: Theme = state.theme === 'dark' ? 'light' : 'dark'

                if (typeof document !== 'undefined') {
                    document.documentElement.classList.remove('light', 'dark')
                    document.documentElement.setAttribute('data-theme', newTheme)

                    if (newTheme === 'light') {
                        document.documentElement.classList.add('light')
                    } else {
                        document.documentElement.classList.add('dark')
                    }
                }

                return { theme: newTheme }
            }),

            setTheme: (theme: Theme) => set({ theme }),

            // ✅ FIXED: Explicit return type
            getTokens: (): DesignTokens => {
                const { theme } = get()
                return designTokens[theme]
            }
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state && typeof document !== 'undefined') {
                    document.documentElement.classList.remove('light', 'dark')
                    document.documentElement.setAttribute('data-theme', state.theme)

                    if (state.theme === 'light') {
                        document.documentElement.classList.add('light')
                    } else {
                        document.documentElement.classList.add('dark')
                    }
                }
            }
        }
    )
)

/**
 * Hook to get current design tokens
 */
export const useDesignTokens = (): DesignTokens => {
    const theme = useTheme(state => state.theme)
    return designTokens[theme]
}

/**
 * Utility function to get a specific token value
 */
export const getToken = (path: string, theme: Theme = 'light'): string => {
    const tokens = designTokens[theme]
    const keys = path.split('.')
    let value: any = tokens

    for (const key of keys) {
        value = value[key]
        if (value === undefined) return ''
    }

    return value as string
}