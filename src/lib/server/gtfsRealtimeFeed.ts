import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;

type FeedEntity = Record<string, unknown> & {
	id?: string;
	vehicle?: { vehicle?: { id?: string } };
	tripUpdate?: { trip?: { tripId?: string; startDate?: string } };
};

/**
 * The comparator's diff matches array items by their first ID-like field.
 * FeedEntity IDs are positional for vehicle exports ("1", "2", …) and include
 * the request time for trip-update exports, so two servers never agree on
 * them. matchKey identifies the same real-world entity on both servers.
 */
function entityMatchKey(entity: FeedEntity): string {
	if (entity.vehicle) {
		return `vehicle:${entity.vehicle.vehicle?.id ?? entity.id ?? ''}`;
	}
	if (entity.tripUpdate) {
		const trip = entity.tripUpdate.trip;
		return `trip:${trip?.tripId ?? entity.id ?? ''}:${trip?.startDate ?? ''}`;
	}
	return `entity:${entity.id ?? ''}`;
}

/**
 * Decodes a GTFS-Realtime FeedMessage into JSON the comparator can diff,
 * prefixing each entity with a matchKey. OneBusAway headsign extensions are
 * not part of the standard bindings, so they are not shown.
 */
export function decodeFeedForComparison(buffer: ArrayBuffer): Record<string, unknown> {
	const message = FeedMessage.decode(new Uint8Array(buffer));
	const feed = FeedMessage.toObject(message, {
		longs: String,
		enums: String,
		bytes: String,
		defaults: false,
		arrays: true
	}) as Record<string, unknown> & { entity: FeedEntity[] };

	feed.entity = feed.entity
		.map((entity) => ({ matchKey: entityMatchKey(entity), ...entity }))
		.sort((a, b) => a.matchKey.localeCompare(b.matchKey));
	return feed;
}

/**
 * Reads an export response. Successful feeds are protobuf, but the legacy
 * Java server sends them without a Content-Type, so any successful body that
 * is not declared as JSON or text is decoded. Error responses (400/401/404/
 * 429/500) are JSON or HTML and are returned as-is.
 */
export async function readGtfsRealtimeResponse(response: Response): Promise<unknown> {
	const contentType = response.headers.get('content-type') ?? '';
	const isTextual = contentType.includes('json') || contentType.startsWith('text/');
	if (response.ok && !isTextual) {
		const buffer = await response.arrayBuffer();
		try {
			return decodeFeedForComparison(buffer);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { error: `Not a GTFS-Realtime feed: ${message}`, contentType };
		}
	}
	const text = await response.text();
	try {
		return JSON.parse(text);
	} catch {
		return { contentType, body: text };
	}
}
