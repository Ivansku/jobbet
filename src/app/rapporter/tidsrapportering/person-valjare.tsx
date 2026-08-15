'use client'

import { useRouter } from 'next/navigation'
import { Select } from '@/components/ui/input'
import { Field } from '@/components/ui/field'

type Person = { id: string; namn: string }

export function PersonValjare({
  personer,
  valdPersonId,
  vecka,
}: {
  personer: Person[]
  valdPersonId: string
  vecka: string
}) {
  const router = useRouter()

  return (
    <Field label="Person" htmlFor="rapport-person">
      <Select
        id="rapport-person"
        value={valdPersonId}
        onChange={(e) => {
          router.push(`/rapporter/tidsrapportering?vecka=${vecka}&person=${e.target.value}`)
        }}
        className="w-auto"
      >
        <option value="alla">Alla personer</option>
        {personer.map((p) => (
          <option key={p.id} value={p.id}>
            {p.namn}
          </option>
        ))}
      </Select>
    </Field>
  )
}
