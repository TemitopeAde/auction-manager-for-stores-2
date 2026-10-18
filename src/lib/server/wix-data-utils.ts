import { items } from '@wix/data';

const WIX_DATA_PAGE_SIZE = 1000;
const WIX_DATA_MAX_PAGES = 100;

/**
 * Loads every matching item from a Wix Data collection.
 *
 * `limit()` maxes out at 1000 and `skip()`/`result.next()` cannot go past that
 * offset, so paging must use a range filter on `_id` instead of skip.
 *
 * Pass a factory that rebuilds filters only — do not set sort, skip, or limit.
 * Sort the returned items in memory if a specific order is needed.
 */
export async function queryAll<T extends { _id?: string }>(
  createQuery: () => items.WixDataQuery,
): Promise<T[]> {
  const allItems: T[] = [];
  let lastId: string | undefined;

  for (let page = 0; page < WIX_DATA_MAX_PAGES; page += 1) {
    let query = createQuery().ascending('_id').limit(WIX_DATA_PAGE_SIZE);

    if (lastId) {
      query = query.gt('_id', lastId);
    }

    const result = await query.find();
    const pageItems = (result.items ?? []) as T[];
    allItems.push(...pageItems);

    if (pageItems.length < WIX_DATA_PAGE_SIZE) {
      break;
    }

    const nextLastId = pageItems[pageItems.length - 1]?._id;
    if (!nextLastId || nextLastId === lastId) {
      break;
    }

    lastId = nextLastId;
  }

  return allItems;
}
