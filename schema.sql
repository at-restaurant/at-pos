-- ============================================
-- RT RESTAURANT - PRODUCTION SCHEMA (NO RLS)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Admin Configuration
CREATE TABLE IF NOT EXISTS admin_config (
                                            id INTEGER PRIMARY KEY DEFAULT 1,
                                            password_hash TEXT NOT NULL,
                                            name TEXT DEFAULT 'Admin',
                                            bio TEXT,
                                            profile_pic TEXT,
                                            created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_admin CHECK (id = 1)
    );

-- Menu Categories
CREATE TABLE IF NOT EXISTS menu_categories (
                                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📋',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
                                          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES menu_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    preparation_time INTEGER DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Waiters
CREATE TABLE IF NOT EXISTS waiters (
                                       id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    cnic TEXT,
    employee_type TEXT DEFAULT 'waiter' CHECK (employee_type IN ('waiter', 'chef', 'manager', 'cashier', 'cleaner')),
    profile_pic TEXT,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    avg_rating DECIMAL(3,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    is_on_duty BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Restaurant Tables
CREATE TABLE IF NOT EXISTS restaurant_tables (
                                                 id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number INTEGER NOT NULL UNIQUE,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    section TEXT DEFAULT 'Main',
    status TEXT DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'reserved', 'cleaning')),
    waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL,
    current_order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Orders
CREATE TABLE IF NOT EXISTS orders (
                                      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_id UUID REFERENCES restaurant_tables(id) ON DELETE SET NULL,
    waiter_id UUID REFERENCES waiters(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'completed', 'cancelled')),
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    order_type TEXT DEFAULT 'dine-in' CHECK (order_type IN ('dine-in', 'delivery')),
    payment_method TEXT CHECK (payment_method IN ('cash', 'online')),
    notes TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    delivery_address TEXT,
    delivery_charges DECIMAL(10,2) DEFAULT 0,
    receipt_printed BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Order Items
CREATE TABLE IF NOT EXISTS order_items (
                                           id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    menu_item_id UUID REFERENCES menu_items(id) ON DELETE RESTRICT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Waiter Shifts (Attendance)
CREATE TABLE IF NOT EXISTS waiter_shifts (
                                             id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    waiter_id UUID REFERENCES waiters(id) ON DELETE CASCADE NOT NULL,
    clock_in TIMESTAMPTZ NOT NULL,
    clock_out TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Inventory Categories
CREATE TABLE IF NOT EXISTS inventory_categories (
                                                    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
                                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id UUID REFERENCES inventory_categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'kg',
    reorder_level DECIMAL(10,2) DEFAULT 10,
    purchase_price DECIMAL(10,2) DEFAULT 0,
    supplier_name TEXT,
    storage_location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
    );

-- Daily Summaries (for optimization)
CREATE TABLE IF NOT EXISTS daily_summaries (
                                               id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    date DATE NOT NULL UNIQUE,
    total_orders INTEGER DEFAULT 0,
    total_revenue DECIMAL(12,2) DEFAULT 0,
    total_tax DECIMAL(12,2) DEFAULT 0,
    net_profit DECIMAL(12,2) DEFAULT 0,
    inventory_cost DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
    );

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_waiter ON orders(waiter_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_waiter_shifts_waiter ON waiter_shifts(waiter_id);
CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Update waiter stats
CREATE OR REPLACE FUNCTION increment_waiter_stats(
    p_waiter_id UUID,
    p_orders INTEGER DEFAULT 1,
    p_revenue DECIMAL DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
UPDATE waiters
SET
    total_orders = total_orders + p_orders,
    total_revenue = total_revenue + p_revenue
WHERE id = p_waiter_id;
END;
$$ LANGUAGE plpgsql;

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- TRIGGERS
-- ============================================

CREATE TRIGGER update_orders_timestamp
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_menu_items_timestamp
    BEFORE UPDATE ON menu_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_inventory_items_timestamp
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA
-- ============================================

-- Admin user (password: admin123)
INSERT INTO admin_config (id, password_hash, name, bio)
VALUES (1, '$2a$10$rGvX4hLQjHYKJFQxKJHvT.yX5pZqN0H6tKJQZXJxKJQxKJHvT', 'Admin', 'Restaurant Manager')
    ON CONFLICT (id) DO NOTHING;

-- Sample categories
INSERT INTO menu_categories (name, icon, display_order) VALUES
                                                            ('Fast Food', '🍔', 1),
                                                            ('Main Course', '🍝', 2),
                                                            ('Beverages', '☕', 3),
                                                            ('Desserts', '🍰', 4)
    ON CONFLICT DO NOTHING;