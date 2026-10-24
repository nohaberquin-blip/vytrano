import { cachedFeed, storeFeed, type FeedEntry } from './social'

test('le fil en cache n’est rendu qu’à l’utilisateur qui l’a chargé', () => {
  storeFeed('a', [{ id: 'w1' } as FeedEntry])
  expect(cachedFeed('a').map((e) => e.id)).toEqual(['w1'])
  expect(cachedFeed('b')).toEqual([])
})
