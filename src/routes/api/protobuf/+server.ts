import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { insertGtfsRtLog } from '$lib/server/db';

// Maximum entities to return per type to prevent OOM
const DEFAULT_ENTITY_LIMIT = 500;
const MAX_ENTITY_LIMIT = 2000;

export const POST: RequestHandler = async ({ request }) => {
	try {
		const {
			url,
			headers,
			sessionId,
			limit: requestedLimit,
			offset: requestedOffset
		} = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

		const entityLimit = Math.min(
			Math.max(1, requestedLimit || DEFAULT_ENTITY_LIMIT),
			MAX_ENTITY_LIMIT
		);

		const offset = {
			tripUpdates: Math.max(0, requestedOffset?.tripUpdates || 0),
			vehiclePositions: Math.max(0, requestedOffset?.vehiclePositions || 0),
			alerts: Math.max(0, requestedOffset?.alerts || 0)
		};

		const fetchHeaders: Record<string, string> = {};
		if (headers && Array.isArray(headers)) {
			headers.forEach((h: { key: string; value: string }) => {
				if (h.key && h.value) {
					fetchHeaders[h.key] = h.value;
				}
			});
		}

		const response = await fetch(url, {
			headers: fetchHeaders
		});

		if (!response.ok) {
			return json(
				{ error: `HTTP ${response.status}: ${response.statusText}` },
				{ status: response.status }
			);
		}

		const buffer = await response.arrayBuffer();
		const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(new Uint8Array(buffer));

		const feedObject = GtfsRealtimeBindings.transit_realtime.FeedMessage.toObject(feed, {
			longs: String,
			enums: String,
			bytes: String,
			defaults: false,
			arrays: true,
			objects: false,
			oneofs: true
		});

		const tripUpdates: unknown[] = [];
		const vehiclePositions: unknown[] = [];
		const alerts: unknown[] = [];

		// Track total counts and current index for pagination
		let totalTripUpdates = 0;
		let totalVehiclePositions = 0;
		let totalAlerts = 0;

		if (feedObject.entity) {
			for (const entity of feedObject.entity as Record<string, unknown>[]) {
				if (entity.tripUpdate) {
					// Only include if we're past the offset and under the limit
					if (totalTripUpdates >= offset.tripUpdates && tripUpdates.length < entityLimit) {
						tripUpdates.push({
							id: entity.id,
							...entity.tripUpdate
						});
					}
					totalTripUpdates++;
				}
				if (entity.vehicle) {
					if (
						totalVehiclePositions >= offset.vehiclePositions &&
						vehiclePositions.length < entityLimit
					) {
						vehiclePositions.push({
							id: entity.id,
							...entity.vehicle
						});
					}
					totalVehiclePositions++;
				}
				if (entity.alert) {
					if (totalAlerts >= offset.alerts && alerts.length < entityLimit) {
						alerts.push({
							id: entity.id,
							...entity.alert
						});
					}
					totalAlerts++;
				}
			}
		}

		// Only log to database on initial fetch (no offsets)
		const isInitialFetch =
			offset.tripUpdates === 0 && offset.vehiclePositions === 0 && offset.alerts === 0;
		if (isInitialFetch) {
			try {
				insertGtfsRtLog({
					sessionId,
					timestamp: feedObject.header?.timestamp
						? new Date(Number(feedObject.header.timestamp) * 1000).toISOString()
						: new Date().toISOString(),
					url,
					header: feedObject.header,
					entitySummary: {
						tripUpdates: totalTripUpdates,
						vehiclePositions: totalVehiclePositions,
						alerts: totalAlerts,
						total: feedObject.entity?.length || 0
					}
				});
			} catch (dbError) {
				console.error('Failed to log GTFS-RT to database:', dbError);
			}
		}

		return json({
			header: feedObject.header,
			tripUpdates,
			vehiclePositions,
			alerts,
			entityCount: feedObject.entity?.length || 0,
			totals: {
				tripUpdates: totalTripUpdates,
				vehiclePositions: totalVehiclePositions,
				alerts: totalAlerts
			},
			limited: {
				tripUpdates: offset.tripUpdates + tripUpdates.length < totalTripUpdates,
				vehiclePositions: offset.vehiclePositions + vehiclePositions.length < totalVehiclePositions,
				alerts: offset.alerts + alerts.length < totalAlerts
			},
			pagination: {
				limit: entityLimit,
				offset,
				hasMore: {
					tripUpdates: offset.tripUpdates + tripUpdates.length < totalTripUpdates,
					vehiclePositions:
						offset.vehiclePositions + vehiclePositions.length < totalVehiclePositions,
					alerts: offset.alerts + alerts.length < totalAlerts
				}
			}
		});
	} catch (error) {
		console.error('Protobuf decode error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to decode protobuf data' },
			{ status: 500 }
		);
	}
};
