'use client'

import { BorjaDagen } from './borja-dagen'
import { MittPaDagen } from './mitt-pa-dagen'
import { AvslutaDagen } from './avsluta-dagen'
import type { Dagsflode } from '@/lib/dagsflode'

export type Uppgift = {
  id: string
  titel: string
  status: string
  prioritet: string
  deadline: string | null
  klockslag: string | null
  kund_id: string | null
  typ_id: string | null
  outlook_event_id: string | null
}
export type Kund = { id: string; namn: string }
export type Typ = { id: string; namn: string }
export type Tanke = { id: string; text: string; uppgift_id_skapad: string | null }
export type Dagsavslut = { id: string; avslutad_at: string | null }

export function IdagFlode({
  flode,
  personNamn,
  idag,
  imorgon,
  dagensUppgifter,
  eftersläpning,
  imorgonUppgifter,
  fokusUppgiftIds,
  aktivaFlexelModuler,
  dagsavslut,
  tankar,
  kunder,
  typer,
}: {
  flode: Dagsflode
  personNamn: string
  idag: string
  imorgon: string
  dagensUppgifter: Uppgift[]
  eftersläpning: Uppgift[]
  imorgonUppgifter: Uppgift[]
  fokusUppgiftIds: string[]
  aktivaFlexelModuler: string[]
  dagsavslut: Dagsavslut | null
  tankar: Tanke[]
  kunder: Kund[]
  typer: Typ[]
}) {
  if (flode === 'morgon') {
    return (
      <BorjaDagen
        personNamn={personNamn}
        idag={idag}
        dagensUppgifter={dagensUppgifter}
        eftersläpning={eftersläpning}
        fokusUppgiftIds={fokusUppgiftIds}
        kunder={kunder}
        typer={typer}
      />
    )
  }

  if (flode === 'mitt') {
    return (
      <MittPaDagen
        dagensUppgifter={dagensUppgifter}
        fokusUppgiftIds={fokusUppgiftIds}
        kunder={kunder}
        typer={typer}
      />
    )
  }

  return (
    <AvslutaDagen
      idag={idag}
      imorgon={imorgon}
      eftersläpning={eftersläpning}
      imorgonUppgifter={imorgonUppgifter}
      aktivaFlexelModuler={aktivaFlexelModuler}
      dagsavslut={dagsavslut}
      tankar={tankar}
      kunder={kunder}
    />
  )
}
