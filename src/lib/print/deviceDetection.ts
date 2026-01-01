// src/lib/print/deviceDetection.ts
export type DeviceType = 'windows' | 'mac' | 'android' | 'ios' | 'linux' | 'unknown'
export type PrintMethod = 'usb-service' | 'browser' | 'escpos' | 'web-print'

export interface DeviceInfo {
    type: DeviceType
    printMethod: PrintMethod
    hasUSB: boolean
    hasBluetooth: boolean
    canPrint: boolean
    userAgent: string
}

export function detectDevice(): DeviceInfo {
    if (typeof window === 'undefined') {
        return {
            type: 'unknown',
            printMethod: 'browser',
            hasUSB: false,
            hasBluetooth: false,
            canPrint: false,
            userAgent: ''
        }
    }

    const ua = navigator.userAgent.toLowerCase()
    const isWindows = /win/.test(ua)
    const isMac = /mac/.test(ua) && !/iphone|ipad|ipod/.test(ua)
    const isAndroid = /android/.test(ua)
    const isIOS = /iphone|ipad|ipod/.test(ua)
    const isLinux = /linux/.test(ua) && !isAndroid

    const hasUSB = 'usb' in navigator
    const hasBluetooth = 'bluetooth' in navigator

    let type: DeviceType = 'unknown'
    let printMethod: PrintMethod = 'browser'

    if (isWindows) {
        type = 'windows'
        printMethod = 'usb-service'
    } else if (isMac) {
        type = 'mac'
        printMethod = hasUSB ? 'escpos' : 'browser'
    } else if (isAndroid) {
        type = 'android'
        printMethod = hasBluetooth ? 'escpos' : 'browser'
    } else if (isIOS) {
        type = 'ios'
        printMethod = 'web-print'
    } else if (isLinux) {
        type = 'linux'
        printMethod = 'browser'
    }

    return {
        type,
        printMethod,
        hasUSB,
        hasBluetooth,
        canPrint: true,
        userAgent: navigator.userAgent
    }
}

export function getPrintServiceURL(): string {
    const device = detectDevice()

    if (device.type === 'windows') {
        return process.env.NEXT_PUBLIC_PRINTER_SERVICE_URL || 'http://localhost:3001'
    }

    return ''
}

export function shouldUseServicePrint(): boolean {
    const device = detectDevice()
    return device.type === 'windows' && device.printMethod === 'usb-service'
}

export function getPrintCapabilities() {
    const device = detectDevice()

    return {
        device: device.type,
        method: device.printMethod,
        features: {
            usb: device.hasUSB,
            bluetooth: device.hasBluetooth,
            wifi: true,
            directPrint: device.type === 'windows',
            escpos: device.hasUSB || device.hasBluetooth,
            browserPrint: true
        },
        recommended: getRecommendedPrintMethod(device)
    }
}

function getRecommendedPrintMethod(device: DeviceInfo): string {
    switch (device.type) {
        case 'windows':
            return 'USB Thermal Printer via Service'
        case 'mac':
            return device.hasUSB ? 'USB/ESC POS' : 'Browser Print (CMD+P)'
        case 'android':
            return device.hasBluetooth ? 'Bluetooth Printer' : 'Network Printer'
        case 'ios':
            return 'AirPrint (Safari)'
        default:
            return 'Browser Print (CTRL+P)'
    }
}