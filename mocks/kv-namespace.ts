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
