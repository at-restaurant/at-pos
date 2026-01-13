// src/types/index.ts - COMPLETE TYPE SYSTEM

// ============================================
// BASE TYPES
// ============================================


export type OrderType = 'dine-in' | 'delivery' // ✅ Remove takeaway from type, use categorization instead
export type PaymentMethod = 'cash' | 'online' | 'card'
export type OrderStatus = 'pending' | 'completed' | 'cancelled'
export type TableStatus = 'available' | 'occupied' | 'reserved' | 'cleaning'


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



// ============================================
// PRINT TYPES
// ============================================


export interface ReceiptData {
    restaurantName: string
    tagline: string
    address: string
    phone?: string
    orderNumber: string
    date: string
    orderType: OrderType // ✅ FIXED: Now includes 'takeaway'
    tableNumber?: number
    waiter?: string
    customerName?: string
    customerPhone?: string
    deliveryAddress?: string
    deliveryCharges?: number
    items: Array<{
        name: string
        quantity: number
        price: number
        total: number
        category?: string
    }>
    subtotal: number
    tax: number
    discount?: number
    total: number
    paymentMethod?: PaymentMethod
    notes?: string
}

export interface PrintResponse {
    success: boolean
    message?: string
    error?: string
    orderNumber?: string
}

// ✅ Reusable Order Type
export interface BaseOrder {
    id: string
    created_at: string
    subtotal: number
    tax: number
    total_amount: number
    status: OrderStatus
    order_type: OrderType
    payment_method?: PaymentMethod
    receipt_printed: boolean
    synced?: boolean
    notes?: string
}

export interface DineInOrder extends BaseOrder {
    order_type: 'dine-in'
    table_id: string
    waiter_id: string
    customer_name?: never
    customer_phone?: never
    delivery_address?: never
    delivery_charges?: never
}

export interface DeliveryOrder extends BaseOrder {
    order_type: 'delivery'
    customer_name?: string
    customer_phone?: string
    delivery_address?: string
    delivery_charges?: number
    table_id?: never
    waiter_id?: string
}


// ✅ Order with relations
export interface OrderWithRelations extends BaseOrder {
    table_id?: string
    waiter_id?: string
    customer_name?: string
    customer_phone?: string
    delivery_address?: string
    delivery_charges?: number
    restaurant_tables?: { table_number: number }
    waiters?: { name: string }
    order_items: Array<{
        id: string
        quantity: number
        unit_price: number
        total_price: number
        menu_item_id: string
        menu_items?: {
            name: string
            price: number
            category_id?: string
        }
    }>
}

export interface PrintResponse {
    success: boolean
    message?: string
    error?: string
    orderNumber?: string
}






// ORDER PAGE


export interface ReceiptData {
    restaurantName: string
    tagline: string
    address: string
    phone?: string
    orderNumber: string
    date: string
    orderType: OrderType // ✅ FIXED: Now includes 'takeaway'
    tableNumber?: number
    waiter?: string
    customerName?: string
    customerPhone?: string
    deliveryAddress?: string
    deliveryCharges?: number
    items: Array<{
        name: string
        quantity: number
        price: number
        total: number
        category?: string
    }>
    subtotal: number
    tax: number
    discount?: number
    total: number
    paymentMethod?: PaymentMethod
    notes?: string
}

export interface PrintResponse {
    success: boolean
    message?: string
    error?: string
    orderNumber?: string
}

// ✅ Reusable Order Type
export interface BaseOrder {
    id: string
    created_at: string
    subtotal: number
    tax: number
    total_amount: number
    status: OrderStatus
    order_type: OrderType
    payment_method?: PaymentMethod
    receipt_printed: boolean
    synced?: boolean
    notes?: string
}

export interface DineInOrder extends BaseOrder {
    order_type: 'dine-in'
    table_id: string
    waiter_id: string
    customer_name?: never
    customer_phone?: never
    delivery_address?: never
    delivery_charges?: never
}

export interface DeliveryOrder extends BaseOrder {
    order_type: 'delivery'
    customer_name?: string
    customer_phone?: string
    delivery_address?: string
    delivery_charges?: number
    table_id?: never
    waiter_id?: string
}

export type Order = DineInOrder | DeliveryOrder

// ✅ Order with relations
export interface OrderWithRelations extends BaseOrder {
    table_id?: string
    waiter_id?: string
    customer_name?: string
    customer_phone?: string
    delivery_address?: string
    delivery_charges?: number
    restaurant_tables?: { table_number: number }
    waiters?: { name: string }
    order_items: Array<{
        id: string
        quantity: number
        unit_price: number
        total_price: number
        menu_item_id: string
        menu_items?: {
            name: string
            price: number
            category_id?: string
        }
    }>
}