import { db } from '@/lib/db/indexedDB'
import { STORES } from '@/lib/db/schema'
import { createClient } from '@/lib/supabase/client'

let autoCloseTimer: NodeJS.Timeout | null = null;

export async function scheduleAutoClose() {
    if (autoCloseTimer) clearTimeout(autoCloseTimer);

    let businessForm = { start_of_day_time: '16:00', end_of_day_time: '04:00' };
    try {
        const cachedBusiness = await db.get(STORES.SETTINGS, 'business_settings') as any;
        if (cachedBusiness && cachedBusiness.value) {
            businessForm = cachedBusiness.value;
        } else if (typeof localStorage !== 'undefined') {
            const savedBusiness = localStorage.getItem('business_settings');
            if (savedBusiness) {
                businessForm = JSON.parse(savedBusiness);
            }
        }
    } catch (e) {
        console.warn("Could not read business settings for auto-close scheduling.");
    }

    const closingTime = businessForm.end_of_day_time;
    if (!closingTime) return;

    const now = new Date();
    const [hours, minutes] = closingTime.split(':').map(Number);

    const closeAt = new Date();
    closeAt.setHours(hours, minutes, 0, 0);

    if (closeAt <= now) {
        closeAt.setDate(closeAt.getDate() + 1);
    }

    const msUntilClose = closeAt.getTime() - now.getTime();

    // Since setTimeout has a maximum delay of ~24.8 days (2^31-1 ms), which is more than enough for a daily timer.
    autoCloseTimer = setTimeout(async () => {
        await runAutoClose();
        scheduleAutoClose(); // Reschedule for next day
    }, msUntilClose);
    
    console.log(`🕒 Auto-close scheduled in ${Math.round(msUntilClose / 60000)} minutes (at ${closeAt.toLocaleString()})`);
}

export async function runAutoClose() {
    console.log("🚀 Running auto-close...");
    
    try {
        // Get all active orders from IndexedDB
        const allOrders = await db.getAll(STORES.ORDERS) as any[];
        const activeOrders = allOrders.filter(o => 
            ['pending', 'preparing', 'ready'].includes(o.status)
        );
        
        const closedAt = new Date().toISOString();
        const supabase = createClient();
        
        for (const order of activeOrders) {
            const updateRecord = {
                status: 'completed',
                payment_method: order.payment_method || 'cash',
                moved_to_history_automatically: true
            };
            
            // Update local order status instead of deleting it
            const orderObj = await db.get(STORES.ORDERS, order.id) as any;
            if (orderObj) {
                await db.put(STORES.ORDERS, {
                    ...orderObj,
                    ...updateRecord,
                    synced: navigator.onLine ? orderObj.synced : false
                });
            }
            
            // We no longer delete order items so they are preserved for history view
            
            // If it was a table order, clear the table locally and online
            if (order.table_id) {
                try {
                    // update local table status
                    const tablesCache = await db.get(STORES.SETTINGS, 'restaurant_tables') as any;
                    if (tablesCache && tablesCache.value) {
                        const updatedTables = tablesCache.value.map((t: any) => {
                            if (t.id === order.table_id) {
                                return { ...t, status: 'available', current_order_id: null, waiter_id: null };
                            }
                            return t;
                        });
                        await db.put(STORES.SETTINGS, { key: 'restaurant_tables', value: updatedTables });
                    }

                    if (navigator.onLine) {
                        await supabase.from('restaurant_tables').update({
                            status: 'available', current_order_id: null, waiter_id: null
                        }).eq('id', order.table_id);
                    } else {
                        // queue the table update if offline
                        const { addToQueue } = await import('@/lib/db/syncQueue');
                        await addToQueue('update', 'restaurant_tables', {
                            id: order.table_id, status: 'available', current_order_id: null, waiter_id: null
                        });
                    }
                } catch (e) {
                    console.error("Failed to clear table on auto-close:", e);
                }
            }
            
            // Push to Supabase orders table directly
            if (navigator.onLine) {
                try {
                    if (order.id.startsWith('offline_')) {
                        // Needs to be upserted if it was created offline and not synced yet
                        await supabase.from('orders').upsert({
                            ...order,
                            ...updateRecord,
                            synced_at: new Date().toISOString()
                        }, { onConflict: 'order_uuid', ignoreDuplicates: true });
                    } else {
                        // Just update the existing record
                        await supabase.from('orders').update(updateRecord).eq('id', order.id);
                    }
                } catch (e) {
                    console.error("Failed to update auto-closed order:", e);
                }
            } else {
                const { addToQueue } = await import('@/lib/db/syncQueue');
                if (order.id.startsWith('offline_')) {
                    // Queue for creation later
                    await addToQueue('create', 'orders', { ...order, ...updateRecord });
                } else {
                    // Queue for update later
                    await addToQueue('update', 'orders', { id: order.id, ...updateRecord });
                }
            }
        }
        
        await resetPOSForNewDay();
    } catch (err) {
        console.error("Failed during auto close execution:", err);
    }
}

export async function resetPOSForNewDay() {
    try {
        const cachedSettings = await db.get(STORES.SETTINGS, 'pos_reset_state') as any;
        let settings = cachedSettings ? cachedSettings.value : {};
        
        settings = {
            ...settings,
            lastResetDate: new Date().toDateString()
        };
        
        await db.put(STORES.SETTINGS, { key: 'pos_reset_state', value: settings });
        console.log("✅ POS reset for new day.");
    } catch (e) {
        console.error("Error resetting POS for new day:", e);
    }
}
