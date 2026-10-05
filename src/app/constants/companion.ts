// RF-12 — vínculo de quien acompaña a la clienta, de una lista cerrada. No se
// guarda nombre, edad ni documento del acompañante (minimización de datos, Ley
// 25.326): una menor de 13 años va bajo la cuenta de la madre/padre/tutor y solo
// queda registrada la condición de acompañante.
// child = hija/hijo · partner = pareja · family = familiar · friend = amiga/o · other = otra
export const COMPANION_RELATIONS = ['child', 'partner', 'family', 'friend', 'other'] as const
export type CompanionRelation = typeof COMPANION_RELATIONS[number]
