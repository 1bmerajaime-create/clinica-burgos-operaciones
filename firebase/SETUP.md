# Firebase · CB Operaciones

El login de la web **no cambia**: solo la contraseña habitual.
Firebase guarda y sincroniza datos entre dispositivos.

## Checklist (obligatorio)

1. **Authentication** → Correo/contraseña → Activar  
2. **Authentication → Usuarios → Agregar usuario** técnico:
   - Email: `operaciones@clinicaburgos.com` (o el de `VITE_FIREBASE_EMAIL`)
   - Contraseña: la misma de la web (`teremoto`), o la de `VITE_FIREBASE_PASSWORD`
3. **Firestore Database → Crear base de datos** (modo producción)  
   - Sin este paso la app se queda sin sync (`NOT_FOUND`) y puede parecer que “carga eterno”.
   - Aplica las reglas de `firestore.rules`
4. **Storage** es opcional. Las facturas PDF se sincronizan por Firestore
   (`invoice_files`) en el plan Spark, sin coste.
5. Variables en `.env.local` / GitHub Secrets (ver `.env.example`)

## Comprobar que funciona

Tras crear Firestore, en la web: **Datos → Sincronizar ahora**.  
Si falla, el mensaje indica Auth, Firestore o red.

## Notas

- El email técnico **no se escribe** al entrar en la web; solo lo usa Firebase por detrás.
- Cada dispositivo debe poder autenticarse con ese usuario (mismas variables de entorno en el build de GitHub Pages).
