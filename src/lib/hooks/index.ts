// src/lib/hooks/index.ts - UPDATED WITH ALL EXPORTS
// ✅ Central export for all custom hooks

// Business Logic Hooks
export * from './useOrderManagement'
export * from './useTableOperations'
export * from './useInventoryTracking'

// Data Hooks
export * from './useDataLoader'

// ✅ NEW: Offline-first hook
export * from './useOfflineFirst'

// ✅ NEW: Inventory hooks (for admin)
export { useInventoryItems, useInventorySync } from './useInventoryItems'

// Realtime Hooks (excluding useInventorySync to avoid conflict)
export { useRealtimeSync, useOrdersSync, useTablesSync, useWaitersSync } from './useRealtimeSync'

// Form Hooks
export * from './useFormManager'

// UI Hooks
export * from './useHydration'
export * from './useAdminAuth'
export * from './useOfflineStatus'
export { useCart } from '@/lib/store/cart-store'

// Re-export commonly used
export { useToast } from '@/components/ui/Toast'

// ✅ Legacy compatibility (for admin pages that still use useSupabase)
export { useSupabase } from './useSupabase'