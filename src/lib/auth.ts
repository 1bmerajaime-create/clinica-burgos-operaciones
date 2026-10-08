import { signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { withTimeout } from './cloudTimeout'
import { cloudEmail, getFirebaseAuth, isCloudConfigured } from './firebase'

const AUTH_KEY = 'cb-operaciones-auth'
/** Contraseña de la web (no cambia). */
const APP_PASSWORD = 'teremoto'

export function isAuthenticated(): boolean {
  try {
    return localStorage.getItem(AUTH_KEY) === '1'
  } catch {
    return false
  }
}

function markAuthenticated() {
  try {
    localStorage.setItem(AUTH_KEY, '1')
  } catch {
    /* ignore */
  }
}

function clearAuthenticated() {
  try {
    localStorage.removeItem(AUTH_KEY)
  } catch {
    /* ignore */
  }
}

function cloudPassword(): string {
  return (
    (import.meta.env.VITE_FIREBASE_PASSWORD as string | undefined)?.trim() ||
    APP_PASSWORD
  )
}

/**
 * Asegura sesión Firebase (reintenta login técnico si hace falta).
 * No bloquea más de unos segundos.
 */
export async function ensureCloudSession(): Promise<boolean> {
  if (!isCloudConfigured()) return false
  const auth = getFirebaseAuth()
  const email = cloudEmail()
  if (!auth || !email) return false

  try {
    await withTimeout(auth.authStateReady(), 8000, 'comprobar sesión')
  } catch {
    return false
  }

  if (auth.currentUser) return true

  try {
    await withTimeout(
      signInWithEmailAndPassword(auth, email, cloudPassword()),
      12000,
      'iniciar sesión en la nube',
    )
    return Boolean(auth.currentUser)
  } catch (err) {
    console.warn('[auth] ensureCloudSession failed', err)
    return false
  }
}

/**
 * Login de la web: solo la contraseña de siempre.
 * Si Firebase está configurado, abre la sesión en la nube en segundo plano
 * (email/contraseña técnicos de .env; el usuario no los ve).
 */
export async function login(password: string): Promise<boolean> {
  if (password.trim() !== APP_PASSWORD) return false

  if (isCloudConfigured()) {
    const auth = getFirebaseAuth()
    const email = cloudEmail()
    if (!auth || !email) return false
    try {
      await withTimeout(
        signInWithEmailAndPassword(auth, email, cloudPassword()),
        12000,
        'iniciar sesión en la nube',
      )
    } catch (err) {
      console.warn('[auth] Firebase sign-in failed', err)
      return false
    }
  }

  markAuthenticated()
  return true
}

export async function logout(): Promise<void> {
  const auth = getFirebaseAuth()
  if (auth) {
    try {
      await signOut(auth)
    } catch {
      /* ignore */
    }
  }
  clearAuthenticated()
}

export { isCloudConfigured }
