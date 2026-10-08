/** Evita que Auth/Firestore dejen la UI colgada sin respuesta. */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operación',
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`Tiempo agotado en ${label} (${ms / 1000}s)`))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      },
    )
  })
}
