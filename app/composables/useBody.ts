/**
 * Water and weight — the two numbers the diary is read beside. Each person's
 * own, like everything else; the API answers someone else's row with a 404.
 */

export interface WaterEntry {
  id: string
  ml: number
  created_at: string
}

export interface WaterDay {
  day: string
  ml: number
  goal_ml: number
  /** What one tap of "+" adds */
  glass_ml: number
  /** One per glass, oldest first — the last one is what "−" takes back */
  entries: WaterEntry[]
}

export interface WaterTotal {
  day: string
  ml: number
}

export interface WeightEntry {
  day: string
  kg: number
}

/** "1.25 l", "750 ml" — litres once there is a litre to speak of */
export function formatWater(ml: number): string {
  return ml >= 1000 ? `${Number((ml / 1000).toFixed(2))} l` : `${Math.round(ml)} ml`
}

/** "72.4 kg" — one decimal, the way a scale shows it */
export function formatWeight(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

export function useBody() {
  const api = useApi()

  return {
    loadWater: (day: string) => api.get<WaterDay>(`/eating/water/${day}`),
    addWater: (day: string, ml: number) => api.post<WaterDay>('/eating/water', { day, ml }),
    removeWater: (id: string) => api.del<WaterDay>(`/eating/water/${id}`),
    waterRange: (from: string, to: string) => api.get<WaterTotal[]>('/eating/water', { query: { from, to } }),
    putWeight: (day: string, kg: number) => api.request<WeightEntry>(`/eating/weight/${day}`, { method: 'PUT', body: { kg } }),
    removeWeight: (day: string) => api.del(`/eating/weight/${day}`),
    weightRange: (from: string, to: string) => api.get<WeightEntry[]>('/eating/weight', { query: { from, to } }),
    latestWeight: () => api.get<WeightEntry | null>('/eating/weight/latest')
  }
}
