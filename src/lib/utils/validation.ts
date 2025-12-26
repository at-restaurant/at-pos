// src/lib/utils/validation.ts

// ✅ Base validation functions
export const validate = {
    // Numbers
    tableNumber: (val: string) => {
        const n = parseInt(val)
        if (!val || isNaN(n)) return 'Table number is required'
        if (n < 1 || n > 999) return 'Table number must be between 1-999'
        return null
    },

    capacity: (val: string) => {
        const n = parseInt(val)
        if (!val || isNaN(n)) return 'Capacity is required'
        if (n < 1 || n > 50) return 'Capacity must be between 1-50'
        return null
    },

    price: (val: string) => {
        const n = parseFloat(val)
        if (!val || isNaN(n)) return 'Price is required'
        if (n <= 0) return 'Price must be positive'
        if (n > 999999) return 'Price too large'
        return null
    },

    quantity: (val: string | number) => {
        const n = typeof val === 'string' ? parseFloat(val) : val
        if (isNaN(n)) return 'Quantity is required'
        if (n < 0) return 'Quantity cannot be negative'
        if (n > 999999) return 'Quantity too large'
        return null
    },

    // Strings
    name: (val: string) => {
        if (!val?.trim()) return 'Name is required'
        if (val.trim().length < 2) return 'Name must be at least 2 characters'
        if (val.length > 200) return 'Name too long (max 200 characters)'
        return null
    },

    phone: (val: string) => {
        if (!val) return 'Phone number is required'
        // Remove all non-digits
        const cleaned = val.replace(/\D/g, '')
        if (cleaned.length < 10) return 'Phone number must be at least 10 digits'
        if (cleaned.length > 15) return 'Phone number too long'
        return null
    },

    cnic: (val: string) => {
        if (!val) return null // Optional field
        const cleaned = val.replace(/\D/g, '')
        if (cleaned.length !== 13) return 'CNIC must be exactly 13 digits'
        return null
    },

    email: (val: string) => {
        if (!val) return 'Email is required'
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(val)) return 'Invalid email format'
        return null
    },

    // Specific validations
    password: (val: string) => {
        if (!val) return 'Password is required'
        if (val.length < 8) return 'Password must be at least 8 characters'
        if (val.length > 100) return 'Password too long'
        return null
    },

    description: (val: string) => {
        if (!val) return null // Optional
        if (val.length > 1000) return 'Description too long (max 1000 characters)'
        return null
    },

    notes: (val: string) => {
        if (!val) return null // Optional
        if (val.length > 500) return 'Notes too long (max 500 characters)'
        return null
    },

    url: (val: string) => {
        if (!val) return null // Optional
        try {
            new URL(val)
            return null
        } catch {
            return 'Invalid URL format'
        }
    }
}

// ✅ Compound validators
export const validators = {
    menuItem: (data: any) => ({
        name: validate.name(data.name),
        price: validate.price(data.price),
        description: validate.description(data.description),
        category_id: !data.category_id ? 'Category is required' : null
    }),

    table: (data: any) => ({
        table_number: validate.tableNumber(data.table_number),
        capacity: validate.capacity(data.capacity)
    }),

    waiter: (data: any) => ({
        name: validate.name(data.name),
        phone: validate.phone(data.phone),
        cnic: validate.cnic(data.cnic)
    }),

    inventoryItem: (data: any) => ({
        name: validate.name(data.name),
        quantity: validate.quantity(data.quantity),
        purchase_price: validate.price(data.purchase_price),
        reorder_level: validate.quantity(data.reorder_level)
    }),

    order: (data: any) => ({
        total_amount: validate.price(data.total_amount),
        subtotal: validate.price(data.subtotal),
        tax: validate.quantity(data.tax)
    })
}

// ✅ Sanitization helpers
export const sanitize = {
    string: (val: string) => val?.trim() || '',

    number: (val: string | number) => {
        const n = typeof val === 'string' ? parseFloat(val) : val
        return isNaN(n) ? 0 : n
    },

    phone: (val: string) => val.replace(/\D/g, ''),

    // Remove dangerous characters
    sql: (val: string) => val.replace(/['";\\]/g, ''),

    // Sanitize for display
    html: (val: string) => val
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
}

// ✅ Form validation helper
export function validateForm<T extends Record<string, any>>(
    data: T,
    rules: Partial<Record<keyof T, (val: any) => string | null>>
): { isValid: boolean; errors: Partial<Record<keyof T, string>> } {
    const errors: any = {}
    let isValid = true

    for (const [key, validator] of Object.entries(rules)) {
        if (validator && typeof validator === 'function') {
            const error = validator(data[key])
            if (error) {
                errors[key] = error
                isValid = false
            }
        }
    }

    return { isValid, errors }
}