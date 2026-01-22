export type DiffStatus = 'same' | 'different' | 'missing' | 'added';

const stringifyCache = new WeakMap<object, Map<string, string>>();

const equalityCache = new WeakMap<object, WeakMap<object, boolean>>();

let cacheCleanupScheduled = false;
function scheduleCacheCleanup() {
	if (cacheCleanupScheduled) return;
	cacheCleanupScheduled = true;
	setTimeout(() => {
		cacheCleanupScheduled = false;
	}, 60000);
}

export function isArray(value: unknown): value is unknown[] {
	return Array.isArray(value);
}

export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !isArray(value);
}

export function isPrimitive(value: unknown): boolean {
	return !isArray(value) && !isObject(value);
}

function stableStringifyImpl(value: unknown, ignoredKeys: string[] = []): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
	if (isArray(value)) {
		if (value.length > 1000) {
			return `[array:${value.length}]`;
		}
		const normalized = value.map((item) => stableStringify(item, ignoredKeys)).sort();
		return `[${normalized.join(',')}]`;
	}
	if (isObject(value)) {
		const keys = Object.keys(value).filter((key) => !ignoredKeys.includes(key));
		if (keys.length > 500) {
			return `{object:${keys.length}}`;
		}
		const entries = keys.sort().map((key) => `${key}:${stableStringify(value[key], ignoredKeys)}`);
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value);
}

function stableStringify(value: unknown, ignoredKeys: string[] = []): string {
	if (typeof value === 'object' && value !== null) {
		const cacheKey = ignoredKeys.join(',');
		let objCache = stringifyCache.get(value);
		if (objCache?.has(cacheKey)) {
			return objCache.get(cacheKey)!;
		}
		const result = stableStringifyImpl(value, ignoredKeys);
		if (!objCache) {
			objCache = new Map();
			stringifyCache.set(value, objCache);
		}
		objCache.set(cacheKey, result);
		scheduleCacheCleanup();
		return result;
	}
	return stableStringifyImpl(value, ignoredKeys);
}

export function deepEqualIgnoreOrder(a: unknown, b: unknown, ignoredKeys: string[] = []): boolean {
	if (Object.is(a, b)) return true;
	
	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;
	
	if (typeof a === 'object' && typeof b === 'object' && ignoredKeys.length === 0) {
		const aCache = equalityCache.get(a as object);
		if (aCache?.has(b as object)) {
			return aCache.get(b as object)!;
		}
	}
	
	let result: boolean;
	
	if (isArray(a) && isArray(b)) {
		if (a.length !== b.length) {
			result = false;
		} else if (a.length === 0) {
			result = true;
		} else {
			const aSorted = a.map((item) => stableStringify(item, ignoredKeys)).sort();
			const bSorted = b.map((item) => stableStringify(item, ignoredKeys)).sort();
			result = aSorted.every((value, index) => value === bSorted[index]);
		}
	} else if (isObject(a) && isObject(b)) {
		const aKeys = Object.keys(a)
			.filter((k) => !ignoredKeys.includes(k))
			.sort();
		const bKeys = Object.keys(b)
			.filter((k) => !ignoredKeys.includes(k))
			.sort();
		if (aKeys.length !== bKeys.length) {
			result = false;
		} else if (aKeys.length === 0) {
			result = true;
		} else {
			result = aKeys.every(
				(key, index) => key === bKeys[index] && deepEqualIgnoreOrder(a[key], b[key], ignoredKeys)
			);
		}
	} else {
		result = false;
	}
	
	if (typeof a === 'object' && typeof b === 'object' && ignoredKeys.length === 0) {
		let aCache = equalityCache.get(a as object);
		if (!aCache) {
			aCache = new WeakMap();
			equalityCache.set(a as object, aCache);
		}
		aCache.set(b as object, result);
		scheduleCacheCleanup();
	}
	
	return result;
}

export function getDiffStatus(
	value: unknown,
	otherValue: unknown,
	side: 'left' | 'right',
	ignoredKeys: string[] = []
): DiffStatus {
	if (otherValue === undefined) {
		return side === 'left' ? 'missing' : 'added';
	}
	return deepEqualIgnoreOrder(value, otherValue, ignoredKeys) ? 'same' : 'different';
}

const MAX_DIFF_COUNT = 999;

export function countDifferences(
	a: unknown,
	b: unknown,
	ignoredKeys: string[] = [],
	maxCount: number = MAX_DIFF_COUNT
): number {
	if (a === undefined && b === undefined) return 0;
	if (a === undefined || b === undefined) return 1;
	if (isPrimitive(a) || isPrimitive(b)) {
		return deepEqualIgnoreOrder(a, b, ignoredKeys) ? 0 : 1;
	}

	if (isArray(a) && isArray(b)) {
		if (a.length > 100 || b.length > 100) {
			if (a.length !== b.length) {
				return Math.min(Math.abs(a.length - b.length) + 1, maxCount);
			}
			if (a.length > 500) {
				const sampleSize = 20;
				let sampleDiffs = 0;
				for (let i = 0; i < sampleSize && i < a.length; i++) {
					const idx = Math.floor((i / sampleSize) * a.length);
					if (!deepEqualIgnoreOrder(a[idx], b[idx], ignoredKeys)) {
						sampleDiffs++;
					}
				}
				return Math.min(Math.round((sampleDiffs / sampleSize) * a.length), maxCount);
			}
		}

		const aSorted = a.map((item) => stableStringify(item, ignoredKeys)).sort();
		const bSorted = b.map((item) => stableStringify(item, ignoredKeys)).sort();
		let i = 0;
		let j = 0;
		let diff = 0;
		while ((i < aSorted.length || j < bSorted.length) && diff < maxCount) {
			if (i >= aSorted.length) {
				diff += 1;
				j += 1;
				continue;
			}
			if (j >= bSorted.length) {
				diff += 1;
				i += 1;
				continue;
			}
			if (aSorted[i] === bSorted[j]) {
				i += 1;
				j += 1;
			} else if (aSorted[i] < bSorted[j]) {
				diff += 1;
				i += 1;
			} else {
				diff += 1;
				j += 1;
			}
		}
		return Math.min(diff, maxCount);
	}
	if (isObject(a) && isObject(b)) {
		const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
		let diff = 0;
		for (const key of keys) {
			if (ignoredKeys.includes(key)) continue;
			if (diff >= maxCount) break; 
			diff += countDifferences(a[key], b[key], ignoredKeys, maxCount - diff);
		}
		return Math.min(diff, maxCount);
	}
	return deepEqualIgnoreOrder(a, b, ignoredKeys) ? 0 : 1;
}

export function sortEntries(obj: Record<string, unknown>): [string, unknown][] {
	return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

export function sortArrayValues(values: unknown[]): unknown[] {
	if (values.length > 500) {
		return values;
	}
	return [...values].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

export function parsePath(path: string): (string | number)[] {
	if (!path) return [];
	const tokens: (string | number)[] = [];
	const regex = /\[(\d+)\]|[^.[\]]+/g;
	let match: RegExpExecArray | null;
	while ((match = regex.exec(path)) !== null) {
		if (match[1] !== undefined) {
			tokens.push(Number(match[1]));
		} else if (match[0]) {
			tokens.push(match[0]);
		}
	}
	return tokens;
}

export function getByPath(obj: unknown, path: string): unknown {
	if (!path) return obj;
	const tokens = parsePath(path);
	let current: unknown = obj;
	for (const token of tokens) {
		if (current === null || current === undefined) return undefined;
		if (isObject(current) || isArray(current)) {
			current = (current as Record<string | number, unknown>)[token];
		} else {
			return undefined;
		}
	}
	return current;
}
