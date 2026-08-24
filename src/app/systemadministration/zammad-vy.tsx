'use client'

import { useState } from 'react'
import { synkaZammad, type ZammadSynkResultat } from './zammad-actions'
import { importeraZammadKunder, type ZammadKundImportResultat } from './zammad-kund-actions'
import { Button } from '@/components/ui/button'

export function ZammadVy({ senastSynkad }: { senastSynkad: string | null }) {
  const [synkar, setSynkar] = useState(false)
  const [resultat, setResultat] = useState<ZammadSynkResultat | null>(null)

  const [importerar, setImporterar] = useState(false)
  const [importResultat, setImportResultat] = useState<ZammadKundImportResultat | null>(null)

  async function handleSynka() {
    setSynkar(true)
    setResultat(null)
    const r = await synkaZammad()
    setResultat(r)
    setSynkar(false)
  }

  async function handleImportera() {
    setImporterar(true)
    setImportResultat(null)
    const r = await importeraZammadKunder()
    setImportResultat(r)
    setImporterar(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Zammad</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleImportera} loading={importerar}>
            Hämta kunder
          </Button>
          <Button variant="primary" onClick={handleSynka} loading={synkar}>
            Hämta ärenden
          </Button>
        </div>
      </div>

      <p className="text-sm text-stone-500 dark:text-stone-400">
        {senastSynkad
          ? `Ärenden senast synkade: ${new Date(senastSynkad).toLocaleString('sv-SE')}`
          : 'Ärenden har aldrig synkats.'}
      </p>

      {importResultat && (
        <div className="mt-4 rounded-xl border border-border-subtle bg-surface p-4 text-sm">
          {importResultat.error ? (
            <p className="text-red-600 dark:text-red-400">{importResultat.error}</p>
          ) : (
            <>
              <p>
                {importResultat.kunderSkapade} kunder skapade, {importResultat.kunderMatchade} matchade mot
                befintliga, {importResultat.kontaktpersonerSkapade} kontaktpersoner skapade.
              </p>
              {importResultat.organisationerHoppade.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    {importResultat.organisationerHoppade.length} organisationer kunde inte hanteras:
                  </p>
                  <ul className="mt-2 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                    {importResultat.organisationerHoppade.map((o) => (
                      <li key={o.namn} className="px-3 py-2">
                        <p className="truncate font-medium text-foreground">{o.namn}</p>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">{o.anledning}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {resultat && (
        <div className="mt-4 rounded-xl border border-border-subtle bg-surface p-4 text-sm">
          {resultat.error ? (
            <p className="text-red-600 dark:text-red-400">{resultat.error}</p>
          ) : (
            <>
              <p>
                {resultat.skapade} skapade, {resultat.uppdaterade} uppdaterade
                {resultat.ignorerade > 0 && <>, {resultat.ignorerade} ignorerade</>}.
              </p>
              {resultat.ohanterade.length > 0 && (
                <div className="mt-3">
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    {resultat.ohanterade.length} ärenden kunde inte hanteras:
                  </p>
                  <ul className="mt-2 divide-y divide-border-subtle overflow-hidden rounded-lg border border-border-subtle">
                    {resultat.ohanterade.map((o) => (
                      <li key={o.ticketId} className="px-3 py-2">
                        <p className="truncate font-medium text-foreground">
                          <span className="text-stone-400">#{o.ticketId}</span> {o.titel}
                        </p>
                        <p className="mt-0.5 text-xs text-stone-500 dark:text-stone-400">
                          {o.anledning}
                          {o.avsandare && <> · avsändare: {o.avsandare}</>}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
