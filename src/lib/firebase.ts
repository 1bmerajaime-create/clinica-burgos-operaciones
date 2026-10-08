import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env
    .VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

const email = import.meta.env.VITE_FIREBASE_EMAIL as string | undefined

export function isCloudConfigured(): boolean {
  return Boolean(
    config.apiKey?.trim() &&
      config.authDomain?.trim() &&
      config.projectId?.trim() &&
      config.storageBucket?.trim() &&
      config.appId?.trim() &&
      email?.trim(),
  )
}

export function cloudEmail(): string | undefined {
  return email?.trim() || undefined
}

let app: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

function getApp(): FirebaseApp | null {
  if (!isCloudConfigured()) return null
  if (!app) {
    app = initializeApp({
      apiKey: config.apiKey!.trim(),
      authDomain: config.authDomain!.trim(),
      projectId: config.projectId!.trim(),
      storageBucket: config.storageBucket!.trim(),
      messagingSenderId: config.messagingSenderId?.trim() || undefined,
      appId: config.appId!.trim(),
    })
  }
  return app
}

export function getFirebaseAuth(): Auth | null {
  const a = getApp()
  if (!a) return null
  if (!auth) auth = getAuth(a)
  return auth
}

export function getDb(): Firestore | null {
  const a = getApp()
  if (!a) return null
  if (!db) db = getFirestore(a)
  return db
}

export function getFirebaseStorage(): FirebaseStorage | null {
  const a = getApp()
  if (!a) return null
  if (!storage) storage = getStorage(a)
  return storage
}
