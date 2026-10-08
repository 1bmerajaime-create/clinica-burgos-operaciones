import { useEffect, useState } from 'react'

/** false hasta montar (evita mismatch). */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}

/** iPhone / móvil estrecho. iPad y desktop → false (usan modales). */
export function useIsPhone(): boolean {
  return useMediaQuery('(max-width: 767px)')
}
