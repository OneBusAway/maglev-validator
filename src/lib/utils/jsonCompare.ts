export type DiffStatus = 'same' | 'different' | 'missing' | 'added';

const ID_FIELDS = [
	'id',
	'tripId',
	'activeTripId',
	'tripId',
	'routeId',
	'stopId',
	'vehicleId',
	'blockId',
	'serviceId',
	'calendarId'
];

export function findIdValue(item: unknown): string | number | null {
	if (!isObject(item)) return null;
	for (const field of ID_FIELDS) {
		const value = (item as Record<string, unknown>)[field];
		if (value !== null && value !== undefined) {
			if (typeof value === 'string' || typeof value === 'number') {
				return value;
			}
		}
	}
	return null;
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

const stringifyCache = new WeakMap<object, Map<string, string>>();

export function isKeyIgnored(key: string, currentPath: string, ignoredKeys: string[]): boolean {
	if (ignoredKeys.length === 0) return false;
	const fullPath = currentPath ? `${currentPath}.${key}` : key;
	const normalizedPath = fullPath.replace(/\[\d+\]/g, '.*');
	return ignoredKeys.some((ignored) => {
		const normalizedIgnored = ignored.replace(/\[\d+\]/g, '.*');
		return normalizedPath === normalizedIgnored || normalizedPath.endsWith('.' + normalizedIgnored);
	});
}

function stableStringifyImpl(
	value: unknown,
	ignoredKeys: string[] = [],
	currentPath: string = ''
): string {
	if (value === null) return 'null';
	if (value === undefined) return 'undefined';
	if (typeof value === 'number' && Number.isNaN(value)) return 'NaN';
	if (isArray(value)) {
		if (value.length > 1000) {
			return `[array:${value.length}]`;
		}
		const itemPath = currentPath ? `${currentPath}.*` : '*';
		const normalized = value.map((item) => stableStringify(item, ignoredKeys, itemPath)).sort();
		return `[${normalized.join(',')}]`;
	}
	if (isObject(value)) {
		const keys = Object.keys(value).filter((key) => !isKeyIgnored(key, currentPath, ignoredKeys));
		if (keys.length > 500) {
			return `{object:${keys.length}}`;
		}
		const entries = keys.sort().map((key) => {
			const childPath = currentPath ? `${currentPath}.${key}` : key;
			return `${key}:${stableStringify(value[key], ignoredKeys, childPath)}`;
		});
		return `{${entries.join(',')}}`;
	}
	return JSON.stringify(value);
}

function stableStringify(
	value: unknown,
	ignoredKeys: string[] = [],
	currentPath: string = ''
): string {
	if (typeof value === 'object' && value !== null) {
		const cacheKey = currentPath + '|' + ignoredKeys.join(',');
		let objCache = stringifyCache.get(value);
		if (objCache?.has(cacheKey)) {
			return objCache.get(cacheKey)!;
		}
		const result = stableStringifyImpl(value, ignoredKeys, currentPath);
		if (!objCache) {
			objCache = new Map();
			stringifyCache.set(value, objCache);
		}
		objCache.set(cacheKey, result);
		return result;
	}
	return stableStringifyImpl(value, ignoredKeys, currentPath);
}

function isIdFieldIgnoredAtPath(currentPath: string, ignoredKeys: string[]): boolean {
	if (ignoredKeys.length === 0) return false;
	return ID_FIELDS.some((field) => isKeyIgnored(field, currentPath, ignoredKeys));
}

export function sortById(
	a: unknown,
	b: unknown,
	ignoredKeys: string[] = [],
	currentPath: string = ''
): number {
	const aId = findIdValue(a);
	const bId = findIdValue(b);
	if (aId !== null && bId !== null && !isIdFieldIgnoredAtPath(currentPath, ignoredKeys)) {
		if (typeof aId === 'number' && typeof bId === 'number') {
			return aId - bId;
		}
		return String(aId).localeCompare(String(bId));
	}
	return stableStringify(a, ignoredKeys, currentPath).localeCompare(
		stableStringify(b, ignoredKeys, currentPath)
	);
}

export function sortTopLevelArrays(obj: unknown): unknown {
	if (!isObject(obj)) return obj;

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (isArray(value)) {
			const hasObjectsWithIds =
				value.length > 0 && value.some((item) => isObject(item) && findIdValue(item) !== null);
			if (hasObjectsWithIds) {
				result[key] = [...value].sort(sortById);
			} else {
				result[key] = value;
			}
		} else {
			result[key] = value;
		}
	}
	return result;
}

export async function sortArrayAsync(arr: unknown[]): Promise<unknown[]> {
	if (!Array.isArray(arr) || arr.length === 0) return arr;

	const hasObjectsWithIds = arr.some((item) => isObject(item) && findIdValue(item) !== null);
	if (!hasObjectsWithIds) return arr;

	return [...arr].sort(sortById);
}

export function matchArraysById(
	left: unknown[],
	right: unknown[]
): { left: unknown; right: unknown; id: string | number | null }[] {
	const leftMap = new Map<string | number | null, unknown[]>();
	const rightMap = new Map<string | number | null, unknown[]>();

	for (const item of left) {
		const id = findIdValue(item);
		if (!leftMap.has(id)) {
			leftMap.set(id, []);
		}
		leftMap.get(id)!.push(item);
	}

	for (const item of right) {
		const id = findIdValue(item);
		if (!rightMap.has(id)) {
			rightMap.set(id, []);
		}
		rightMap.get(id)!.push(item);
	}

	const allIds = new Set([...leftMap.keys(), ...rightMap.keys()]);
	const results: { left: unknown; right: unknown; id: string | number | null }[] = [];

	for (const id of allIds) {
		const leftItems = leftMap.get(id) || [];
		const rightItems = rightMap.get(id) || [];
		const maxLen = Math.max(leftItems.length, rightItems.length);

		for (let i = 0; i < maxLen; i++) {
			results.push({
				left: leftItems[i] ?? null,
				right: rightItems[i] ?? null,
				id
			});
		}
	}

	return results;
}

const equalityCache = new Map<number, WeakMap<object, WeakMap<object, boolean>>>();

let cacheCleanupScheduled = false;
function scheduleCacheCleanup() {
	if (cacheCleanupScheduled) return;
	cacheCleanupScheduled = true;
	setTimeout(() => {
		cacheCleanupScheduled = false;
	}, 60000);
}

export function deepEqualIgnoreOrder(
	a: unknown,
	b: unknown,
	ignoredKeys: string[] = [],
	numericTolerancePercent: number = 0,
	currentPath: string = ''
): boolean {
	if (Object.is(a, b)) return true;

	if (typeof a !== typeof b) return false;
	if (a === null || b === null) return a === b;

	if (typeof a === 'number' && typeof b === 'number' && numericTolerancePercent > 0) {
		const maxAbs = Math.max(Math.abs(a), Math.abs(b));
		if (maxAbs === 0) return true;
		const percentDiff = (Math.abs(a - b) / maxAbs) * 100;
		if (percentDiff <= numericTolerancePercent) return true;
	}

	if (typeof a === 'object' && typeof b === 'object' && ignoredKeys.length === 0) {
		const tolCache = equalityCache.get(numericTolerancePercent);
		const aCache = tolCache?.get(a as object);
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
			const itemPath = currentPath ? `${currentPath}.*` : '*';
			const sortWithIgnored = (arr: unknown[]) =>
				[...arr].sort((x, y) => sortById(x, y, ignoredKeys, itemPath));
			if (numericTolerancePercent > 0) {
				const aSorted = sortWithIgnored(a);
				const bSorted = sortWithIgnored(b);
				result = aSorted.every((item, index) =>
					deepEqualIgnoreOrder(item, bSorted[index], ignoredKeys, numericTolerancePercent, itemPath)
				);
			} else {
				const aSorted = sortWithIgnored(a).map((item) =>
					stableStringify(item, ignoredKeys, itemPath)
				);
				const bSorted = sortWithIgnored(b).map((item) =>
					stableStringify(item, ignoredKeys, itemPath)
				);
				result = aSorted.every((value, index) => value === bSorted[index]);
			}
		}
	} else if (isObject(a) && isObject(b)) {
		const aKeys = Object.keys(a)
			.filter((k) => !isKeyIgnored(k, currentPath, ignoredKeys))
			.sort();
		const bKeys = Object.keys(b)
			.filter((k) => !isKeyIgnored(k, currentPath, ignoredKeys))
			.sort();
		if (aKeys.length !== bKeys.length) {
			result = false;
		} else if (aKeys.length === 0) {
			result = true;
		} else {
			result = aKeys.every(
				(key, index) =>
					key === bKeys[index] &&
					deepEqualIgnoreOrder(
						a[key],
						b[key],
						ignoredKeys,
						numericTolerancePercent,
						currentPath ? `${currentPath}.${key}` : key
					)
			);
		}
	} else {
		result = false;
	}

	if (typeof a === 'object' && typeof b === 'object' && ignoredKeys.length === 0) {
		let tolCache = equalityCache.get(numericTolerancePercent);
		if (!tolCache) {
			tolCache = new WeakMap();
			equalityCache.set(numericTolerancePercent, tolCache);
		}
		let aCache = tolCache.get(a as object);
		if (!aCache) {
			aCache = new WeakMap();
			tolCache.set(a as object, aCache);
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
	ignoredKeys: string[] = [],
	numericTolerancePercent: number = 0,
	currentPath: string = ''
): DiffStatus {
	if (otherValue === undefined) {
		return side === 'left' ? 'missing' : 'added';
	}
	return deepEqualIgnoreOrder(value, otherValue, ignoredKeys, numericTolerancePercent, currentPath)
		? 'same'
		: 'different';
}

const MAX_DIFF_COUNT = 999;

export function countDifferences(
	a: unknown,
	b: unknown,
	ignoredKeys: string[] = [],
	maxCount: number = MAX_DIFF_COUNT,
	numericTolerancePercent: number = 0,
	currentPath: string = ''
): number {
	if (a === undefined && b === undefined) return 0;
	if (a === undefined || b === undefined) return 1;
	if (isPrimitive(a) || isPrimitive(b)) {
		return deepEqualIgnoreOrder(a, b, ignoredKeys, numericTolerancePercent, currentPath) ? 0 : 1;
	}

	if (isArray(a) && isArray(b)) {
		const itemPath = currentPath ? `${currentPath}.*` : '*';
		if (a.length > 100 || b.length > 100) {
			if (a.length !== b.length) {
				return Math.min(Math.abs(a.length - b.length) + 1, maxCount);
			}
			if (a.length > 500) {
				const sampleSize = 20;
				let sampleDiffs = 0;
				for (let i = 0; i < sampleSize && i < a.length; i++) {
					const idx = Math.floor((i / sampleSize) * a.length);
					if (
						!deepEqualIgnoreOrder(a[idx], b[idx], ignoredKeys, numericTolerancePercent, itemPath)
					) {
						sampleDiffs++;
					}
				}
				return Math.min(Math.round((sampleDiffs / sampleSize) * a.length), maxCount);
			}
		}

		const aItems = a.map((item) => ({ key: stableStringify(item, ignoredKeys, itemPath), item }));
		const bItems = b.map((item) => ({ key: stableStringify(item, ignoredKeys, itemPath), item }));
		aItems.sort((x, y) => sortById(x.item, y.item, ignoredKeys, itemPath));
		bItems.sort((x, y) => sortById(x.item, y.item, ignoredKeys, itemPath));
		let i = 0;
		let j = 0;
		let diff = 0;
		while ((i < aItems.length || j < bItems.length) && diff < maxCount) {
			if (i >= aItems.length) {
				diff += 1;
				j += 1;
				continue;
			}
			if (j >= bItems.length) {
				diff += 1;
				i += 1;
				continue;
			}
			if (aItems[i].key === bItems[j].key) {
				i += 1;
				j += 1;
			} else if (
				numericTolerancePercent > 0 &&
				deepEqualIgnoreOrder(
					aItems[i].item,
					bItems[j].item,
					ignoredKeys,
					numericTolerancePercent,
					itemPath
				)
			) {
				i += 1;
				j += 1;
			} else if (aItems[i].key < bItems[j].key) {
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
			if (isKeyIgnored(key, currentPath, ignoredKeys)) continue;
			if (diff >= maxCount) break;
			const childPath = currentPath ? `${currentPath}.${key}` : key;
			diff += countDifferences(
				a[key],
				b[key],
				ignoredKeys,
				maxCount - diff,
				numericTolerancePercent,
				childPath
			);
		}
		return Math.min(diff, maxCount);
	}
	return deepEqualIgnoreOrder(a, b, ignoredKeys, numericTolerancePercent, currentPath) ? 0 : 1;
}

export function countComparableItems(
	a: unknown,
	b: unknown,
	ignoredKeys: string[] = [],
	budget: number = 99999,
	currentPath: string = ''
): { count: number; capped: boolean } {
	if (a === undefined && b === undefined) return { count: 0, capped: false };
	if (a === undefined || b === undefined) return { count: 1, capped: false };
	if (isPrimitive(a) || isPrimitive(b)) return { count: 1, capped: false };
	if (budget <= 0) return { count: 0, capped: true };

	if (isArray(a) && isArray(b)) {
		const itemPath = currentPath ? `${currentPath}.*` : '*';
		const aItems = a.map((item) => ({ key: stableStringify(item, ignoredKeys, itemPath), item }));
		const bItems = b.map((item) => ({ key: stableStringify(item, ignoredKeys, itemPath), item }));
		aItems.sort((x, y) => sortById(x.item, y.item, ignoredKeys, itemPath));
		bItems.sort((x, y) => sortById(x.item, y.item, ignoredKeys, itemPath));

		let count = 0;
		let i = 0;
		let j = 0;
		let capped = false;
		while ((i < aItems.length || j < bItems.length) && !capped) {
			if (budget <= 0) return { count, capped: true };
			if (i >= aItems.length) {
				const sub = countComparableItems(null, bItems[j].item, ignoredKeys, budget - 1, itemPath);
				count += sub.count;
				capped = sub.capped;
				j += 1;
				budget -= sub.count + 1;
				continue;
			}
			if (j >= bItems.length) {
				const sub = countComparableItems(aItems[i].item, null, ignoredKeys, budget - 1, itemPath);
				count += sub.count;
				capped = sub.capped;
				i += 1;
				budget -= sub.count + 1;
				continue;
			}
			if (budget <= 0) return { count, capped: true };
			const sub = countComparableItems(aItems[i].item, bItems[j].item, ignoredKeys, budget, itemPath);
			count += sub.count;
			budget -= sub.count;
			if (sub.capped) capped = true;
			i += 1;
			j += 1;
		}
		return { count, capped };
	}

	if (isObject(a) && isObject(b)) {
		const allKeys = new Set([
			...Object.keys(a as Record<string, unknown>),
			...Object.keys(b as Record<string, unknown>)
		]);
		let count = 0;
		let capped = false;
		for (const key of allKeys) {
			if (budget <= 0) return { count, capped: true };
			if (isKeyIgnored(key, currentPath, ignoredKeys)) continue;
			const childPath = currentPath ? `${currentPath}.${key}` : key;
			const sub = countComparableItems(
				(a as Record<string, unknown>)[key],
				(b as Record<string, unknown>)[key],
				ignoredKeys,
				budget,
				childPath
			);
			count += sub.count;
			budget -= sub.count;
			if (sub.capped) capped = true;
		}
		return { count, capped };
	}

	return { count: 1, capped: false };
}

export function sortEntries(obj: Record<string, unknown>): [string, unknown][] {
	return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b));
}

export function sortArrayValues(values: unknown[]): unknown[] {
	if (values.length > 500) {
		return values;
	}
	return [...values].sort(sortById);
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
	function walk(current: unknown, idx: number): unknown {
		if (idx >= tokens.length) return current;
		if (current === null || current === undefined) return undefined;
		const token = tokens[idx];
		if (token === '*') {
			if (!isArray(current)) return undefined;
			const hasStableIds = current.every((item) => findIdValue(item) !== null);
			const items = hasStableIds ? [...current].sort(sortById) : current;
			return items.map((item) => walk(item, idx + 1));
		}
		if (isObject(current) || isArray(current)) {
			return walk((current as Record<string | number, unknown>)[token], idx + 1);
		}
		return undefined;
	}
	return walk(obj, 0);
}
