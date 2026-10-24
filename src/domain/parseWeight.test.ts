import { parseWeight } from './parseWeight'

test.each([
  ['62,5', 62.5],
  ['62.5', 62.5],
  [' 80 ', 80],
  ['0', 0],
  ['', null],
  ['abc', null],
  ['-5', null],
  ['1,2,3', null],
])('parseWeight(%j) = %j', (input, expected) => {
  expect(parseWeight(input)).toBe(expected)
})
