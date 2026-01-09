// src/lib/print/ESCPOSCommands.ts
// ✅ Minimal ESC/POS commands (Biome compliant)

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CONTROL CHARACTERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ESC = '\x1B'
const GS = '\x1D'

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE COMMANDS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Printer Init
export const INIT = `${ESC}@`

// Text Alignment
export const ALIGN_LEFT = `${ESC}a${String.fromCharCode(0)}`
export const ALIGN_CENTER = `${ESC}a${String.fromCharCode(1)}`

// Text Formatting
export const BOLD_ON = `${ESC}E${String.fromCharCode(1)}`
export const BOLD_OFF = `${ESC}E${String.fromCharCode(0)}`

// Text Size
export const SIZE_NORMAL = `${ESC}!${String.fromCharCode(0)}`
export const SIZE_DOUBLE_HEIGHT = `${ESC}!${String.fromCharCode(16)}`

// Paper Control
export function feedLines(lines: number): string {
    return `${ESC}d${String.fromCharCode(lines)}`
}

export const CUT_PARTIAL = `${GS}V${String.fromCharCode(1)}`

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITY FUNCTIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function reset(): string {
    return INIT + ALIGN_LEFT + SIZE_NORMAL + BOLD_OFF
}

export function line(width: number, char = '-'): string {
    return char.repeat(width) + '\n'
}

export function doubleLine(width: number): string {
    return '='.repeat(width) + '\n'
}

export function blank(lines = 1): string {
    return '\n'.repeat(lines)
}