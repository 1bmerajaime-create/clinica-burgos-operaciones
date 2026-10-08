/**
 * pdfjs-dist ≥ 5.4 uses Map#getOrInsert / getOrInsertComputed (Chrome 132+).
 * Safari and algunos Electron aún no los tienen; sin esto page.render() falla
 * y la vista previa del PDF queda en blanco.
 */
export function installMapPolyfills() {
  const proto = Map.prototype as Map<unknown, unknown> & {
    getOrInsert?: (key: unknown, value: unknown) => unknown
    getOrInsertComputed?: (
      key: unknown,
      callback: (key: unknown) => unknown,
    ) => unknown
  }

  if (typeof proto.getOrInsert !== 'function') {
    proto.getOrInsert = function getOrInsert(key, value) {
      if (!this.has(key)) this.set(key, value)
      return this.get(key)
    }
  }

  if (typeof proto.getOrInsertComputed !== 'function') {
    proto.getOrInsertComputed = function getOrInsertComputed(key, callback) {
      if (!this.has(key)) this.set(key, callback(key))
      return this.get(key)
    }
  }
}

installMapPolyfills()
