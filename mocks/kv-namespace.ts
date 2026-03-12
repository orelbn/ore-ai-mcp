/**
 * Create an in-memory KVNamespace-compatible mock pre-populated with given entries.
 *
 * @param entries - Initial key/value pairs to populate the mock store
 * @returns A KVNamespace-compatible object backed by an in-memory store. `get` returns the stored string or `null` if the key is absent; `put` inserts or updates a key; `delete` removes a key.
 */
export function createMockKVNamespace(
	entries: Record<string, string> = {},
): KVNamespace {
	const store = new Map(Object.entries(entries));

	return {
		async get(key: string) {
			return store.get(key) ?? null;
		},
		async put(key: string, value: string) {
			store.set(key, value);
		},
		async delete(key: string) {
			store.delete(key);
		},
	} as unknown as KVNamespace;
}
