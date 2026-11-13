// Funciones para mostrar datos con formato chileno.

// 248000 -> "242 KB", 3500000 -> "3,3 MB"
export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) {
    return `${Math.round(kilobytes)} KB`
  }

  const megabytes = kilobytes / 1024
  return `${megabytes.toLocaleString('es-CL', { maximumFractionDigits: 1 })} MB`
}

// "2026-11-12T23:42:38.821Z" -> "12-11-2026, 20:42"
export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// 28000 -> "28.000"
export function formatNumber(value: number): string {
  return value.toLocaleString('es-CL')
}

// "Valentina Torres" -> "VT"
export function getInitials(fullName: string): string {
  const words = fullName.trim().split(/\s+/)
  const first = words[0]?.[0] ?? ''
  const second = words[1]?.[0] ?? ''
  return (first + second).toUpperCase()
}
