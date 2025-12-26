// src/lib/hooks/index.ts
// ✅ Central export for all custom hooks

// Business Logic Hooks
export * from './useOrderManagement'
export * from './useTableOperations'
export * from './useInventoryTracking'

// Data Hooks
export * from './useDataLoader'
export * from './useSupabase'

// Realtime Hooks
export * from './useRealtimeSync'

// Form Hooks
export * from './useFormManager'

// UI Hooks
export * from './useHydration'
export * from './useAdminAuth'
export { useCart } from '@/lib/store/cart-store'

// Re-export commonly used
export { useToast } from '@/components/ui/Toast'