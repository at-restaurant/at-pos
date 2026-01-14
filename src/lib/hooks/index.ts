// src/lib/hooks/index.ts - CLEANED UP EXPORTS

// ✅ Core Hooks (Reusable)
export { useReusableData } from './useReusableData'

// ✅ Business Logic Hooks
export { useOrderManagement } from './useOrderManagement'
export { useTableOperations } from './useTableOperations'
export { useInventoryTracking } from './useInventoryTracking'

// ✅ Admin-Only Hooks (Online Only)
export { useSupabase } from './useSupabase' // Keep for admin backward compatibility
export { useInventoryItems, useInventorySync } from './useInventoryItems'

// ✅ Form & UI Hooks
export { useFormManager } from './useFormManager'
export { useHydration } from './useHydration'
export { useAdminAuth } from './useAdminAuth'
export { useOfflineStatus } from './useOfflineStatus'
export { useNetworkStatus } from './useNetworkStatus'
export { useStorageMonitor } from './useStorageMonitor'

// ✅ Store Hooks
export { useCart } from '@/lib/store/cart-store'
export { useTheme } from '@/lib/store/theme-store'

// ✅ UI Component Hooks
export { useToast } from '@/components/ui/Toast'

// ❌ REMOVED (Replaced by useReusableData):
// export { useOfflineFirst } from './useOfflineFirst'
// export { useDataLoader } from './useDataLoader'
// export { useRealtimeSync } from './useRealtimeSync'