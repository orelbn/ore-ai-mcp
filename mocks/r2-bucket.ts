export function createMockR2Bucket(
	textObjects: Record<string, string>,
): R2Bucket {
	const storage = { ...textObjects };

	return {
		async get(key: string) {
			const value = storage[key];
			if (typeof value !== "string") {
				return null;
			}
			return {
				text: async () => value,
			} as R2ObjectBody;
		},
		async put(
			key: string,
			value: string | ArrayBuffer | ArrayBufferView | Blob,
		) {
			if (typeof value === "string") {
				storage[key] = value;
				return;
			}

			if (value instanceof Blob) {
				storage[key] = await value.text();
				return;
			}

			const bytes =
				value instanceof ArrayBuffer
					? new Uint8Array(value)
					: new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
			storage[key] = new TextDecoder().decode(bytes);
		},
	} as unknown as R2Bucket;
}
