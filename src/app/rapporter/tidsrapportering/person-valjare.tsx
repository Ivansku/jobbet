'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/input'
import type { Period } from './page'

type Person = { id: string; namn: string }

export function PersonValjare({
  personer,
  valdPersonId,
  datum,
  period,
  kategoriId,
}: {
  personer: Person[]
  valdPersonId: string
  datum: string
  period: Period
  kategoriId: string
}) {
  const router = useRouter()

  return (
    <Select
      aria-label="Person"
      value={valdPersonId}
      onChange={(e) => {
        router.push(
          `/rapporter/tidsrapportering?datum=${datum}&period=${period}&person=${e.target.value}&kategori=${kategoriId}`
        )
      }}
      className="!w-auto"
    >
      <option value="alla">Alla personer</option>
      {personer.map((p) => (
        <option key={p.id} value={p.id}>
          {p.namn}
        </option>
      ))}
    </Select>
  )
}
