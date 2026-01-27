import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	insertKeyLogs,
	insertLogBatch,
	getKeyLogs,
	getRequestLog,
	clearKeyLogs,
	getLoggedEndpoints,
	getLoggedKeyPaths,
	getKeyLogCount,
	type InsertKeyLogParams
} from '$lib/server/db';

export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { endpoint, timestamp, keys, response1, response2 } = body as {
			endpoint: string;
			timestamp: string;
			keys: Array<{ path: string; server1Value: unknown; server2Value: unknown }>;
			response1?: unknown;
			response2?: unknown;
		};

		if (!endpoint || !timestamp || !keys || !Array.isArray(keys)) {
			return json({ error: 'Missing required fields: endpoint, timestamp, keys' }, { status: 400 });
		}

		if (response1 !== undefined && response2 !== undefined) {
			insertLogBatch({
				timestamp,
				endpoint,
				response1,
				response2,
				keys
			});
		} else {
			const entries: InsertKeyLogParams[] = keys.map((key) => ({
				timestamp,
				endpoint,
				key_path: key.path,
				server1_value: key.server1Value,
				server2_value: key.server2Value
			}));
			insertKeyLogs(entries);
		}

		return json({ success: true, count: keys.length });
	} catch (error) {
		console.error('Error logging keys:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ url }) => {
	try {
		const requestId = url.searchParams.get('requestId');
		if (requestId) {
			const log = getRequestLog(parseInt(requestId, 10));
			if (!log) {
				return json({ error: 'Request log not found' }, { status: 404 });
			}
			return json({
				...log,
				response1: log.response1 ? JSON.parse(log.response1) : null,
				response2: log.response2 ? JSON.parse(log.response2) : null
			});
		}

		const meta = url.searchParams.get('meta');

		if (meta === 'endpoints') {
			return json({ endpoints: getLoggedEndpoints() });
		}

		if (meta === 'keypaths') {
			const endpoint = url.searchParams.get('endpoint');
			if (!endpoint) {
				return json({ error: 'endpoint required for keypaths query' }, { status: 400 });
			}
			return json({ keyPaths: getLoggedKeyPaths(endpoint) });
		}

		if (meta === 'count') {
			const endpoint = url.searchParams.get('endpoint') || undefined;
			return json({ count: getKeyLogCount(endpoint) });
		}

		const endpoint = url.searchParams.get('endpoint') || undefined;
		const keyPath = url.searchParams.get('keyPath') || undefined;
		const since = url.searchParams.get('since') || undefined;
		const limitStr = url.searchParams.get('limit');
		const limit = limitStr ? parseInt(limitStr, 10) : undefined;

		const logs = getKeyLogs({ endpoint, keyPath, since, limit });

		const parsedLogs = logs.map((log) => ({
			...log,
			server1_value: log.server1_value ? JSON.parse(log.server1_value) : null,
			server2_value: log.server2_value ? JSON.parse(log.server2_value) : null
		}));

		return json({ logs: parsedLogs });
	} catch (error) {
		console.error('Error fetching key logs:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ url }) => {
	try {
		const endpoint = url.searchParams.get('endpoint') || undefined;
		const deleted = clearKeyLogs(endpoint);

		return json({ success: true, deleted });
	} catch (error) {
		console.error('Error clearing key logs:', error);
		return json(
			{ error: error instanceof Error ? error.message : 'Unknown error' },
			{ status: 500 }
		);
	}
};
