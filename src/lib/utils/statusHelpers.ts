// src/lib/utils/statusHelpers.ts
export const getTableStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        available: '#10b981',
        occupied: '#ef4444',
        reserved: '#f59e0b',
        cleaning: '#3b82f6'
    }
    return colors[status] || '#6b7280'
}

export const getOrderStatusColor = (status: string) => {
    const colors: Record<string, { bg: string; text: string; label: string }> = {
        pending: { bg: 'bg-yellow-500/20', text: 'text-yellow-600', label: '🔄 Active' },
        completed: { bg: 'bg-green-500/20', text: 'text-green-600', label: '✅ Done' },
        cancelled: { bg: 'bg-red-500/20', text: 'text-red-600', label: '❌ Cancelled' }
    }
    return colors[status] || colors.pending
}

export const getStockStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
        critical: '#ef4444',
        low: '#f59e0b',
        medium: '#3b82f6',
        high: '#10b981'
    }
    return colors[status] || '#6b7280'
}

export const getWaiterStatusColor = (isOnDuty: boolean) => {
    return {
        dotColor: isOnDuty ? '#10b981' : '#6b7280',
        bgColor: isOnDuty ? 'bg-green-500/20' : 'bg-gray-500/20',
        textColor: isOnDuty ? 'text-green-600' : 'text-gray-600',
        label: isOnDuty ? 'On Duty' : 'Off Duty'
    }
}