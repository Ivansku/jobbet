// Uppgifter med klockslag ska alltid hamna i kronologisk ordning bland andra
// tidsatta uppgifter samma dag, utan att man behöver dra dem dit manuellt.
// sortordning återanvänds som den delade sorteringsnyckeln (samma fält som
// drag-and-drop skriver till), men sätts deterministiskt till dag+klockslagets
// epoktid istället för "nu".
export function beraknaSortordning(deadline: string | null, klockslag: string | null): number | undefined {
  if (!deadline || !klockslag) return undefined
  return new Date(`${deadline}T${klockslag}:00Z`).getTime() / 1000
}
