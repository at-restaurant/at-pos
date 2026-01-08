// src/components/ui/UniversalModal.tsx
'use client'

import { X } from 'lucide-react'
import { ReactNode } from 'react'

interface UniversalModalProps {
    open: boolean
    onClose: () => void
    title: string
    subtitle?: string
    icon?: ReactNode
    children: ReactNode
    footer?: ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
    className?: string
}

export default function UniversalModal({
                                           open,
                                           onClose,
                                           title,
                                           subtitle,
                                           icon,
                                           children,
                                           footer,
                                           size = 'md',
                                           className = ''
                                       }: UniversalModalProps) {
    if (!open) return null

    const sizes: Record<string, string> = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        xl: 'max-w-4xl',
        full: 'max-w-full mx-4'
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                className={`bg-[var(--card)] border border-[var(--border)] rounded-xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom-4 duration-300 ${className}`}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-4 sm:p-6 border-b border-[var(--border)] sticky top-0 bg-[var(--card)] z-10">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                        {icon && (
                            <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-600/10 flex items-center justify-center">
                                {icon}
                            </div>
                        )}
                        <div className="min-w-0 flex-1">
                            <h3 className="text-lg sm:text-xl font-bold text-[var(--fg)] truncate">{title}</h3>
                            {subtitle && (
                                <p className="text-xs sm:text-sm text-[var(--muted)] mt-1 line-clamp-2">{subtitle}</p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="flex-shrink-0 p-2 hover:bg-[var(--bg)] rounded-lg transition-colors ml-4"
                        aria-label="Close modal"
                    >
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>
                </div>

                {/* Content - Responsive padding */}
                <div className="p-4 sm:p-6">{children}</div>

                {/* Footer */}
                {footer && (
                    <div className="flex flex-col sm:flex-row gap-3 p-4 sm:p-6 border-t border-[var(--border)] sticky bottom-0 bg-[var(--card)]">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}

// 🎯 PRE-BUILT MODAL TEMPLATES

interface FormModalProps {
    open: boolean
    onClose: () => void
    title: string
    onSubmit: () => void
    submitLabel?: string
    children: ReactNode
}

// Form Modal
export function FormModal({
                              open,
                              onClose,
                              title,
                              onSubmit,
                              submitLabel = 'Save',
                              children
                          }: FormModalProps) {
    return (
        <UniversalModal
            open={open}
            onClose={onClose}
            title={title}
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm transition-colors bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--border)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onSubmit}
                        className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700"
                    >
                        {submitLabel}
                    </button>
                </>
            }
        >
            {children}
        </UniversalModal>
    )
}

interface ConfirmModalProps {
    open: boolean
    onClose: () => void
    title: string
    message: string
    confirmLabel?: string
    confirmVariant?: 'danger' | 'success' | 'primary'
    onConfirm: () => void
}

// Confirmation Modal
export function ConfirmModal({
                                 open,
                                 onClose,
                                 title,
                                 message,
                                 confirmLabel = 'Confirm',
                                 confirmVariant = 'danger',
                                 onConfirm
                             }: ConfirmModalProps) {
    const variants: Record<string, string> = {
        danger: 'bg-red-600 hover:bg-red-700',
        success: 'bg-green-600 hover:bg-green-700',
        primary: 'bg-blue-600 hover:bg-blue-700'
    }

    return (
        <UniversalModal
            open={open}
            onClose={onClose}
            title={title}
            size="sm"
            footer={
                <>
                    <button
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg font-medium text-sm bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--border)]"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => {
                            onConfirm()
                            onClose()
                        }}
                        className={`flex-1 px-4 py-2.5 rounded-lg font-medium text-sm text-white ${variants[confirmVariant] || variants.primary}`}
                    >
                        {confirmLabel}
                    </button>
                </>
            }
        >
            <p className="text-[var(--muted)]">{message}</p>
        </UniversalModal>
    )
}