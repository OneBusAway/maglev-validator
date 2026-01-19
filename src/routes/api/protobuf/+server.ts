import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { url, headers } = await request.json();

		if (!url) {
			return json({ error: 'URL is required' }, { status: 400 });
		}

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
			defaults: true,
			arrays: true,
			objects: true
		});

		const tripUpdates: unknown[] = [];
		const vehiclePositions: unknown[] = [];
		const alerts: unknown[] = [];

		if (feedObject.entity) {
			feedObject.entity.forEach((entity: Record<string, unknown>) => {
				if (entity.tripUpdate) {
					tripUpdates.push({
						id: entity.id,
						...entity.tripUpdate
					});
				}
				if (entity.vehicle) {
					vehiclePositions.push({
						id: entity.id,
						...entity.vehicle
					});
				}
				if (entity.alert) {
					alerts.push({
						id: entity.id,
						...entity.alert
					});
				}
			});
		}

		return json({
			header: feedObject.header,
			tripUpdates,
			vehiclePositions,
			alerts,
			entityCount: feedObject.entity?.length || 0,
			raw: feedObject
		});
	} catch (error) {
		console.error('Protobuf decode error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to decode protobuf data' },
			{ status: 500 }
		);
	}
};
