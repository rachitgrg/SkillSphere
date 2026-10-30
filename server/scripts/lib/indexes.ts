import type { Model, mongo } from 'mongoose';

// The driver's types come through mongoose's re-export, so `mongodb` needn't be a direct dependency.
type IndexSpec = Record<string, mongo.IndexDirection>;

/** Options that change an index's behaviour; anything else (e.g. collation: simple) is ignored. */
const MEANINGFUL = ['unique', 'sparse', 'expireAfterSeconds', 'weights', 'partialFilterExpression'] as const;

const sameKey = (a: IndexSpec, b: IndexSpec) => JSON.stringify(a) === JSON.stringify(b);

/** Order-independent comparison (the server returns text weights with sorted keys). */
const sameWeights = (a: unknown, b: unknown) => {
  const norm = (w: unknown) => JSON.stringify(Object.entries((w ?? {}) as Record<string, number>).sort(([x], [y]) => x.localeCompare(y)));
  return norm(a) === norm(b);
};

/** Text indexes are stored as { _fts: 'text', _ftsx: 1 }; compare them by their weights instead. */
const isText = (key: IndexSpec) => Object.values(key).includes('text') || '_fts' in key;

const sameOptions = (existing: Record<string, unknown>, wanted: Record<string, unknown>) =>
  MEANINGFUL.every((opt) => {
    if (opt === 'weights') return !wanted.weights || sameWeights(existing.weights, wanted.weights);
    return Boolean(existing[opt]) === Boolean(wanted[opt]) && (opt !== 'expireAfterSeconds' || existing[opt] === wanted[opt]);
  });

/**
 * Creates missing schema indexes and rebuilds ones whose meaningful options changed
 * (e.g. User.googleId becoming unique). Unlike Model.syncIndexes() it never drops indexes
 * that only differ by server-added defaults, so repeated runs are no-ops.
 */
export const syncSchemaIndexes = async (model: Model<unknown>): Promise<string[]> => {
  await model.createCollection().catch(() => undefined);
  const existing = await model.collection.indexes();
  const changes: string[] = [];

  for (const [key, options] of model.schema.indexes() as [IndexSpec, Record<string, unknown>][]) {
    const match = isText(key)
      ? existing.find((i) => isText(i.key as IndexSpec))
      : existing.find((i) => sameKey(i.key as IndexSpec, key));

    if (match && sameOptions(match as Record<string, unknown>, options)) continue;
    if (match) {
      await model.collection.dropIndex(match.name!);
      changes.push(`rebuilt ${match.name}`);
    } else {
      changes.push(`created ${Object.keys(key).join('+')}`);
    }
    await model.collection.createIndex(key, options);
  }
  return changes;
};
