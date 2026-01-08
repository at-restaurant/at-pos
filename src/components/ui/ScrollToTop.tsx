// src/components/ui/ScrollToTop.tsx - GLOBAL SCROLL TO TOP BUTTON
'use client'

import { useState, useEffect } from 'react'
import { ArrowUp } from 'lucide-react'

export default function ScrollToTop() {
    const [isVisible, setIsVisible] = useState(false)

    useEffect(() => {
        const toggleVisibility = () => {
            // Show button when page is scrolled down 300px
            if (window.pageYOffset > 300) {
                setIsVisible(true)
            } else {
                setIsVisible(false)
            }
        }

        window.addEventListener('scroll', toggleVisibility)

        return () => {
            window.removeEventListener('scroll', toggleVisibility)
        }
    }, [])

    const scrollToTop = () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        })
    }

    if (!isVisible) return null

    return (
        <>
            {/* Mobile Version - Above bottom nav */}
            <button
                onClick={scrollToTop}
                className="lg:hidden fixed right-4 z-30 w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center hover:from-blue-700 hover:to-blue-800 active:scale-90 transition-all animate-in slide-in-from-bottom-5"
                style={{ bottom: 'calc(4rem + 1rem)' }} // 4rem = bottom nav height + 1rem gap
                aria-label="Scroll to top"
            >
                <ArrowUp className="w-5 h-5" />
            </button>

            {/* Desktop Version - Right side */}
            <button
                onClick={scrollToTop}
                className="hidden lg:flex fixed right-6 bottom-6 z-30 w-14 h-14 bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-full shadow-2xl items-center justify-center hover:from-blue-700 hover:to-blue-800 active:scale-90 transition-all animate-in slide-in-from-bottom-5"
                aria-label="Scroll to top"
            >
                <ArrowUp className="w-6 h-6" />
            </button>
        </>
    )
}