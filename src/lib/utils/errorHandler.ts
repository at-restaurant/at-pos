// src/lib/utils/errorHandler.ts

// ✅ Error types
export enum ErrorType {
    VALIDATION = 'VALIDATION',
    NETWORK = 'NETWORK',
    DATABASE = 'DATABASE',
    AUTH = 'AUTH',
    PERMISSION = 'PERMISSION',
    NOT_FOUND = 'NOT_FOUND',
    CONFLICT = 'CONFLICT',
    UNKNOWN = 'UNKNOWN'
}

// ✅ Structured error class
export class AppError extends Error {
    public readonly type: ErrorType
    public readonly code?: string
    public readonly statusCode: number
    public readonly isOperational: boolean

    constructor(
        message: string,
        type: ErrorType = ErrorType.UNKNOWN,
        statusCode = 500,
        code?: string
    ) {
        super(message)
        this.type = type
        this.statusCode = statusCode
        this.code = code
        this.isOperational = true
        Object.setPrototypeOf(this, AppError.prototype)
    }
}

// ✅ Error parser
export function parseError(error: any): AppError {
    // Already an AppError
    if (error instanceof AppError) return error

    // Supabase errors
    if (error.code) {
        const supabaseErrors: Record<string, ErrorType> = {
            '23505': ErrorType.CONFLICT, // Unique violation
            '23503': ErrorType.VALIDATION, // Foreign key violation
            '42P01': ErrorType.DATABASE, // Table doesn't exist
            '42703': ErrorType.DATABASE, // Column doesn't exist
            'PGRST116': ErrorType.NOT_FOUND, // No rows returned
            '22P02': ErrorType.VALIDATION, // Invalid input syntax
            '23502': ErrorType.VALIDATION // Not null violation
        }

        const type = supabaseErrors[error.code] || ErrorType.DATABASE
        const message = getUserFriendlyMessage(error)

        return new AppError(message, type, getStatusCode(type), error.code)
    }

    // Network errors
    if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
        return new AppError(
            'Network error. Please check your connection.',
            ErrorType.NETWORK,
            503
        )
    }

    // Auth errors
    if (error.message?.includes('auth') || error.message?.includes('token')) {
        return new AppError(
            'Authentication error. Please log in again.',
            ErrorType.AUTH,
            401
        )
    }

    // Generic error
    return new AppError(
        error.message || 'An unexpected error occurred',
        ErrorType.UNKNOWN,
        500
    )
}

// ✅ User-friendly messages
function getUserFriendlyMessage(error: any): string {
    const messages: Record<string, string> = {
        '23505': 'This record already exists',
        '23503': 'Cannot delete: This item is being used',
        '42P01': 'Database table not found',
        '23502': 'Required field is missing',
        'PGRST116': 'Record not found'
    }

    return messages[error.code] || error.message || 'Operation failed'
}

// ✅ Status code mapping
function getStatusCode(type: ErrorType): number {
    const codes: Record<ErrorType, number> = {
        [ErrorType.VALIDATION]: 400,
        [ErrorType.AUTH]: 401,
        [ErrorType.PERMISSION]: 403,
        [ErrorType.NOT_FOUND]: 404,
        [ErrorType.CONFLICT]: 409,
        [ErrorType.DATABASE]: 500,
        [ErrorType.NETWORK]: 503,
        [ErrorType.UNKNOWN]: 500
    }

    return codes[type] || 500
}

// ✅ Error handler hook
export function useErrorHandler() {
    const handleError = (error: any, context?: string): AppError => {
        const appError = parseError(error)

        // Log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.error(`[${appError.type}] ${context || 'Error'}:`, {
                message: appError.message,
                code: appError.code,
                stack: error.stack
            })
        }

        // TODO: Send to error tracking service (Sentry, etc.)

        return appError
    }

    return { handleError }
}

// ✅ Safe async execution wrapper
export async function safeAsync<T>(
    fn: () => Promise<T>,
    context?: string
): Promise<{ data: T | null; error: AppError | null }> {
    try {
        const data = await fn()
        return { data, error: null }
    } catch (err) {
        const error = parseError(err)

        if (process.env.NODE_ENV === 'development') {
            console.error(`[${context || 'safeAsync'}]:`, error)
        }

        return { data: null, error }
    }
}

// ✅ Retry logic for network errors
export async function withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    delay = 1000
): Promise<T> {
    let lastError: any

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error
            const appError = parseError(error)

            // Only retry network errors
            if (appError.type !== ErrorType.NETWORK || attempt === maxRetries) {
                throw appError
            }

            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, delay * attempt))
        }
    }

    throw parseError(lastError)
}