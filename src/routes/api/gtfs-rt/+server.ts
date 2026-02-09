import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getGtfsRtLogs,
	getGtfsRtLog,
	clearGtfsRtLogs,
	getGtfsRtSnapshots,
	insertGtfsRtSnapshot,
	clearGtfsRtSnapshots
} from '$lib/server/db';

export const GET: RequestHandler = async ({ url }) => {
	const id = url.searchParams.get('id');

	if (id) {
		const log = getGtfsRtLog(Number(id));
		if (!log) {
			return json({ error: 'Log not found' }, { status: 404 });
		}
		return json(log);
	}

	const type = url.searchParams.get('type');
	const limit = url.searchParams.get('limit');

	if (type === 'snapshot') {
		const limit = url.searchParams.get('limit');
		const since = url.searchParams.get('since');
		const offset = url.searchParams.get('offset');

		const requestedLimit = limit ? Number(limit) : 10;

		const snapshots = getGtfsRtSnapshots({
			limit: requestedLimit,
			since: since || undefined,
			offset: offset ? Number(offset) : undefined
		});

		return json({
			snapshots,
			pagination: {
				limit: requestedLimit,
				offset: offset ? Number(offset) : 0,
				hasMore: snapshots.length === requestedLimit
			}
		});
	}

	const logs = getGtfsRtLogs(limit ? Number(limit) : 100);
	return json({ logs });
};

export const POST: RequestHandler = async ({ request }) => {
	const { timestamp, data } = await request.json();
	insertGtfsRtSnapshot(timestamp, data);
	return json({ success: true });
};

export const DELETE: RequestHandler = async ({ url }) => {
	const type = url.searchParams.get('type');
	if (type === 'snapshot') {
		const cleared = clearGtfsRtSnapshots();
		return json({ cleared });
	}
	const feedUrl = url.searchParams.get('url');
	const cleared = clearGtfsRtLogs(feedUrl || undefined);
	return json({ cleared });
};
