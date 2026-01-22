export function debounce<T extends (...args: unknown[]) => void>(
	fn: T,
	delay: number
): (...args: Parameters<T>) => void {
	let timeoutId: ReturnType<typeof setTimeout> | null = null;

	return (...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
		timeoutId = setTimeout(() => {
			fn(...args);
			timeoutId = null;
		}, delay);
	};
}

export interface GTFSTripUpdate {
	id?: string;
	trip?: {
		tripId?: string;
		routeId?: string;
		directionId?: number;
		startTime?: string;
		startDate?: string;
		scheduleRelationship?: string;
	};
	vehicle?: {
		id?: string;
		label?: string;
		licensePlate?: string;
	};
	stopTimeUpdate?: unknown[];
	timestamp?: number;
	delay?: number;
	[key: string]: unknown;
}

export interface GTFSVehiclePosition {
	id?: string;
	vehicle?: {
		id?: string;
		label?: string;
		licensePlate?: string;
	};
	trip?: {
		tripId?: string;
		routeId?: string;
		directionId?: number;
		startTime?: string;
		startDate?: string;
	};
	position?: {
		latitude?: number;
		longitude?: number;
		bearing?: number;
		speed?: number;
	};
	currentStopSequence?: number;
	currentStatus?: string;
	timestamp?: number;
	[key: string]: unknown;
}

export interface GTFSAlert {
	id?: string;
	activePeriod?: unknown[];
	informedEntity?: unknown[];
	cause?: string;
	effect?: string;
	headerText?: {
		translation?: Array<{ text?: string; language?: string }>;
	};
	descriptionText?: {
		translation?: Array<{ text?: string; language?: string }>;
	};
	[key: string]: unknown;
}

export interface SearchIndex {
	vehicleIds: Map<string, Set<number>>;
	tripIds: Map<string, Set<number>>;
	routeIds: Map<string, Set<number>>;
	labels: Map<string, Set<number>>;
}

export function buildSearchIndex(
	entities: unknown[],
	type: 'tripUpdates' | 'vehiclePositions' | 'alerts'
): SearchIndex {
	const index: SearchIndex = {
		vehicleIds: new Map(),
		tripIds: new Map(),
		routeIds: new Map(),
		labels: new Map()
	};

	const addToIndex = (map: Map<string, Set<number>>, value: string | undefined, idx: number) => {
		if (!value) return;
		const lowerValue = value.toLowerCase();
		if (!map.has(lowerValue)) {
			map.set(lowerValue, new Set());
		}
		map.get(lowerValue)!.add(idx);
	};

	entities.forEach((entity, idx) => {
		const e = entity as Record<string, unknown>;

		if (type === 'tripUpdates') {
			const tripUpdate = e as GTFSTripUpdate;
			addToIndex(index.tripIds, tripUpdate.trip?.tripId, idx);
			addToIndex(index.tripIds, tripUpdate.id, idx);
			addToIndex(index.routeIds, tripUpdate.trip?.routeId, idx);
			addToIndex(index.vehicleIds, tripUpdate.vehicle?.id, idx);
			addToIndex(index.labels, tripUpdate.vehicle?.label, idx);
		} else if (type === 'vehiclePositions') {
			const vehicle = e as GTFSVehiclePosition;
			addToIndex(index.vehicleIds, vehicle.vehicle?.id, idx);
			addToIndex(index.vehicleIds, vehicle.id, idx);
			addToIndex(index.labels, vehicle.vehicle?.label, idx);
			addToIndex(index.tripIds, vehicle.trip?.tripId, idx);
			addToIndex(index.routeIds, vehicle.trip?.routeId, idx);
		} else if (type === 'alerts') {
			const alert = e as GTFSAlert;
			addToIndex(index.tripIds, alert.id, idx);
		}
	});

	return index;
}

export function searchWithIndex(entities: unknown[], query: string, index: SearchIndex): number[] {
	if (!query.trim()) {
		return entities.map((_, idx) => idx);
	}

	const lowerQuery = query.toLowerCase().trim();
	const matchingIndices = new Set<number>();

	for (const map of [index.vehicleIds, index.tripIds, index.routeIds, index.labels]) {
		for (const [key, indices] of map) {
			if (key.includes(lowerQuery)) {
				indices.forEach((idx) => matchingIndices.add(idx));
			}
		}
	}

	return Array.from(matchingIndices).sort((a, b) => a - b);
}

export function deepSearchJSON(
	obj: unknown,
	query: string,
	maxResults: number = 1000
): Array<{ path: string; value: unknown; context: string }> {
	if (!query.trim()) return [];

	const lowerQuery = query.toLowerCase();
	const results: Array<{ path: string; value: unknown; context: string }> = [];
	const stack: Array<{ value: unknown; path: string }> = [{ value: obj, path: '' }];
	const visited = new WeakSet<object>();

	while (stack.length > 0 && results.length < maxResults) {
		const current = stack.pop()!;
		const { value, path } = current;

		if (value === null || value === undefined) continue;

		if (typeof value === 'object') {
			if (visited.has(value as object)) continue;
			visited.add(value as object);

			if (Array.isArray(value)) {
				for (let i = value.length - 1; i >= 0; i--) {
					stack.push({ value: value[i], path: `${path}[${i}]` });
				}
			} else {
				const entries = Object.entries(value as Record<string, unknown>);
				for (let i = entries.length - 1; i >= 0; i--) {
					const [key, val] = entries[i];
					const newPath = path ? `${path}.${key}` : key;

					if (key.toLowerCase().includes(lowerQuery)) {
						results.push({
							path: newPath,
							value: val,
							context: `Key: ${key}`
						});
					}

					stack.push({ value: val, path: newPath });
				}
			}
		} else {
			const strValue = String(value).toLowerCase();
			if (strValue.includes(lowerQuery)) {
				results.push({
					path,
					value,
					context: `Value: ${String(value).substring(0, 100)}`
				});
			}
		}
	}

	return results;
}

export function filterGTFSEntities<T extends unknown[]>(
	entities: T,
	query: string,
	type: 'tripUpdates' | 'vehiclePositions' | 'alerts'
): T {
	if (!query.trim()) {
		return entities;
	}

	const lowerQuery = query.toLowerCase().trim();

	return entities.filter((entity) => {
		const e = entity as Record<string, unknown>;

		if (type === 'tripUpdates') {
			const tripUpdate = e as GTFSTripUpdate;
			return (
				tripUpdate.id?.toLowerCase().includes(lowerQuery) ||
				tripUpdate.trip?.tripId?.toLowerCase().includes(lowerQuery) ||
				tripUpdate.trip?.routeId?.toLowerCase().includes(lowerQuery) ||
				tripUpdate.vehicle?.id?.toLowerCase().includes(lowerQuery) ||
				tripUpdate.vehicle?.label?.toLowerCase().includes(lowerQuery)
			);
		} else if (type === 'vehiclePositions') {
			const vehicle = e as GTFSVehiclePosition;
			return (
				vehicle.id?.toLowerCase().includes(lowerQuery) ||
				vehicle.vehicle?.id?.toLowerCase().includes(lowerQuery) ||
				vehicle.vehicle?.label?.toLowerCase().includes(lowerQuery) ||
				vehicle.trip?.tripId?.toLowerCase().includes(lowerQuery) ||
				vehicle.trip?.routeId?.toLowerCase().includes(lowerQuery)
			);
		} else if (type === 'alerts') {
			const alert = e as GTFSAlert;
			const headerText = alert.headerText?.translation?.[0]?.text || '';
			const descText = alert.descriptionText?.translation?.[0]?.text || '';
			return (
				alert.id?.toLowerCase().includes(lowerQuery) ||
				headerText.toLowerCase().includes(lowerQuery) ||
				descText.toLowerCase().includes(lowerQuery)
			);
		}

		return false;
	}) as T;
}

export function highlightMatches(
	text: string,
	query: string
): { text: string; isMatch: boolean }[] {
	if (!query.trim() || !text) {
		return [{ text, isMatch: false }];
	}

	const lowerText = text.toLowerCase();
	const lowerQuery = query.toLowerCase();
	const parts: { text: string; isMatch: boolean }[] = [];
	let lastIndex = 0;

	let index = lowerText.indexOf(lowerQuery);
	while (index !== -1) {
		if (index > lastIndex) {
			parts.push({ text: text.substring(lastIndex, index), isMatch: false });
		}
		parts.push({ text: text.substring(index, index + query.length), isMatch: true });
		lastIndex = index + query.length;
		index = lowerText.indexOf(lowerQuery, lastIndex);
	}

	if (lastIndex < text.length) {
		parts.push({ text: text.substring(lastIndex), isMatch: false });
	}

	return parts.length > 0 ? parts : [{ text, isMatch: false }];
}

export function getSearchStats(
	totalCount: number,
	filteredCount: number,
	query: string
): { message: string; hasResults: boolean } {
	if (!query.trim()) {
		return { message: `Showing all ${totalCount} items`, hasResults: true };
	}

	if (filteredCount === 0) {
		return { message: `No results found for "${query}"`, hasResults: false };
	}

	return {
		message: `Found ${filteredCount} of ${totalCount} items matching "${query}"`,
		hasResults: true
	};
}
