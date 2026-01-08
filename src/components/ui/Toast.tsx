// src/components/ui/Toast.tsx
"use client"

import { create } from 'zustand'
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react'

type Toast = {
    id: string
    type: 'success' | 'error' | 'warning'
    message: string
}

type ToastStore = {
    toasts: Toast[]
    add: (type: Toast['type'], message: string) => void
    remove: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
    toasts: [],

    add: (type, message) => {
        const id = Math.random().toString(36).substring(7)
        set((state) => ({ toasts: [...state.toasts, { id, type, message }] }))
        setTimeout(() => {
            set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }))
        }, 4000)
    },

    remove: (id) => set((state) => ({
        toasts: state.toasts.filter(t => t.id !== id)
    }))
}))

export default function ToastContainer() {
    const { toasts, remove } = useToast()

    return (
        <div className="fixed top-4 right-4 z-[9999] space-y-2 pointer-events-none">
            {toasts.map(toast => (
                <div
                    key={toast.id}
                    className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border border-[var(--border)] backdrop-blur-sm animate-in slide-in-from-top-2 duration-200"
                    style={{
                        backgroundColor: 'var(--card)',
                        minWidth: '300px',
                        maxWidth: '420px'
                    }}
                >
                    {toast.type === 'success' && (
                        <CheckCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#10b981' }} />
                    )}
                    {toast.type === 'error' && (
                        <XCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#ef4444' }} />
                    )}
                    {toast.type === 'warning' && (
                        <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                    )}

                    <p className="flex-1 text-sm font-medium" style={{ color: 'var(--fg)' }}>
                        {toast.message}
                    </p>

                    <button
                        onClick={() => remove(toast.id)}
                        className="p-1 hover:opacity-70 transition-opacity"
                        style={{ color: 'var(--muted)' }}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    )
}