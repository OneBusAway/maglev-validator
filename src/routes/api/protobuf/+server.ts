import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import { insertGtfsRtLog } from '$lib/server/db';

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
			defaults: false,
			arrays: true,
			objects: false,
			oneofs: true
		});

		const generatePlainText = (obj: unknown, indent = 0): string => {
			const spaces = '  '.repeat(indent);
			if (obj === null || obj === undefined) return `${spaces}null`;
			if (typeof obj !== 'object') return `${spaces}${obj}`;
			if (Array.isArray(obj)) {
				if (obj.length === 0) return `${spaces}[]`;
				return obj
					.map((item, i) => `${spaces}[${i}]:\n${generatePlainText(item, indent + 1)}`)
					.join('\n');
			}
			const entries = Object.entries(obj as Record<string, unknown>);
			if (entries.length === 0) return `${spaces}{}`;
			return entries
				.map(([key, val]) => {
					if (typeof val === 'object' && val !== null) {
						return `${spaces}${key}:\n${generatePlainText(val, indent + 1)}`;
					}
					return `${spaces}${key}: ${val}`;
				})
				.join('\n');
		};

		const rawText = generatePlainText(feedObject);

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

		try {
			const { sessionId } = await request.clone().json();
			insertGtfsRtLog({
				sessionId,
				timestamp: feedObject.header?.timestamp
					? new Date(Number(feedObject.header.timestamp) * 1000).toISOString()
					: new Date().toISOString(),
				url,
				header: feedObject.header,
				entities: feedObject.entity
			});
		} catch (dbError) {
			console.error('Failed to log GTFS-RT to database:', dbError);
		}

		return json({
			header: feedObject.header,
			tripUpdates,
			vehiclePositions,
			alerts,
			entityCount: feedObject.entity?.length || 0,
			raw: feedObject,
			rawText
		});
	} catch (error) {
		console.error('Protobuf decode error:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Failed to decode protobuf data' },
			{ status: 500 }
		);
	}
};
