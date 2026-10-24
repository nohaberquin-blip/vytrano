import { BODY_PARTS, groupByBodyPart, toBodyPart } from './bodyParts'

test('12 parties du corps, dans l’ordre d’affichage', () => {
  expect(BODY_PARTS).toEqual([
    'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
    'Abdos', 'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Cardio / Autre',
  ])
})

test.each([
  ['Jambes', 'Quadriceps'],
  ['Pectoraux', 'Pectoraux'],
  [null, 'Cardio / Autre'],
  ['n’importe quoi', 'Cardio / Autre'],
])('toBodyPart(%j) = %j', (input, expected) => {
  expect(toBodyPart(input)).toBe(expected)
})

test('regroupe par partie du corps, dans l’ordre de la liste, noms triés, parties vides omises', () => {
  const ex = (name: string, muscle_group: string | null) => ({ id: name, owner_id: null, name, muscle_group })
  const groups = groupByBodyPart([ex('Tractions', 'Dos'), ex('Développé couché', 'Pectoraux'), ex('Rowing', 'Dos'), ex('Burpees', null)])
  expect(groups.map((g) => g.part)).toEqual(['Pectoraux', 'Dos', 'Cardio / Autre'])
  expect(groups[1].items.map((e) => e.name)).toEqual(['Rowing', 'Tractions'])
})
