import { useEffect, useState } from 'react'

export interface UserCategory {
  id: string
  name: string
  color: string
  active: boolean
  is_default: boolean
  sort_order: number
}

let _cache: UserCategory[] | null = null
let _promise: Promise<UserCategory[]> | null = null

async function fetchCategories(): Promise<UserCategory[]> {
  if (_cache) return _cache
  if (!_promise) {
    _promise = fetch('/api/categories')
      .then(r => r.json())
      .then(d => {
        _cache = (d.categories || [])
          .filter((c: UserCategory) => c.active)
          .sort((a: UserCategory, b: UserCategory) => a.name.localeCompare(b.name, 'es'))
        return _cache!
      })
      .catch(() => {
        _promise = null
        return []
      })
  }
  return _promise
}

export function invalidateCategoriesCache() {
  _cache = null
  _promise = null
}

export function useCategories() {
  const [categories, setCategories] = useState<UserCategory[]>(_cache || [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) { setCategories(_cache); setLoading(false); return }
    setLoading(true)
    fetchCategories().then(cats => {
      setCategories(cats)
      setLoading(false)
    })
  }, [])

  return { categories, loading, refetch: () => { invalidateCategoriesCache(); fetchCategories().then(setCategories) } }
}
