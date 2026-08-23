'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/input'
import type { Period } from './page'

export function PeriodValjare({
  period,
  datum,
  personId,
  kategoriId,
}: {
  period: Period
  datum: string
  personId: string
  kategoriId: string
}) {
  const router = useRouter()

  return (
    <Select
      aria-label="Period"
      value={period}
      onChange={(e) => {
        router.push(
          `/rapporter/tidsrapportering?datum=${datum}&period=${e.target.value}&person=${personId}&kategori=${kategoriId}`
        )
      }}
      className="!w-auto"
    >
      <option value="vecka">Vecka</option>
      <option value="manad">Månad</option>
      <option value="kvartal">Kvartal</option>
      <option value="ar">År</option>
    </Select>
  )
}
