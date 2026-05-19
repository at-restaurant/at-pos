// src/components/cart/CartDrawer.tsx
// ✅ FIXED: Removed validatePaymentMethod, direct paymentMethod use

"use client";

import {
  AlertTriangle,
  Banknote,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Home,
  Minus,
  Plus,
  Truck,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { db } from "@/lib/db/indexedDB";
import { STORES } from "@/lib/db/schema";
import { addToQueue } from "@/lib/db/syncQueue";
import { useOrderManagement } from "@/lib/hooks";
import { productionPrinter } from "@/lib/print/ProductionPrinter";
import { useCart } from "@/lib/store/cart-store";
import { createClient } from "@/lib/supabase/client";
import type { CartItem, ReceiptData } from "@/types";

// ✅ EXISTING CODE (Don't change this)
const getStockStatus = (cartQty: number, stockQty?: number) => {
  const stock = stockQty ?? 999;
  if (stock === 999) return { canAdd: true, remaining: 999, warning: null };

  const remaining = stock - cartQty;
  if (remaining <= 0)
    return {
      canAdd: false,
      remaining: 0,
      warning: "⚠️ Out of stock",
    };
  if (remaining <= 3)
    return {
      canAdd: true,
      remaining,
      warning: `⚠️ Only ${remaining} left`,
    };
  return { canAdd: true, remaining, warning: null };
};

// ✅ NEW: Add this RIGHT AFTER getStockStatus
const validateStockBeforeOrder = async (
  supabase: any,
  items: CartItem[],
): Promise<{ valid: boolean; errors: string[] }> => {
  const errors: string[] = [];

  if (typeof window !== "undefined" && !navigator.onLine) {
    for (const item of items) {
      const availableStock = item.stock_quantity ?? 999;
      if (availableStock === 999) continue;
      if (item.quantity > availableStock) {
        errors.push(
          `❌ ${item.name}: Only ${availableStock} available (you have ${item.quantity} in cart)`,
        );
      }
    }
    return { valid: errors.length === 0, errors };
  }

  try {
    const itemIds = items.map((i) => i.id);
    const { data: menuItems, error } = await supabase
      .from("menu_items")
      .select("id, stock_quantity, name")
      .in("id", itemIds);

    if (error || !menuItems || !Array.isArray(menuItems)) {
      return { valid: true, errors: [] };
    }

    const stockMap = new Map(menuItems.map((m: any) => [m.id, m]));

    for (const item of items) {
      const menuItem: any = stockMap.get(item.id);
      if (!menuItem) {
        errors.push(`❌ ${item.name}: Item not found`);
        continue;
      }

      const availableStock = menuItem.stock_quantity ?? 999;
      if (availableStock === 999) continue;

      if (item.quantity > availableStock) {
        errors.push(
          `❌ ${item.name}: Only ${availableStock} available (you have ${item.quantity} in cart)`,
        );
      }
    }
  } catch (err) {
    // If validation fails, allow the order to proceed
    console.error("Stock validation error:", err);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// ✅ EXISTING CODE CONTINUES (CartDrawer component starts here)
interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tables: Array<{
    id: string;
    table_number: number;
    section: string;
    status: string;
  }>;
  waiters: Array<{ id: string; name: string; is_on_duty: boolean }>;
  categoryMap?: { [key: string]: { name: string; icon: string } };
}

export default function CartDrawer({
  isOpen,
  onClose,
  tables,
  waiters,
  categoryMap,
}: CartDrawerProps) {
  const cart = useCart();
  const { createOrder, loading } = useOrderManagement();
  const [orderType, setOrderType] = useState<"dine-in" | "delivery">("dine-in");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "online">("cash");
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState({
    customer_name: "",
    customer_phone: "",
    delivery_address: "",
    delivery_charges: 0,
  });
  const [tableWarning, setTableWarning] = useState<{
    show: boolean;
    tableNumber: number;
    existingOrderId?: string;
    currentTotal?: number;
  } | null>(null);
  const [editingQuantity, setEditingQuantity] = useState<{
    [key: string]: string;
  }>({});
  const [customTaxPercent, setCustomTaxPercent] = useState<string>("0");
  const [editingTax, setEditingTax] = useState(false);
  const [localMenuCategories, setLocalMenuCategories] = useState<{
    [key: string]: { name: string; icon: string };
  }>({});

  const menuCategories = categoryMap || localMenuCategories;
  const supabase = createClient();

  useEffect(() => {
    if (!categoryMap) {
      loadMenuCategories();
    }
    const loadReceiptSettings = async () => {
      const cached = await db.get(STORES.SETTINGS, "receipt_settings");
      let settings: any = {};
      if (cached && (cached as any).value) {
        settings = (cached as any).value;
      } else {
        const savedReceipt = localStorage.getItem("receipt_settings");
        if (savedReceipt) settings = JSON.parse(savedReceipt);
      }
      if (settings.tax_percent) {
        setCustomTaxPercent(settings.tax_percent.toString());
      }
    };
    loadReceiptSettings();
  }, [categoryMap]);

  const loadMenuCategories = async () => {
    try {
      if (typeof window !== "undefined" && !navigator.onLine) {
        const menuItems = (await db.getAll(STORES.MENU_ITEMS)) as any[];
        const categories = (await db.getAll(STORES.MENU_CATEGORIES)) as any[];
        const catMap = new Map(categories.map((c) => [c.id, c]));

        const catMapping: { [key: string]: { name: string; icon: string } } =
          {};
        menuItems.forEach((item) => {
          const cat = catMap.get(item.category_id);
          if (cat) {
            catMapping[item.id] = {
              name: cat.name,
              icon: cat.icon || "📋",
            };
          }
        });
        setLocalMenuCategories(catMapping);
        return;
      }

      const { data, error } = await supabase
        .from("menu_items")
        .select("id, menu_categories(name, icon)");

      if (error) throw error;
      if (data) {
        const catMapping: { [key: string]: { name: string; icon: string } } =
          {};
        data.forEach((item: any) => {
          if (item.menu_categories) {
            catMapping[item.id] = {
              name: item.menu_categories.name,
              icon: item.menu_categories.icon || "📋",
            };
          }
        });
        setLocalMenuCategories(catMapping);
      }
    } catch (error: any) {
      // If offline or network error, fallback to IndexedDB
      if (!navigator.onLine || error?.message?.includes("Failed to fetch")) {
        console.warn(
          "Network unavailable, falling back to offline menu categories",
        );
        try {
          const menuItems = (await db.getAll(STORES.MENU_ITEMS)) as any[];
          const categories = (await db.getAll(STORES.MENU_CATEGORIES)) as any[];
          const catMap = new Map(categories.map((c) => [c.id, c]));

          const catMapping: { [key: string]: { name: string; icon: string } } =
            {};
          menuItems.forEach((item) => {
            const cat = catMap.get(item.category_id);
            if (cat) {
              catMapping[item.id] = {
                name: cat.name,
                icon: cat.icon || "📋",
              };
            }
          });
          setLocalMenuCategories(catMapping);
        } catch (fallbackErr) {
          console.error("Offline fallback failed:", fallbackErr);
        }
      } else {
        console.error("Failed to load menu categories:", error);
      }
    }
  };

  const handleWaiterChange = async (waiterId: string) => {
    cart.setWaiter(waiterId);

    if (!waiterId) return;

    const selectedWaiter = waiters.find((w) => w.id === waiterId);

    if (selectedWaiter && !selectedWaiter.is_on_duty) {
      try {
        await supabase
          .from("waiters")
          .update({ is_on_duty: true })
          .eq("id", waiterId);

        console.log("✅ Auto-marked waiter as present");
      } catch (error) {
        console.error("Failed to mark waiter present:", error);
      }
    }
  };

  useEffect(() => {
    if (cart.tableId && orderType === "dine-in") {
      checkTableOccupancy(cart.tableId);
    }
  }, [cart.tableId, orderType]);

  const checkTableOccupancy = async (tableId: string) => {
    const selectedTable = tables.find((t) => t.id === tableId);
    if (!selectedTable) return;

    if (selectedTable.status === "occupied") {
      const isOnline = typeof window !== "undefined" && navigator.onLine;
      let existingOrder: any = null;

      if (isOnline) {
        try {
          const { data } = await supabase
            .from("orders")
            .select("id, total_amount, subtotal, tax")
            .eq("table_id", tableId)
            .eq("status", "pending")
            .maybeSingle();
          existingOrder = data;
        } catch (err) {
          console.warn("Failed to check table occupancy online, falling back to local:", err);
        }
      }

      if (!existingOrder) {
        try {
          const localOrders = await db.getAll(STORES.ORDERS) as any[];
          existingOrder = localOrders.find(
            (o) => o.table_id === tableId && o.status === "pending"
          );
        } catch (err) {
          console.error("Local database table occupancy check failed:", err);
        }
      }

      if (existingOrder) {
        setTableWarning({
          show: true,
          tableNumber: selectedTable.table_number,
          existingOrderId: existingOrder.id,
          currentTotal: existingOrder.total_amount,
        });
      } else {
        setTableWarning(null);
      }
    } else {
      setTableWarning(null);
    }
  };

  const handleQuantityChange = (itemId: string, value: string) => {
    if (value === "" || /^\d+$/.test(value)) {
      setEditingQuantity({ ...editingQuantity, [itemId]: value });
    }
  };

  const handleQuantityBlur = (itemId: string) => {
    const value = editingQuantity[itemId];
    if (value && value !== "") {
      const num = parseInt(value);
      const cartItem = cart.items.find((i) => i.id === itemId);
      const maxStock = cartItem?.stock_quantity ?? 999;

      if (num > 0 && num <= maxStock) {
        cart.updateQuantity(itemId, num);
      } else if (num > maxStock) {
        cart.updateQuantity(itemId, maxStock);
      } else if (num <= 0) {
        cart.updateQuantity(itemId, 1);
      }
    }
    const newState = { ...editingQuantity };
    delete newState[itemId];
    setEditingQuantity(newState);
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleQuantityFocus = (
    e: React.FocusEvent<HTMLInputElement>,
    itemId: string,
    currentQty: number,
  ) => {
    e.target.select();
    setEditingQuantity({ ...editingQuantity, [itemId]: currentQty.toString() });
  };

  const handleTaxChange = (value: string) => {
    if (value === "" || /^\d*\.?\d*$/.test(value)) {
      const num = parseFloat(value);
      if (value === "" || (num >= 0 && num <= 100)) {
        setCustomTaxPercent(value);
      }
    }
  };

  const handleTaxBlur = () => {
    if (customTaxPercent === "") {
      setCustomTaxPercent("0");
    }
    setEditingTax(false);
  };

  const calculateTax = () => {
    const percent = parseFloat(customTaxPercent) || 0;
    return (cart.subtotal() * percent) / 100;
  };

  const placeOrder = async () => {
    if (cart.items.length === 0) return;
    if (orderType === "dine-in" && (!cart.tableId || !cart.waiterId)) return;
    if (orderType === "delivery" && !paymentMethod) return;

    // Stock Validation
    if (typeof window !== "undefined") {
      const event = new CustomEvent("toast-add", {
        detail: { type: "info", message: "🔍 Validating stock..." },
      });
      window.dispatchEvent(event);
    }

    const stockValidation = await validateStockBeforeOrder(
      supabase,
      cart.items,
    );

    if (!stockValidation.valid) {
      if (typeof window !== "undefined") {
        stockValidation.errors.forEach((error) => {
          const event = new CustomEvent("toast-add", {
            detail: { type: "error", message: error },
          });
          window.dispatchEvent(event);
        });
      }
      return;
    }

    const subtotal = cart.subtotal();
    const tax = calculateTax();
    const deliveryFee = orderType === "delivery" ? details.delivery_charges : 0;
    const total = subtotal + tax + deliveryFee;

    // Check if adding to existing order
    if (tableWarning?.existingOrderId && orderType === "dine-in") {
      try {
        const existingOrderId = tableWarning.existingOrderId;
        const isOnline = navigator.onLine;

        const newOrderItems = cart.items.map((item) => ({
          id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          order_id: existingOrderId,
          menu_item_id: item.id,
          quantity: item.quantity,
          unit_price: item.price,
          total_price: item.price * item.quantity,
          created_at: new Date().toISOString(),
        }));

        // Optimistically try online if navigator says we are online
        let onlineSuccess = false;
        if (isOnline) {
          try {
            const { error: itemsError } = await supabase
              .from("order_items")
              .insert(newOrderItems.map(({ id, ...rest }) => rest));

            if (itemsError) throw itemsError;

            const { data: currentOrder, error: orderFetchError } =
              await supabase
                .from("orders")
                .select("subtotal, tax, total_amount")
                .eq("id", existingOrderId)
                .single();

            if (orderFetchError) throw orderFetchError;
            if (!currentOrder) throw new Error("Order not found");

            const newSubtotal = currentOrder.subtotal + subtotal;
            const newTax = currentOrder.tax + tax;
            const newTotal = currentOrder.total_amount + total;

            const { error: updateError } = await supabase
              .from("orders")
              .update({
                subtotal: newSubtotal,
                tax: newTax,
                total_amount: newTotal,
                updated_at: new Date().toISOString(),
              })
              .eq("id", existingOrderId);

            if (updateError) throw updateError;
            onlineSuccess = true;
          } catch (err: any) {
            if (
              err?.message?.includes("Failed to fetch") ||
              err?.message?.includes("NetworkError")
            ) {
              console.warn(
                "Network error during online update, falling back to offline mode",
              );
              onlineSuccess = false;
            } else {
              throw err; // Re-throw real API/DB errors
            }
          }
        }

        if (!onlineSuccess) {
          // ✅ OFFLINE: Store in IndexedDB + Queue for sync

          // Store items locally
          for (const item of newOrderItems) {
            await db.put(STORES.ORDER_ITEMS, item);
            await addToQueue("create", "order_items", item);
          }

          // Queue order update
          const existingOrder = (await db.get(
            STORES.ORDERS,
            existingOrderId,
          )) as any;

          if (existingOrder) {
            const updatedOrder = {
              ...existingOrder,
              subtotal: (existingOrder.subtotal || 0) + subtotal,
              tax: (existingOrder.tax || 0) + tax,
              total_amount: (existingOrder.total_amount || 0) + total,
              updated_at: new Date().toISOString(),
            };

            await db.put(STORES.ORDERS, updatedOrder);
            await addToQueue("update", "orders", updatedOrder);
          }

          console.log(
            "✅ Queued items to be added to existing order when online",
          );
        }

        // ✅ Print receipt (works offline)
        const selectedTable = tables.find((t) => t.id === cart.tableId);
        const selectedWaiter = waiters.find((w) => w.id === cart.waiterId);

        const receiptData: ReceiptData = {
          restaurantName: "AT RESTAURANT",
          tagline: "Delicious Food, Memorable Moments",
          address: "Sooter Mills Rd, Lahore",
          orderNumber: existingOrderId.slice(0, 8).toUpperCase() + " (ADD)",
          date: new Date().toLocaleString("en-PK"),
          orderType: "dine-in",
          tableNumber: selectedTable?.table_number,
          waiter: selectedWaiter?.name,
          items: cart.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            total: item.price * item.quantity,
            category: menuCategories[item.id]
              ? `${menuCategories[item.id].icon} ${menuCategories[item.id].name}`
              : "📋 Uncategorized",
          })),
          subtotal,
          tax,
          total,
          paymentMethod: paymentMethod,
          notes: `🆕 NEW ITEMS ADDED${isOnline ? "" : " (OFFLINE)"}`,
        };

        // ✅ Clear and close immediately for instant checkout feeling
        cart.clearCart();
        setDetails({
          customer_name: "",
          customer_phone: "",
          delivery_address: "",
          delivery_charges: 0,
        });
        setTableWarning(null);
        setEditingQuantity({});
        setCustomTaxPercent("0");
        setEditingTax(false);
        onClose();

        // ✅ Print receipt in background (non-blocking)
        productionPrinter.print(receiptData).catch((err: any) => {
          console.error("Background receipt printing failed:", err);
        });

        // ✅ Trigger refresh
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("order-placed"));
        }

        // ✅ Success message
        if (typeof window !== "undefined") {
          const event = new CustomEvent("toast-add", {
            detail: {
              type: "success",
              message: `✅ Added ${cart.items.length} items to Table ${tableWarning.tableNumber}${isOnline ? "" : " (Offline - will sync)"}!`,
            },
          });
          window.dispatchEvent(event);
        }

        return;
      } catch (error: any) {
        console.error("Failed to add items to existing order:", error);
        if (typeof window !== "undefined") {
          const event = new CustomEvent("toast-add", {
            detail: {
              type: "error",
              message: `❌ Failed to add items: ${error.message}`,
            },
          });
          window.dispatchEvent(event);
        }

        return;
      }
    }

    // Create NEW order
    let finalOrderType: "dine-in" | "delivery" | "takeaway";
    if (orderType === "dine-in") {
      finalOrderType = "dine-in";
    } else {
      const hasCustomerDetails = !!(
        details.customer_name?.trim() ||
        details.customer_phone?.trim() ||
        details.delivery_address?.trim()
      );
      finalOrderType = hasCustomerDetails ? "delivery" : "takeaway";
    }

    const orderData: any = {
      waiter_id: cart.waiterId || null,
      status: finalOrderType === "dine-in" ? "pending" : "completed",
      subtotal,
      tax,
      total_amount: total,
      notes: cart.notes || null,
      order_type: finalOrderType,
      payment_method: finalOrderType !== "dine-in" ? paymentMethod : null,
      receipt_printed: true,
    };

    if (finalOrderType === "dine-in") {
      orderData.table_id = cart.tableId || null;
    } else {
      orderData.customer_name = details.customer_name || null;
      orderData.customer_phone = details.customer_phone || null;
      orderData.delivery_address = details.delivery_address || null;
      orderData.delivery_charges = details.delivery_charges || 0;
    }

    const result = await createOrder(orderData, cart.items);

    if (result.success && result.order) {
      const mergedItems: any[] = [];
      const itemMap = new Map<string, any>();

      cart.items.forEach((item) => {
        const key = item.id;
        if (!itemMap.has(key)) {
          itemMap.set(key, { ...item, total: item.price * item.quantity });
        } else {
          const existing = itemMap.get(key);
          existing.quantity += item.quantity;
          existing.total += item.price * item.quantity;
        }
      });

      mergedItems.push(...itemMap.values());

      const cachedSettings = await db.get(STORES.SETTINGS, "receipt_settings");
      let receiptSettings: any = {};
      if (cachedSettings && (cachedSettings as any).value) {
        receiptSettings = (cachedSettings as any).value;
      } else {
        const savedReceiptStr = localStorage.getItem("receipt_settings");
        receiptSettings = savedReceiptStr ? JSON.parse(savedReceiptStr) : {};
      }

      const receiptData: ReceiptData = {
        restaurantName: "AT RESTAURANT",
        tagline: "Delicious Food, Memorable Moments",
        address: "Sooter Mills Rd, Lahore",
        phone: receiptSettings.phone,
        orderNumber: (result.order?.id || "OFFLINE").slice(0, 8).toUpperCase(),
        date: result.order?.created_at
          ? new Date(result.order.created_at).toLocaleString("en-PK")
          : new Date().toLocaleString("en-PK"),
        orderType: finalOrderType,
        customerName:
          finalOrderType !== "dine-in" ? details.customer_name : undefined,
        customerPhone:
          finalOrderType !== "dine-in" ? details.customer_phone : undefined,
        deliveryAddress:
          finalOrderType === "delivery" ? details.delivery_address : undefined,
        deliveryCharges:
          finalOrderType === "delivery" ? details.delivery_charges : undefined,
        tableNumber:
          finalOrderType === "dine-in"
            ? tables.find((t) => t.id === cart.tableId)?.table_number
            : undefined,
        waiter: waiters.find((w) => w.id === cart.waiterId)?.name,
        items: mergedItems.map((i) => ({
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          total: i.total,
          category: menuCategories[i.id]
            ? `${menuCategories[i.id].icon} ${menuCategories[i.id].name}`
            : "📋 Uncategorized",
        })),
        subtotal: mergedItems.reduce((sum, i) => sum + i.total, 0),
        tax,
        total,
        paymentMethod: finalOrderType !== "dine-in" ? paymentMethod : undefined,
        notes: cart.notes,
      };

      // ✅ Clear and close immediately for instant checkout feeling
      cart.clearCart();
      setDetails({
        customer_name: "",
        customer_phone: "",
        delivery_address: "",
        delivery_charges: 0,
      });
      setTableWarning(null);
      setEditingQuantity({});
      setCustomTaxPercent("0");
      setEditingTax(false);
      onClose();

      // ✅ Print receipt in background (non-blocking)
      productionPrinter.print(receiptData).catch((err: any) => {
        console.error("Background receipt printing failed:", err);
      });

      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("order-placed"));
      }
    }
  };

  // ✅ ADD THIS RIGHT AFTER placeOrder function (BEFORE "if (!isOpen)"):
  const groupedItems = cart.items.reduce(
    (acc: { [key: string]: typeof cart.items }, item) => {
      const category = menuCategories[item.id];
      const categoryKey = category
        ? `${category.icon} ${category.name}`
        : "📋 Uncategorized";
      if (!acc[categoryKey]) {
        acc[categoryKey] = [];
      }
      acc[categoryKey].push(item);
      return acc;
    },
    {},
  );

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full sm:max-w-md bg-[var(--card)] border-l border-[var(--border)] z-50 flex flex-col shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[var(--border)] bg-[var(--card)]">
          <div>
            <h2 className="text-xl font-bold text-[var(--fg)]">Your Order</h2>
            <p className="text-xs text-[var(--muted)] mt-1">
              {cart.items.length} items • {Object.keys(groupedItems).length}{" "}
              categories
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--bg)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[var(--muted)]" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--card)]">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setOrderType("dine-in");
                setShowDetails(false);
              }}
              className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${orderType === "dine-in" ? "border-blue-600 bg-blue-600/20" : "border-[var(--border)] bg-[var(--bg)]"}`}
            >
              <Home
                className={`w-6 h-6 ${orderType === "dine-in" ? "text-blue-600" : "text-[var(--fg)]"}`}
              />
              <span
                className={`text-sm font-medium ${orderType === "dine-in" ? "text-blue-600" : "text-[var(--fg)]"}`}
              >
                Dine-In
              </span>
            </button>
            <button
              onClick={() => setOrderType("delivery")}
              className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${orderType === "delivery" ? "border-blue-600 bg-blue-600/20" : "border-[var(--border)] bg-[var(--bg)]"}`}
            >
              <Truck
                className={`w-6 h-6 ${orderType === "delivery" ? "text-blue-600" : "text-[var(--fg)]"}`}
              />
              <span
                className={`text-sm font-medium ${orderType === "delivery" ? "text-blue-600" : "text-[var(--fg)]"}`}
              >
                Delivery
              </span>
            </button>
          </div>

          {orderType === "delivery" && (
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--fg)]">
                Payment Method <span className="text-red-600">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === "cash" ? "border-green-600 bg-green-600/20" : "border-[var(--border)] bg-[var(--bg)]"}`}
                >
                  <Banknote
                    className={`w-6 h-6 ${paymentMethod === "cash" ? "text-green-600" : "text-[var(--fg)]"}`}
                  />
                  <span
                    className={`text-sm font-medium ${paymentMethod === "cash" ? "text-green-600" : "text-[var(--fg)]"}`}
                  >
                    Cash
                  </span>
                </button>
                <button
                  onClick={() => setPaymentMethod("online")}
                  className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${paymentMethod === "online" ? "border-green-600 bg-green-600/20" : "border-[var(--border)] bg-[var(--bg)]"}`}
                >
                  <CreditCard
                    className={`w-6 h-6 ${paymentMethod === "online" ? "text-green-600" : "text-[var(--fg)]"}`}
                  />
                  <span
                    className={`text-sm font-medium ${paymentMethod === "online" ? "text-green-600" : "text-[var(--fg)]"}`}
                  >
                    Online
                  </span>
                </button>
              </div>
            </div>
          )}

          {orderType === "dine-in" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                  Select Table <span className="text-red-600">*</span>
                </label>
                <select
                  value={cart.tableId}
                  onChange={(e) => cart.setTable(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Select table</option>
                  {tables
                    .filter(
                      (t) =>
                        t.status === "available" || t.status === "occupied",
                    )
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        Table {t.table_number} - {t.section}{" "}
                        {t.status === "occupied" ? "(Has Order ⚠️)" : ""}
                      </option>
                    ))}
                </select>
              </div>

              {tableWarning?.show && (
                <div className="p-4 bg-yellow-500/10 border-2 border-yellow-600 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-bold text-[var(--fg)] mb-2">
                        ⚠️ Table {tableWarning.tableNumber} has an Active Order!
                      </h4>
                      <p className="text-sm text-[var(--muted)] mb-3">
                        Current total: PKR{" "}
                        {tableWarning.currentTotal?.toLocaleString()}
                      </p>
                      <p className="text-sm font-semibold text-yellow-600 mb-3">
                        Your {cart.items.length} items will be ADDED to this
                        table's existing order.
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        💡 A receipt for new items will be printed automatically
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-[var(--fg)] mb-2">
                  Select Waiter <span className="text-red-600">*</span>
                  <span className="text-xs text-[var(--muted)] ml-2">
                    (Auto-marks present)
                  </span>
                </label>
                <select
                  value={cart.waiterId}
                  onChange={(e) => handleWaiterChange(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  style={{ colorScheme: "dark" }}
                >
                  <option value="">Select waiter</option>
                  {waiters.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} {w.is_on_duty ? "✅" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {orderType === "delivery" && (
            <>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-blue-600 transition-colors"
              >
                <span className="text-sm font-medium text-[var(--fg)]">
                  Customer Details (Optional)
                </span>
                {showDetails ? (
                  <ChevronUp className="w-5 h-5 text-[var(--fg)]" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-[var(--fg)]" />
                )}
              </button>

              <div className="p-3 bg-blue-600/10 border border-blue-600/30 rounded-lg">
                <p className="text-xs text-blue-600 font-medium">
                  💡 <strong>Smart Detection:</strong>
                  <br />
                  {details.customer_name ||
                  details.customer_phone ||
                  details.delivery_address
                    ? "✅ Will be marked as DELIVERY (customer details provided)"
                    : "📦 Will be marked as TAKEAWAY (no customer details)"}
                </p>
              </div>

              {showDetails && (
                <div className="space-y-3 p-4 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                  <input
                    type="text"
                    value={details.customer_name}
                    onChange={(e) =>
                      setDetails({ ...details, customer_name: e.target.value })
                    }
                    placeholder="Customer name"
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <input
                    type="tel"
                    value={details.customer_phone}
                    onChange={(e) =>
                      setDetails({ ...details, customer_phone: e.target.value })
                    }
                    placeholder="Phone number"
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                  <textarea
                    value={details.delivery_address}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        delivery_address: e.target.value,
                      })
                    }
                    placeholder="Delivery address"
                    rows={2}
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none resize-none"
                  />
                  <input
                    type="number"
                    value={details.delivery_charges || ""}
                    onChange={(e) =>
                      setDetails({
                        ...details,
                        delivery_charges: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="Delivery charges (PKR)"
                    className="w-full px-3 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-sm text-[var(--fg)] placeholder:text-[var(--muted)] focus:ring-2 focus:ring-blue-600 focus:outline-none"
                  />
                </div>
              )}
            </>
          )}

          {cart.items.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[var(--fg)] px-1">
                Order Items by Category
              </h3>
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2 px-2 py-1 bg-[var(--bg)] rounded-lg border border-[var(--border)]">
                    <span className="text-sm font-bold text-[var(--fg)]">
                      {category}
                    </span>
                    <span className="ml-auto text-xs text-[var(--muted)] bg-blue-600/10 px-2 py-0.5 rounded-full">
                      {items.length} item{items.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:border-blue-400 transition-colors ml-2"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1 min-w-0 pr-2">
                          <h4 className="font-semibold text-sm text-[var(--fg)] truncate">
                            {item.name}
                          </h4>
                          <p className="text-xs text-[var(--muted)] mt-0.5">
                            PKR {item.price} each
                          </p>
                        </div>
                        <span className="font-bold text-blue-600 text-sm whitespace-nowrap">
                          PKR {(item.price * item.quantity).toLocaleString()}
                        </span>
                      </div>
                      {(() => {
                        const stockStatus = getStockStatus(
                          item.quantity,
                          item.stock_quantity,
                        );
                        return (
                          <>
                            {stockStatus.warning && (
                              <div className="mb-2 px-2 py-1 bg-orange-500/10 border border-orange-500/30 rounded text-xs text-orange-600 font-medium">
                                {stockStatus.warning}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() =>
                                  cart.updateQuantity(
                                    item.id,
                                    item.quantity - 1,
                                  )
                                }
                                disabled={item.quantity <= 1}
                                className="p-1.5 bg-red-600 text-white border-2 border-red-600 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:border-[var(--border)]"
                              >
                                <Minus className="w-4 h-4" />
                              </button>
                              <div className="relative flex-shrink-0">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={
                                    editingQuantity[item.id] !== undefined
                                      ? editingQuantity[item.id]
                                      : item.quantity
                                  }
                                  onChange={(e) =>
                                    handleQuantityChange(
                                      item.id,
                                      e.target.value,
                                    )
                                  }
                                  onFocus={(e) =>
                                    handleQuantityFocus(
                                      e,
                                      item.id,
                                      item.quantity,
                                    )
                                  }
                                  onBlur={() => handleQuantityBlur(item.id)}
                                  onKeyDown={(e) =>
                                    handleQuantityKeyDown(e, item.id)
                                  }
                                  placeholder="Qty"
                                  className="w-20 px-3 py-2 text-center font-bold text-sm text-[var(--fg)] bg-[var(--card)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all cursor-text"
                                  maxLength={3}
                                />
                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] pointer-events-none text-[var(--muted)]">
                                  ✏️
                                </span>
                              </div>
                              <button
                                onClick={() =>
                                  cart.updateQuantity(
                                    item.id,
                                    item.quantity + 1,
                                  )
                                }
                                disabled={
                                  !stockStatus.canAdd ||
                                  item.quantity >= (item.stock_quantity ?? 999)
                                }
                                className="p-1.5 bg-green-600 text-white border-2 border-green-600 rounded-lg transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed disabled:bg-[var(--bg)] disabled:text-[var(--muted)] disabled:border-[var(--border)]"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => cart.removeItem(item.id)}
                                className="ml-auto px-3 py-1.5 text-xs bg-red-600 text-white font-medium border border-red-600 rounded-lg transition-all active:scale-95"
                              >
                                Remove
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {cart.items.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="text-6xl mb-4">🛒</div>
              <p className="text-[var(--fg)] font-medium mb-1">
                Your cart is empty
              </p>
              <p className="text-[var(--muted)] text-sm">
                Add items from the menu
              </p>
            </div>
          )}
        </div>

        {cart.items.length > 0 && (
          <div className="border-t border-[var(--border)] p-4 bg-[var(--card)]">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--muted)]">Subtotal</span>
                <span className="font-medium text-[var(--fg)]">
                  PKR {cart.subtotal().toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-[var(--muted)]">Tax</span>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={customTaxPercent}
                      onChange={(e) => handleTaxChange(e.target.value)}
                      onFocus={(e) => {
                        e.target.select();
                        setEditingTax(true);
                      }}
                      onBlur={handleTaxBlur}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          (e.target as HTMLInputElement).blur();
                        }
                      }}
                      className="w-14 px-2 py-1 text-center text-xs font-bold text-[var(--fg)] bg-[var(--bg)] border-2 border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none transition-all cursor-text hover:border-blue-400"
                      maxLength={5}
                      title="Click to edit tax percentage (0-100%)"
                    />
                    <span className="absolute -right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--muted)] pointer-events-none">
                      %
                    </span>
                  </div>
                  <span className="font-medium text-[var(--fg)] min-w-[80px] text-right">
                    PKR {calculateTax().toFixed(2)}
                  </span>
                </div>
              </div>
              {orderType === "delivery" && details.delivery_charges > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--muted)]">Delivery</span>
                  <span className="font-medium text-[var(--fg)]">
                    PKR {details.delivery_charges}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-[var(--border)]">
                <span className="text-[var(--fg)]">Total</span>
                <span className="text-blue-600">
                  PKR{" "}
                  {(
                    cart.subtotal() +
                    calculateTax() +
                    (orderType === "delivery" ? details.delivery_charges : 0)
                  ).toFixed(2)}
                </span>
              </div>
            </div>
            <button
              onClick={placeOrder}
              disabled={
                loading ||
                (orderType === "dine-in" && (!cart.tableId || !cart.waiterId))
              }
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCircle className="w-5 h-5" />
              )}
              {loading
                ? "Placing..."
                : tableWarning?.existingOrderId
                  ? "Add to Existing Order"
                  : orderType === "delivery"
                    ? "Place Delivery Order"
                    : "Place Order"}
            </button>
            {orderType === "dine-in" && !tableWarning?.existingOrderId && (
              <p className="text-xs text-center text-[var(--muted)] mt-2">
                💡 Payment method will be selected when completing the order
              </p>
            )}
            {tableWarning?.existingOrderId && (
              <p className="text-xs text-center text-yellow-600 mt-2">
                ⚠️ Items will be added to Table {tableWarning.tableNumber}'s
                existing order
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
