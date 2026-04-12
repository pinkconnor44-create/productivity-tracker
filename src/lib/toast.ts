export function toast(message: string, type: 'success' | 'info' | 'warning' = 'success') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, type } }))
}
