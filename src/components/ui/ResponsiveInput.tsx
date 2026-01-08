// src/components/ui/ResponsiveInput.tsx
'use client'

import { useState } from 'react'
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

interface ResponsiveInputProps {
    label?: string
    type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'textarea' | 'select'
    value: string | number
    onChange: (e: any) => void
    placeholder?: string
    error?: string
    success?: boolean
    required?: boolean
    disabled?: boolean
    hint?: string
    options?: Array<{ label: string; value: string }> // For select
    rows?: number // For textarea
    className?: string
    icon?: React.ReactNode
}

export default function ResponsiveInput({
                                            label,
                                            type = 'text',
                                            value,
                                            onChange,
                                            placeholder,
                                            error,
                                            success,
                                            required,
                                            disabled,
                                            hint,
                                            options,
                                            rows = 3,
                                            className = '',
                                            icon
                                        }: ResponsiveInputProps) {
    const [showPassword, setShowPassword] = useState(false)

    const baseClasses = `
    w-full px-3 sm:px-4 py-2 sm:py-2.5 
    bg-[var(--card)] border rounded-lg 
    text-[var(--fg)] text-sm sm:text-base
    placeholder:text-[var(--muted)]
    transition-all duration-200
    disabled:opacity-50 disabled:cursor-not-allowed
    ${error ? 'border-red-600 focus:ring-red-600' : success ? 'border-green-600 focus:ring-green-600' : 'border-[var(--border)] focus:ring-blue-600'}
    focus:outline-none focus:ring-2
    ${icon ? 'pl-10 sm:pl-11' : ''}
    ${type === 'password' ? 'pr-10 sm:pr-11' : ''}
    ${className}
  `

    return (
        <div className="space-y-1.5">
            {/* Label */}
            {label && (
                <label className="block text-sm font-medium text-[var(--fg)]">
                    {label}
                    {required && <span className="text-red-600 ml-1">*</span>}
                </label>
            )}

            {/* Input Container */}
            <div className="relative">
                {/* Icon */}
                {icon && (
                    <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                        {icon}
                    </div>
                )}

                {/* Input Field */}
                {type === 'textarea' ? (
                    <textarea
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        required={required}
                        rows={rows}
                        className={baseClasses}
                    />
                ) : type === 'select' ? (
                    <select
                        value={value}
                        onChange={onChange}
                        disabled={disabled}
                        required={required}
                        className={baseClasses}
                    >
                        <option value="">Select {label?.toLowerCase() || 'option'}</option>
                        {options?.map(opt => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                ) : (
                    <input
                        type={type === 'password' && showPassword ? 'text' : type}
                        value={value}
                        onChange={onChange}
                        placeholder={placeholder}
                        disabled={disabled}
                        required={required}
                        className={baseClasses}
                    />
                )}

                {/* Password Toggle */}
                {type === 'password' && (
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--fg)]"
                    >
                        {showPassword ? <EyeOff className="w-4 h-4 sm:w-5 sm:h-5" /> : <Eye className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>
                )}

                {/* Status Icons */}
                {(error || success) && !type.includes('password') && (
                    <div className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2">
                        {error ? (
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
                        ) : (
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                        )}
                    </div>
                )}
            </div>

            {/* Error/Hint Messages */}
            {error && (
                <p className="text-xs sm:text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    {error}
                </p>
            )}
            {hint && !error && (
                <p className="text-xs sm:text-sm text-[var(--muted)]">{hint}</p>
            )}
        </div>
    )
}

// 🎯 PRE-BUILT FORM LAYOUTS

// Two-Column Form (responsive)
export function FormGrid({ children }: { children: React.ReactNode }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            {children}
        </div>
    )
}

// Full-Width Form Section
export function FormSection({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-4">
            {title && (
                <h3 className="text-base sm:text-lg font-semibold text-[var(--fg)] border-b border-[var(--border)] pb-2">
                    {title}
                </h3>
            )}
            {children}
        </div>
    )
}