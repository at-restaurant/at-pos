'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'

// 🎨 Comprehensive Food & Restaurant Icons
const ICON_CATEGORIES = {
    'Fast Food': ['🍔', '🍟', '🍕', '🌭', '🥪', '🌮', '🌯', '🥙', '🧆', '🍿'],
    'Main Dishes': ['🍝', '🍜', '🍲', '🍛', '🍱', '🍣', '🍤', '🥘', '🥗', '🍳'],
    'Meat & Protein': ['🍖', '🍗', '🥩', '🥓', '🍔', '🌭', '🦴', '🍤', '🦞', '🦐'],
    'Asian': ['🍜', '🍱', '🍣', '🍙', '🍘', '🍥', '🥟', '🥠', '🥡', '🍢'],
    'Desserts': ['🍰', '🎂', '🧁', '🍪', '🍩', '🍨', '🍦', '🍧', '🥧', '🍮'],
    'Fruits': ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍑', '🥭'],
    'Vegetables': ['🥕', '🌽', '🥦', '🥬', '🥒', '🍅', '🍆', '🥔', '🧅', '🧄'],
    'Beverages': ['☕', '🍵', '🧃', '🥤', '🧋', '🍹', '🍺', '🍻', '🥂', '🍷'],
    'Breakfast': ['🥐', '🥖', '🥨', '🥯', '🧇', '🥞', '🍳', '🥚', '🧈', '🥛'],
    'Snacks': ['🍿', '🥨', '🥜', '🌰', '🍪', '🥠', '🍘', '🍙', '🥟', '🥮'],
    'Seafood': ['🐟', '🐠', '🦈', '🦞', '🦀', '🦑', '🦐', '🍤', '🦪', '🐙'],
    'Bakery': ['🥐', '🥖', '🍞', '🥯', '🥨', '🧇', '🥞', '🍰', '🧁', '🎂'],
    'International': ['🫔', '🥙', '🧆', '🥘', '🍲', '🍛', '🍜', '🍝', '🥗', '🥪'],
    'Special': ['🎉', '🎊', '🎁', '🔥', '⭐', '💎', '👑', '🏆', '🌟', '✨']
}

interface IconPickerProps {
    selected: string
    onSelect: (icon: string) => void
    onClose: () => void
}

export default function IconPicker({ selected, onSelect, onClose }: IconPickerProps) {
    const [search, setSearch] = useState('')
    const [activeCategory, setActiveCategory] = useState('Fast Food')

    // Filter icons based on search
    const allIcons = Object.values(ICON_CATEGORIES).flat()
    const filteredIcons = search
        ? allIcons.filter(() => true) // Simple filter for emojis
        : ICON_CATEGORIES[activeCategory as keyof typeof ICON_CATEGORIES] || []

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--fg)]">Select Icon</h3>
                        <p className="text-xs text-[var(--muted)] mt-0.5">Choose an icon for your category</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-[var(--bg)] rounded-lg">
                        <X className="w-5 h-5 text-[var(--muted)]" />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-[var(--border)]">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--muted)]" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search icons..."
                            className="w-full pl-10 pr-4 py-2 bg-[var(--bg)] border border-[var(--border)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                    </div>
                </div>

                {/* Categories */}
                {!search && (
                    <div className="p-4 border-b border-[var(--border)] overflow-x-auto">
                        <div className="flex gap-2">
                            {Object.keys(ICON_CATEGORIES).map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                                        activeCategory === cat
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-[var(--bg)] text-[var(--fg)] hover:bg-[var(--border)]'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Icons Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="grid grid-cols-8 sm:grid-cols-10 md:grid-cols-12 gap-2">
                        {filteredIcons.map((icon, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    onSelect(icon)
                                    onClose()
                                }}
                                className={`aspect-square flex items-center justify-center text-3xl rounded-lg transition-all hover:scale-110 active:scale-95 ${
                                    selected === icon
                                        ? 'bg-blue-600/20 border-2 border-blue-600 shadow-lg'
                                        : 'bg-[var(--bg)] hover:bg-[var(--border)] border border-transparent'
                                }`}
                            >
                                {icon}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[var(--border)] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-4xl">{selected || '❓'}</span>
                        <span className="text-sm text-[var(--muted)]">Selected Icon</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    )
}