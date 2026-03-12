export function createMockR2Bucket(
	textObjects: Record<string, string>,
): R2Bucket {
	return {
		async get(key: string) {
			const value = textObjects[key];
			if (typeof value !== "string") {
				return null;
			}
			return {
				text: async () => value,
			} as R2ObjectBody;
		},
	} as unknown as R2Bucket;
}
