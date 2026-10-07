const AUTH_KEY = 'cb-operaciones-auth'
const APP_PASSWORD = 'teremoto'

export function isAuthenticated(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

export function loginWithPassword(password: string): boolean {
  if (password.trim() !== APP_PASSWORD) return false
  try {
    localStorage.setItem(AUTH_KEY, '1')
  } catch {
    /* ignore */
  }
  return true
}

export function logout(): void {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}
