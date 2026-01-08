// src/lib/hooks/useFormManager.ts
import { useState, useCallback } from 'react'

interface FormOptions<T> {
    initialValues: T
    onSubmit: (values: T) => Promise<{ success: boolean; error?: string }>
    validate?: (values: T) => Record<string, string | null>
}

export function useFormManager<T extends Record<string, any>>(options: FormOptions<T>) {
    const [values, setValues] = useState<T>(options.initialValues)
    const [errors, setErrors] = useState<Record<string, string>>({})
    const [touched, setTouched] = useState<Record<string, boolean>>({})
    const [submitting, setSubmitting] = useState(false)

    // ✅ Update field value
    const setFieldValue = useCallback((field: keyof T, value: any) => {
        setValues(prev => ({ ...prev, [field]: value }))
        // Clear error on change
        if (errors[field as string]) {
            setErrors(prev => ({ ...prev, [field as string]: '' }))
        }
    }, [errors])

    // ✅ Mark field as touched
    const setFieldTouched = useCallback((field: keyof T) => {
        setTouched(prev => ({ ...prev, [field as string]: true }))
    }, [])

    // ✅ Reset form
    const reset = useCallback(() => {
        setValues(options.initialValues)
        setErrors({})
        setTouched({})
        setSubmitting(false)
    }, [options.initialValues])

    // ✅ Validate form
    const validate = useCallback(() => {
        if (!options.validate) return true

        const validationErrors = options.validate(values)
        const hasErrors = Object.values(validationErrors).some(err => err !== null)

        if (hasErrors) {
            setErrors(validationErrors as Record<string, string>)
            return false
        }

        return true
    }, [options.validate, values])

    // ✅ Handle submit
    const handleSubmit = useCallback(async (e?: React.FormEvent) => {
        if (e) e.preventDefault()

        // Mark all fields as touched
        const allTouched = Object.keys(values).reduce((acc, key) => ({
            ...acc,
            [key]: true
        }), {})
        setTouched(allTouched)

        // Validate
        if (!validate()) return

        setSubmitting(true)

        try {
            const result = await options.onSubmit(values)

            if (result.success) {
                reset()
                return { success: true }
            } else {
                if (result.error) {
                    setErrors({ submit: result.error })
                }
                return { success: false, error: result.error }
            }
        } catch (error: any) {
            setErrors({ submit: error.message })
            return { success: false, error: error.message }
        } finally {
            setSubmitting(false)
        }
    }, [values, validate, options.onSubmit, reset])

    // ✅ Get field props (for easy binding)
    const getFieldProps = useCallback((field: keyof T) => ({
        value: values[field],
        onChange: (e: any) => {
            const value = e.target?.value ?? e
            setFieldValue(field, value)
        },
        onBlur: () => setFieldTouched(field),
        error: touched[field as string] ? errors[field as string] : undefined
    }), [values, errors, touched, setFieldValue, setFieldTouched])

    return {
        values,
        errors,
        touched,
        submitting,
        setFieldValue,
        setFieldTouched,
        getFieldProps,
        handleSubmit,
        reset,
        validate
    }
}