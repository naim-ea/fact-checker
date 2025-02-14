type CacheEntry<T> = {
  value: T
  timestamp: number
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>>
  private ttl: number // Time to live in milliseconds

  constructor(ttlMinutes = 60) {
    this.cache = new Map()
    this.ttl = ttlMinutes * 60 * 1000
  }

  set(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.value
  }

  clear(): void {
    this.cache.clear()
  }
}