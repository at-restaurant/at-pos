// src/types/index.ts - COMPLETE TYPE SYSTEM

// ============================================
// BASE TYPES
// ============================================
export type Admin = {
    id: string
    email: string
    name: string
    phone?: string
    role: 'super_admin' | 'admin'
    permissions: Record<string, boolean>
    is_active: boolean
    created_at: string
}

export type Waiter = {
    id: string
    name: string
    phone?: string
    cnic?: string
    employee_type: 'waiter' | 'chef' | 'manager' | 'cashier' | 'cleaner'
    profile_pic?: string
    total_orders: number
    total_revenue: number
    avg_rating?: number
    is_active: boolean
    is_on_duty: boolean
    created_at: string
}

export type Table = {
    id: string
    table_number: number
    capacity: number
    section?: string
    status: 'available' | 'occupied' | 'reserved' | 'cleaning'
    waiter_id?: string | null
    current_order_id?: string | null
    created_at: string
}

export type MenuCategory = {
    id: string
    name: string
    icon: string
    display_order: number
    is_active: boolean
    created_at: string
}

export type MenuItem = {
    id: string
    category_id: string
    name: string
    description?: string
    price: number
    image_url?: string
    is_available: boolean
    preparation_time?: number
    created_at: string
}

export type Order = {
    id: string
    table_id?: string | null
    waiter_id?: string | null
    status: 'pending' | 'preparing' | 'completed' | 'cancelled'
    subtotal: number
    tax: number
    total_amount: number
    notes?: string
    created_at: string
    updated_at: string
}

export type OrderItem = {
    id: string
    order_id: string
    menu_item_id: string
    quantity: number
    unit_price: number
    total_price: number
    notes?: string
    status: 'pending' | 'preparing' | 'ready' | 'served'
    created_at: string
}

export type InventoryCategory = {
    id: string
    name: string
    icon: string
    display_order: number
    is_active: boolean
    created_at: string
}

export type InventoryItem = {
    id: string
    category_id?: string
    name: string
    description?: string
    image_url?: string
    quantity: number
    unit: string
    reorder_level: number
    purchase_price: number
    supplier_name?: string
    storage_location?: string
    is_active: boolean
    created_at: string
    updated_at: string
}

// ============================================
// JOINED/ENRICHED TYPES (With Relations)
// ============================================
export type TableWithRelations = Table & {
    waiter?: Pick<Waiter, 'id' | 'name' | 'profile_pic'> | null
    order?: Pick<Order, 'id' | 'total_amount' | 'status'> & {
        order_items?: Array<OrderItem & {
            menu_items: Pick<MenuItem, 'name' | 'price'>
        }>
    } | null
}

export type OrderWithRelations = Order & {
    restaurant_tables?: Pick<Table, 'id' | 'table_number'> | null
    waiters?: Pick<Waiter, 'id' | 'name' | 'profile_pic'> | null
    order_items?: Array<OrderItem & {
        menu_items: Pick<MenuItem, 'name' | 'price' | 'category_id'>
    }>
}

export type MenuItemWithCategory = MenuItem & {
    menu_categories?: Pick<MenuCategory, 'name' | 'icon'>
}

export type InventoryItemWithCategory = InventoryItem & {
    inventory_categories?: Pick<InventoryCategory, 'name' | 'icon'>
    total_value?: number
}

// ============================================
// UTILITY TYPES
// ============================================
export type StockStatus = 'critical' | 'low' | 'medium' | 'high'
export type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
    image_url?: string
}