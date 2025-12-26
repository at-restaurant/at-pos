import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type CartItem = {
    id: string
    name: string
    price: number
    quantity: number
    image_url?: string
}

type CartStore = {
    items: CartItem[]
    tableId: string
    waiterId: string
    notes: string

    addItem: (item: Omit<CartItem, 'quantity'>) => void
    updateQuantity: (id: string, quantity: number) => void
    removeItem: (id: string) => void
    setTable: (id: string) => void
    setWaiter: (id: string) => void
    setNotes: (notes: string) => void
    clearCart: () => void

    subtotal: () => number
    tax: () => number
    total: () => number
    itemCount: () => number
}

export const useCart = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],
            tableId: '',
            waiterId: '',
            notes: '',

            addItem: (item) => set((state) => {
                const existing = state.items.find(i => i.id === item.id)
                if (existing) {
                    return {
                        items: state.items.map(i =>
                            i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
                        )
                    }
                }
                return { items: [...state.items, { ...item, quantity: 1 }] }
            }),

            updateQuantity: (id, quantity) => set((state) => {
                if (quantity < 1) {
                    return { items: state.items.filter(i => i.id !== id) }
                }
                return {
                    items: state.items.map(i =>
                        i.id === id ? { ...i, quantity } : i
                    )
                }
            }),

            removeItem: (id) => set((state) => ({
                items: state.items.filter(i => i.id !== id)
            })),

            setTable: (id) => set({ tableId: id }),
            setWaiter: (id) => set({ waiterId: id }),
            setNotes: (notes) => set({ notes }),

            clearCart: () => set({
                items: [],
                tableId: '',
                waiterId: '',
                notes: ''
            }),

            subtotal: () => {
                const state = get()
                return state.items.reduce((sum, item) =>
                    sum + (item.price * item.quantity), 0
                )
            },

            tax: () => get().subtotal() * 0.05,

            total: () => {
                const state = get()
                return state.subtotal() + state.tax()
            },

            itemCount: () => get().items.length
        }),
        {
            name: 'restaurant-cart'
        }
    )
)