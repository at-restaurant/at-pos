// src/lib/store/theme-store.ts - FIXED TOGGLE + DARK GREY
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

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
            primary: '#1a1a1a',      // ✅ Dark grey instead of black
            secondary: '#242424',
            tertiary: '#2a2a2a',
            hover: '#303030',
            active: '#363636'
        },
        fg: {
            primary: '#ffffff',
            secondary: '#e5e7eb',
            tertiary: '#9ca3af',
            muted: '#6b7280'
        },
        border: {
            default: '#2a2a2a',
            hover: '#363636',
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

// ✅ Apply theme to DOM immediately
const applyThemeToDOM = (theme: Theme) => {
    if (typeof document === 'undefined') return

    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(theme)
    document.documentElement.setAttribute('data-theme', theme)

    // ✅ Apply CSS variables
    const tokens = designTokens[theme]

    document.documentElement.style.setProperty('--bg', tokens.bg.primary)
    document.documentElement.style.setProperty('--card', tokens.bg.secondary)
    document.documentElement.style.setProperty('--border', tokens.border.default)
    document.documentElement.style.setProperty('--fg', tokens.fg.primary)
    document.documentElement.style.setProperty('--muted', tokens.fg.muted)
}

// ✅ Get initial theme
const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light'

    try {
        const stored = localStorage.getItem('theme-storage')
        if (stored) {
            const parsed = JSON.parse(stored)
            const theme = parsed.state?.theme || 'light'
            applyThemeToDOM(theme) // ✅ Apply immediately
            return theme
        }
    } catch (error) {
        console.warn('Failed to read theme:', error)
    }

    return 'light'
}

export const useTheme = create<ThemeStore>()(
    persist(
        (set, get) => ({
            theme: getInitialTheme(),

            toggleTheme: () => {
                const currentTheme = get().theme
                const newTheme: Theme = currentTheme === 'dark' ? 'light' : 'dark'

                console.log('🎨 Toggling theme:', currentTheme, '→', newTheme) // Debug

                applyThemeToDOM(newTheme)
                set({ theme: newTheme })
            },

            setTheme: (theme: Theme) => {
                console.log('🎨 Setting theme:', theme) // Debug
                applyThemeToDOM(theme)
                set({ theme })
            },

            getTokens: (): DesignTokens => {
                const { theme } = get()
                return designTokens[theme]
            }
        }),
        {
            name: 'theme-storage',
            onRehydrateStorage: () => (state) => {
                if (state) {
                    console.log('🎨 Rehydrated theme:', state.theme) // Debug
                    applyThemeToDOM(state.theme)
                }
            }
        }
    )
)

export const useDesignTokens = (): DesignTokens => {
    const theme = useTheme(state => state.theme)
    return designTokens[theme]
}

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