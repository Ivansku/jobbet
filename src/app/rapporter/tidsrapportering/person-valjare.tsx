'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/input'

type Person = { id: string; namn: string }

export function PersonValjare({
  personer,
  valdPersonId,
  vecka,
  kategoriId,
}: {
  personer: Person[]
  valdPersonId: string
  vecka: string
  kategoriId: string
}) {
  const router = useRouter()

  return (
    <Select
      aria-label="Person"
      value={valdPersonId}
      onChange={(e) => {
        router.push(`/rapporter/tidsrapportering?vecka=${vecka}&person=${e.target.value}&kategori=${kategoriId}`)
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
