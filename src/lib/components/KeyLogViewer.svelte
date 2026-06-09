<script lang="ts">
	import { endpoints as configuredEndpoints } from '$lib/endpoints';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';
	import { logState } from '$lib/logState.svelte';
	import { comparatorState, loggerState, type KeyLogEntry } from '$lib/panelState.svelte';
	import { fly } from 'svelte/transition';
	import { deepEqualIgnoreOrder } from '$lib/utils/jsonCompare';

	import JsonViewer from '$lib/components/JsonViewer.svelte';

	let loggedEndpoints = $state<string[]>([]);

	let showDetailModal = $state(false);
	let selectedLogEntry = $state<KeyLogEntry | null>(null);
	let selectedRequestLog = $state<{ response1: unknown; response2: unknown } | null>(null);
	let isLoadingDetail = $state(false);

	let arrayDetailLog = $state<KeyLogEntry | null>(null);
	let arrayDetailFilter = $state<'all' | 'match' | 'mismatch'>('all');

	function openArrayDetail(log: KeyLogEntry) {
		arrayDetailLog = log;
		arrayDetailFilter = 'all';
	}

	function closeArrayDetail() {
		arrayDetailLog = null;
	}

	let traceKeyPath = $state('');
	let showChart = $state(false);
	let chartTimeRange = $state<'30m' | '1h' | '2h' | '6h' | '24h' | 'all'>('all');
	let limitInput = $state(loggerState.limit);
	let chartLogs = $state<KeyLogEntry[]>([]);

	const matchCache = $derived.by(() => {
		const map = new SvelteMap<number, boolean>();
		for (const log of loggerState.logs) {
			map.set(
				log.id,
				valuesMatch(log.server1_value, log.server2_value, comparatorState.numericTolerancePercent)
			);
		}
		return map;
	});

	const availableIds = $derived(
		[
			...new Set(
				loggerState.logs
					.map((l) => l.id_value)
					.filter((v): v is string => v !== null && v !== undefined)
			)
		].sort()
	);

	const filteredLogs = $derived(
		loggerState.logs.filter((log) => {
			if (
				loggerState.selectedKeyPaths.size > 0 &&
				!loggerState.selectedKeyPaths.has(log.key_path)
			) {
				return false;
			}
			if (loggerState.idFilter && log.id_value !== loggerState.idFilter) {
				return false;
			}
			if (loggerState.filterMode === 'all') return true;
			const match = matchCache.get(log.id) ?? false;
			return loggerState.filterMode === 'match' ? match : !match;
		})
	);

	const globalStatsLogs = $derived(
		loggerState.selectedKeyPaths.size > 0
			? loggerState.logs.filter((log) => loggerState.selectedKeyPaths.has(log.key_path))
			: loggerState.logs
	);

	const globalMatchStats = $derived.by(() => {
		const logs = globalStatsLogs;
		const total = logs.length;
		if (total === 0) return { total: 0, matched: 0, mismatched: 0, matchPct: 0 };
		const matched = logs.filter((log) => matchCache.get(log.id)).length;
		return {
			total,
			matched,
			mismatched: total - matched,
			matchPct: Math.round((matched / total) * 100)
		};
	});

	let currentPage = $state(1);
	let totalPages = $derived(
		loggerState.totalCount > 0 && Number.isFinite(loggerState.limit) && loggerState.limit > 0
			? Math.ceil(loggerState.totalCount / loggerState.limit)
			: 1
	);

	function goToPage(page: number) {
		if (page < 1 || page > totalPages) return;
		currentPage = page;
		fetchLogs();
	}

	let debounceTimer: ReturnType<typeof setTimeout> | undefined;
	$effect(() => {
		void limitInput;
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			const val = Number(limitInput);
			if (!Number.isFinite(val) || val < 1) return;
			loggerState.limit = Math.min(Math.round(val), 1000);
		}, 400);
	});

	$effect(() => {
		void loggerState.selectedEndpoint;
		void loggerState.timeRange;
		void loggerState.filterMode;
		void [...loggerState.selectedKeyPaths];
		currentPage = 1;
		void loggerState.timeRange;
		if (loggerState.timeRange !== 'live') fetchLogs();
	});

	let server1ScrollContainer = $state<HTMLElement | undefined>(undefined);

	let syncedExpandedPaths = new SvelteSet<string>();

	const trendByLogId = $derived.by(() => {
		const map = new SvelteMap<
			number,
			{ server1: 'up' | 'down' | 'same' | null; server2: 'up' | 'down' | 'same' | null }
		>();
		const last = new SvelteMap<string, { s1: number; s2: number }>();
		for (const log of filteredLogs) {
			const s1 = typeof log.server1_value === 'number' ? log.server1_value : NaN;
			const s2 = typeof log.server2_value === 'number' ? log.server2_value : NaN;
			const prev = last.get(log.key_path);
			const t1 =
				prev !== undefined && !isNaN(s1)
					? s1 > prev.s1
						? 'up'
						: s1 < prev.s1
							? 'down'
							: 'same'
					: null;
			const t2 =
				prev !== undefined && !isNaN(s2)
					? s2 > prev.s2
						? 'up'
						: s2 < prev.s2
							? 'down'
							: 'same'
					: null;
			map.set(log.id, { server1: t1, server2: t2 });
			last.set(log.key_path, {
				s1: isNaN(s1) ? (prev?.s1 ?? 0) : s1,
				s2: isNaN(s2) ? (prev?.s2 ?? 0) : s2
			});
		}
		return map;
	});

	const S1_COLORS = ['#16a34a', '#15803d', '#166534', '#22c55e', '#4ade80', '#86efac'];
	const S2_COLORS = ['#f97316', '#ea580c', '#c2410c', '#fb923c', '#fdba74', '#fed7aa'];

	const chartData = $derived.by(() => {
		const empty = {
			entries: [] as KeyLogEntry[],
			hasNumeric: false,
			s1: { series: [] as { label: string; points: { x: number; y: number }[] }[], maxLen: 0 },
			s2: { series: [] as { label: string; points: { x: number; y: number }[] }[], maxLen: 0 },
			minVal: 0,
			maxVal: 1,
			range: 1
		};
		if (!traceKeyPath) return empty;

		let raw = chartLogs.filter((l) => l.key_path === traceKeyPath);

		if (chartTimeRange !== 'all') {
			const ms = {
				'30m': 30 * 60 * 1000,
				'1h': 60 * 60 * 1000,
				'2h': 2 * 60 * 60 * 1000,
				'6h': 6 * 60 * 60 * 1000,
				'24h': 24 * 60 * 60 * 1000
			}[chartTimeRange];
			const cutoff = Date.now() - ms;
			raw = raw.filter((l) => new Date(l.timestamp).getTime() >= cutoff);
		}

		const entries = raw;
		const allRawVals: number[] = entries.flatMap((e) => {
			const s1 = e.server1_value;
			const s2 = e.server2_value;
			const a1 = Array.isArray(s1)
				? (s1 as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
				: typeof s1 === 'number' && Number.isFinite(s1)
					? [s1]
					: [];
			const a2 = Array.isArray(s2)
				? (s2 as unknown[]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
				: typeof s2 === 'number' && Number.isFinite(s2)
					? [s2]
					: [];
			return [...a1, ...a2];
		});
		const hasNumeric = allRawVals.some((v: number) => !isNaN(v));

		function buildSeries(getVal: (e: KeyLogEntry) => unknown): {
			series: { label: string; points: { x: number; y: number }[] }[];
			maxLen: number;
		} {
			const maxLen = entries.reduce((m, e) => {
				const v = getVal(e);
				return Array.isArray(v) ? Math.max(m, v.length) : Math.max(m, 1);
			}, 0);
			const series: { label: string; points: { x: number; y: number }[] }[] = [];
			for (let i = 0; i < maxLen; i++) {
				const points: { x: number; y: number }[] = [];
				for (let ei = 0; ei < entries.length; ei++) {
					const raw = getVal(entries[ei]);
					let val: number;
					if (Array.isArray(raw)) {
						val = i < raw.length ? Number(raw[i]) : NaN;
					} else {
						val = i === 0 ? Number(raw) : NaN;
					}
					if (!isNaN(val)) {
						points.push({ x: ei, y: val });
					}
				}
				if (points.length > 0) {
					series.push({ label: `#${i}`, points });
				}
			}
			return { series, maxLen };
		}

		const s1 = buildSeries((e) => e.server1_value);
		const s2 = buildSeries((e) => e.server2_value);

		const allNumericVals = entries
			.flatMap((e) => {
				const a1 = Array.isArray(e.server1_value)
					? (e.server1_value as unknown[]).map(Number)
					: [Number(e.server1_value)];
				const a2 = Array.isArray(e.server2_value)
					? (e.server2_value as unknown[]).map(Number)
					: [Number(e.server2_value)];
				return [...a1, ...a2];
			})
			.filter((v) => !isNaN(v));

		const minVal = allNumericVals.length > 0 ? Math.min(...allNumericVals) : 0;
		const maxVal = allNumericVals.length > 0 ? Math.max(...allNumericVals) : 1;
		const range = maxVal - minVal || 1;

		return { entries, hasNumeric, s1, s2, minVal, maxVal, range };
	});

	let columnWidths = $state<Record<string, number>>({});
	let resizingColumn = $state<string | null>(null);
	let resizeStartX = $state(0);
	let resizeStartWidth = $state(0);

	function startResize(e: MouseEvent, col: string) {
		e.preventDefault();
		const th = (e.currentTarget as HTMLElement).parentElement;
		if (!th) return;
		resizingColumn = col;
		resizeStartX = e.clientX;
		resizeStartWidth = th.offsetWidth;
	}

	function resetColumnWidths() {
		columnWidths = {};
	}

	$effect(() => {
		if (!resizingColumn) return;
		function onMouseMove(e: MouseEvent) {
			if (!resizingColumn) return;
			const diff = e.clientX - resizeStartX;
			const newWidth = Math.max(60, resizeStartWidth + diff);
			columnWidths = { ...columnWidths, [resizingColumn]: newWidth };
		}
		function onMouseUp() {
			resizingColumn = null;
		}
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
		return () => {
			document.removeEventListener('mousemove', onMouseMove);
			document.removeEventListener('mouseup', onMouseUp);
		};
	});
	let server2ScrollContainer = $state<HTMLElement | undefined>(undefined);
	let isScrollSyncing = false;

	function handleToggle(path: string, expanded: boolean) {
		if (expanded) {
			syncedExpandedPaths.add(path);
		} else {
			syncedExpandedPaths.delete(path);
		}
	}

	function syncScroll(source: HTMLElement | undefined, target: HTMLElement | undefined) {
		if (!source || !target || isScrollSyncing) return;
		isScrollSyncing = true;
		requestAnimationFrame(() => {
			const percent = source.scrollTop / (source.scrollHeight - source.clientHeight);
			if (!isNaN(percent)) {
				target.scrollTop = percent * (target.scrollHeight - target.clientHeight);
			}
			setTimeout(() => {
				isScrollSyncing = false;
			}, 50);
		});
	}

	async function openDetail(log: KeyLogEntry) {
		selectedLogEntry = log;
		showDetailModal = true;
		selectedRequestLog = null;
		syncedExpandedPaths.clear();

		if (log.request_id) {
			isLoadingDetail = true;
			try {
				const res = await fetch(`/api/keylog?requestId=${log.request_id}`);
				const data = await res.json();
				if (data && !data.error) {
					selectedRequestLog = data;
				}
			} catch (e) {
				console.error('Failed to fetch request detail:', e);
			} finally {
				isLoadingDetail = false;
			}
		}
	}

	onMount(() => {
		fetchLoggedEndpoints();
	});

	$effect(() => {
		void loggedEndpoints;
		if (!loggerState.selectedEndpoint) {
			if (comparatorState.selectedEndpoint) {
				loggerState.selectedEndpoint = comparatorState.selectedEndpoint;
			} else if (loggedEndpoints.length > 0) {
				loggerState.selectedEndpoint = loggedEndpoints[0];
			}
		}
	});

	$effect(() => {
		const endpoint = loggerState.selectedEndpoint;
		if (endpoint) {
			untrack(() => fetchKeyPaths(endpoint));
		} else {
			loggerState.keyPaths = [];
			loggerState.selectedKeyPaths.clear();
		}
	});

	$effect(() => {
		void loggerState.limit;
		void loggerState.timeRange;
		void loggerState.selectedKeyPaths.size;
		void loggerState.selectedEndpoint;
		untrack(() => {
			if (loggerState.selectedEndpoint) {
				fetchLogs(false);
				fetchCount();
			}
		});
	});

	let livePollTimer: ReturnType<typeof setInterval> | undefined = $state();

	$effect(() => {
		void logState.lastUpdated;
		untrack(() => {
			if (loggerState.selectedEndpoint) {
				fetchLogs(true);
				fetchCount();
			}
		});
	});

	let pollTick = 0;
	$effect(() => {
		if (loggerState.timeRange === 'live' && loggerState.selectedEndpoint) {
			fetchLogs(true);
			fetchCount();
			pollTick = 0;
			livePollTimer = setInterval(() => {
				pollTick++;
				fetchLogs(true);
				fetchCount();
				if (showChart && traceKeyPath && pollTick % 5 === 0) fetchChartLogs();
			}, 1000);
			return () => {
				if (livePollTimer !== undefined) {
					clearInterval(livePollTimer);
					livePollTimer = undefined;
				}
			};
		} else {
			if (livePollTimer !== undefined) {
				clearInterval(livePollTimer);
				livePollTimer = undefined;
			}
		}
	});

	async function fetchLoggedEndpoints() {
		try {
			const res = await fetch('/api/keylog?meta=endpoints');
			const data = await res.json();
			loggedEndpoints = data.endpoints || [];
		} catch (e) {
			console.error('Failed to fetch endpoints:', e);
		}
	}

	async function fetchKeyPaths(endpoint: string) {
		try {
			const res = await fetch(`/api/keylog?meta=keypaths&endpoint=${encodeURIComponent(endpoint)}`);
			const data = await res.json();
			loggerState.keyPaths = data.keyPaths || [];
		} catch (e) {
			console.error('Failed to fetch key paths:', e);
		}
	}

	async function fetchCount() {
		try {
			let url = `/api/keylog?meta=count`;
			if (loggerState.selectedEndpoint) {
				url += `&endpoint=${encodeURIComponent(loggerState.selectedEndpoint)}`;
				if (loggerState.selectedKeyPaths.size > 0) {
					for (const kp of loggerState.selectedKeyPaths) {
						url += `&keyPath=${encodeURIComponent(kp)}`;
					}
				}
				if (loggerState.idFilter) {
					url += `&idValue=${encodeURIComponent(loggerState.idFilter)}`;
				}
			}
			const res = await fetch(url);
			const data = await res.json();
			loggerState.totalCount = data.count || 0;
		} catch (e) {
			console.error('Failed to fetch count:', e);
		}
	}

	async function fetchLogs(silent = false) {
		if (!loggerState.selectedEndpoint) return;
		if (!Number.isFinite(loggerState.limit) || loggerState.limit < 1) return;

		if (!silent) loggerState.loading = true;
		try {
			let url = `/api/keylog?endpoint=${encodeURIComponent(loggerState.selectedEndpoint)}`;

			if (loggerState.timeRange === 'live') {
				url += `&limit=${loggerState.limit}`;
			} else {
				if (loggerState.timeRange !== 'all') {
					const now = new Date();
					let since;
					if (loggerState.timeRange === '1h') {
						since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
					} else if (loggerState.timeRange === '24h') {
						since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
					}
					if (since) url += `&since=${encodeURIComponent(since)}`;
				}
				url += `&limit=${loggerState.limit}`;
				url += `&offset=${(currentPage - 1) * loggerState.limit}`;
			}

			if (loggerState.selectedKeyPaths.size > 0) {
				for (const kp of loggerState.selectedKeyPaths) {
					url += `&keyPath=${encodeURIComponent(kp)}`;
				}
			}

			if (loggerState.idFilter) {
				url += `&idValue=${encodeURIComponent(loggerState.idFilter)}`;
			}

			const res = await fetch(url);
			const data = await res.json();
			loggerState.logs = data.logs || [];
		} catch (e) {
			console.error('Failed to fetch logs:', e);
		} finally {
			if (!silent) loggerState.loading = false;
		}
	}

	async function clearLogs() {
		if (!confirm('Are you sure you want to clear all logs?')) return;

		try {
			const url = loggerState.selectedEndpoint
				? `/api/keylog?endpoint=${encodeURIComponent(loggerState.selectedEndpoint)}`
				: '/api/keylog';
			await fetch(url, { method: 'DELETE' });
			loggerState.logs = [];
			chartLogs = [];
			await fetchLoggedEndpoints();
			await fetchCount();
		} catch (e) {
			console.error('Failed to fetch logs:', e);
		}
	}

	async function fetchChartLogs() {
		if (!loggerState.selectedEndpoint || !traceKeyPath) return;
		const capturedEndpoint = loggerState.selectedEndpoint;
		const capturedKey = traceKeyPath;
		const capturedIdFilter = loggerState.idFilter;
		try {
			let url = `/api/keylog?endpoint=${encodeURIComponent(capturedEndpoint)}&keyPath=${encodeURIComponent(capturedKey)}`;
			const isLive = loggerState.timeRange === 'live';
			const range = chartTimeRange;
			const ms = {
				'30m': 30 * 60 * 1000,
				'1h': 60 * 60 * 1000,
				'2h': 2 * 60 * 60 * 1000,
				'6h': 6 * 60 * 60 * 1000,
				'24h': 24 * 60 * 60 * 1000
			} as Record<string, number>;
			const rangeMs = ms[range];
			if (rangeMs) {
				const since = new Date(Date.now() - rangeMs).toISOString();
				url += `&since=${encodeURIComponent(since)}`;
			}
			if (capturedIdFilter) {
				url += `&idValue=${encodeURIComponent(capturedIdFilter)}`;
			}
			url += `&limit=${isLive ? 500 : 10000}`;
			const res = await fetch(url);
			if (capturedEndpoint !== loggerState.selectedEndpoint || capturedKey !== traceKeyPath) return;
			const data = await res.json();
			chartLogs = data.logs || [];
		} catch (e) {
			console.error('Failed to fetch chart logs:', e);
		}
	}

	$effect(() => {
		void traceKeyPath;
		void showChart;
		void loggerState.selectedEndpoint;
		void chartTimeRange;
		void loggerState.idFilter;
		if (showChart && traceKeyPath && loggerState.selectedEndpoint) {
			fetchChartLogs();
		} else {
			chartLogs = [];
		}
	});

	function lastPathSegment(path: string): string {
		const parts = path.split('.');
		return parts[parts.length - 1];
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (Array.isArray(value)) return JSON.stringify(value);
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function valuesMatch(v1: unknown, v2: unknown, tolerance?: number): boolean {
		return deepEqualIgnoreOrder(v1, v2, [], tolerance ?? comparatorState.numericTolerancePercent);
	}

	function formatTimestamp(ts: string): string {
		try {
			const date = new Date(ts);
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			return date.toLocaleString('en-US', { timeZone });
		} catch {
			return ts;
		}
	}

	function exportCSV() {
		if (loggerState.logs.length === 0) return;

		const headers = [
			'Timestamp',
			'Endpoint',
			'Key Path',
			'Server 1 Value',
			'Server 2 Value',
			'Match'
		];
		const rows = loggerState.logs.map((log) => [
			log.timestamp,
			log.endpoint,
			log.key_path,
			formatValue(log.server1_value),
			formatValue(log.server2_value),
			valuesMatch(log.server1_value, log.server2_value) ? 'Yes' : 'No'
		]);

		const csv = [headers, ...rows]
			.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
			.join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `keylog-${loggerState.selectedEndpoint}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key !== 'Escape') return;
		if (arrayDetailLog) {
			closeArrayDetail();
		} else if (showDetailModal) {
			showDetailModal = false;
		}
	}}
/>

<div class="space-y-6">
	<div
		class="rounded-xl border border-gray-200 bg-white p-6 shadow-sm transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
	>
		<div class="mb-4 flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Key Logger History</h2>
				<p class="text-sm text-gray-500 dark:text-gray-400">
					Track how selected key values change over time across both servers
				</p>
			</div>
			<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
				<span
					class="rounded-full bg-gray-100 px-3 py-1 font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					{loggerState.totalCount} total
				</span>
				{#if globalMatchStats.total > 0}
					<span
						class="rounded-full px-3 py-1 font-medium {globalMatchStats.matchPct >= 80
							? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
							: globalMatchStats.matchPct >= 50
								? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
								: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
					>
						{globalMatchStats.matchPct}% match
					</span>
					<span class="flex items-center gap-0.5">
						{#each Array.from({ length: 10 }, (_u, i) => i) as i (i)}
							<span
								class="h-2.5 w-1.5 rounded-sm {i <
								Math.round((globalMatchStats.matchPct / 100) * 10)
									? 'bg-green-500 dark:bg-green-400'
									: 'bg-gray-200 dark:bg-gray-700'}"
							></span>
						{/each}
					</span>
					<span class="text-green-600 dark:text-green-400">{globalMatchStats.matched} ✓</span>
					<span class="text-red-500">{globalMatchStats.mismatched} ✗</span>
				{/if}
				{#if Object.keys(columnWidths).length > 0}
					<button
						onclick={resetColumnWidths}
						class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
					>
						Reset columns
					</button>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-12 gap-4">
			<div class="col-span-3">
				<label
					for="endpoint-select"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Endpoint
				</label>
				<select
					id="endpoint-select"
					bind:value={loggerState.selectedEndpoint}
					class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					<option value="">Select endpoint...</option>
					{#each configuredEndpoints as endpoint (endpoint.id)}
						<option value={endpoint.id}>
							{endpoint.name}
							{loggedEndpoints.includes(endpoint.id) ? ' (Has logs)' : ''}
						</option>
					{/each}
				</select>
			</div>

			<div class="col-span-3">
				<label
					for="keypath-select"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Key Paths
				</label>
				<div class="space-y-2">
					<select
						id="keypath-select"
						value=""
						onchange={(e) => {
							const val = (e.target as HTMLSelectElement).value;
							if (val) loggerState.selectedKeyPaths.add(val);
							(e.target as HTMLSelectElement).value = '';
						}}
						disabled={!loggerState.selectedEndpoint}
						class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						<option value="" disabled selected>Add key path...</option>
						{#each loggerState.keyPaths as kp (kp)}
							{#if !loggerState.selectedKeyPaths.has(kp)}
								<option value={kp}>{kp}</option>
							{/if}
						{/each}
					</select>

					{#if loggerState.selectedKeyPaths.size > 0}
						<div class="flex flex-wrap gap-2">
							{#each [...loggerState.selectedKeyPaths] as kp (kp)}
								<span
									class="flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-[11px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-300"
								>
									{kp}
									<button
										onclick={() => loggerState.selectedKeyPaths.delete(kp)}
										class="hover:text-green-900 dark:hover:text-green-100"
										aria-label="Remove key path"
									>
										<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								</span>
							{/each}
							<button
								onclick={() => loggerState.selectedKeyPaths.clear()}
								class="text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
							>
								Clear
							</button>
						</div>
					{:else}
						<div class="text-[11px] text-gray-400 dark:text-gray-500">
							No filter — showing all keys
						</div>
					{/if}
				</div>
			</div>

			<div class="col-span-2">
				<label
					for="limit-input"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Rows
				</label>
				<input
					id="limit-input"
					type="number"
					bind:value={limitInput}
					min="10"
					max="1000"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
				/>
			</div>

			<div class="col-span-2">
				<div
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Filter
				</div>
				<div
					class="flex w-full items-center rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900"
				>
					<button
						onclick={() => (loggerState.filterMode = 'all')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {loggerState.filterMode ===
						'all'
							? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						All
					</button>
					<button
						onclick={() => (loggerState.filterMode = 'match')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {loggerState.filterMode ===
						'match'
							? 'bg-white text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Match
					</button>
					<button
						onclick={() => (loggerState.filterMode = 'mismatch')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {loggerState.filterMode ===
						'mismatch'
							? 'bg-white text-red-700 shadow-sm dark:bg-red-900/30 dark:text-red-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Diff
					</button>
				</div>
				{#if comparatorState.numericTolerancePercent > 0}
					<div
						class="mt-1.5 flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
					>
						<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
							></path>
						</svg>
						±{comparatorState.numericTolerancePercent}% tolerance
					</div>
				{/if}
			</div>

			<div class="col-span-2">
				<label
					for="id-filter-select"
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					ID Filter
				</label>
				<select
					id="id-filter-select"
					value={loggerState.idFilter}
					onchange={(e) => {
						loggerState.idFilter = (e.target as HTMLSelectElement).value;
					}}
					class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all focus:border-green-500 focus:ring-2 focus:ring-green-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					<option value="">All IDs</option>
					{#each availableIds as id (id)}
						<option value={id}>{id}</option>
					{/each}
				</select>
				{#if loggerState.idFilter}
					<button
						onclick={() => (loggerState.idFilter = '')}
						class="mt-1 text-[11px] font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
					>
						Clear ID filter
					</button>
				{/if}
			</div>

			<div
				class="col-span-12 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
			>
				<div class="flex items-center gap-4">
					<div class="flex items-center gap-2">
						<div
							class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						>
							Time Range:
						</div>
						<div
							class="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900"
						>
							{#each ['live', '1h', '24h', 'all'] as range (range)}
								<button
									onclick={() => (loggerState.timeRange = range as 'live' | '1h' | '24h' | 'all')}
									class="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all {loggerState.timeRange ===
									range
										? 'bg-white text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300'
										: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
								>
									{range === '1h' ? 'Last 1h' : range === '24h' ? 'Last 24h' : range}
								</button>
							{/each}
						</div>
					</div>
					<div class="flex items-center gap-2">
						<div
							class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
						>
							Trace:
						</div>
						<select
							bind:value={traceKeyPath}
							class="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs font-medium text-gray-700 focus:border-green-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
						>
							<option value="">Select key...</option>
							{#each [...new Set(loggerState.logs.map((l) => l.key_path))] as kp (kp)}
								<option value={kp}>{lastPathSegment(kp)}</option>
							{/each}
						</select>
						<button
							onclick={() => {
								if (traceKeyPath) showChart = !showChart;
							}}
							disabled={!traceKeyPath}
							class="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all {showChart &&
							traceKeyPath
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}"
						>
							<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
								/>
							</svg>
							Chart
						</button>
					</div>
				</div>
				<div class="flex items-center gap-3">
					<button
						onclick={exportCSV}
						class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							></path></svg
						>
						Export CSV
					</button>
					<button
						onclick={() => fetchLogs()}
						class="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
						title="Refresh"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							></path>
						</svg>
					</button>
					<button
						onclick={clearLogs}
						class="flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-900/30 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
					>
						Clear
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Chart -->
	{#if showChart && traceKeyPath && chartData.entries.length > 1}
		{@const pad = { top: 20, right: 16, bottom: 28, left: 48 }}
		{@const cw = 400}
		{@const ch = 220}
		{@const iw = cw - pad.left - pad.right}
		{@const ih = ch - pad.top - pad.bottom}
		{@const scaleY = (v: number) => pad.top + ih - ((v - chartData.minVal) / chartData.range) * ih}
		{@const scaleX = (ei: number) =>
			pad.left + (ei / Math.max(chartData.entries.length - 1, 1)) * iw}
		{@const yTicks = Array.from({ length: 5 }, (_, i) => {
			const v = chartData.minVal + (chartData.range * i) / 4;
			return { value: v, y: scaleY(v) };
		})}
		<div
			class="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="mb-3 flex flex-wrap items-center gap-3">
				<h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
					Trace: <span class="font-mono text-green-600 dark:text-green-400">{traceKeyPath}</span>
				</h3>
				<div class="ml-auto flex items-center gap-2">
					<span class="text-[11px] font-medium text-gray-500 dark:text-gray-400">Time:</span>
					<div
						class="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-900"
					>
						{#each ['30m', '1h', '2h', '6h', '24h', 'all'] as range (range)}
							<button
								onclick={() =>
									(chartTimeRange = range as '30m' | '1h' | '2h' | '6h' | '24h' | 'all')}
								class="rounded-md px-2.5 py-1.5 text-xs font-medium transition-all {chartTimeRange ===
								range
									? 'bg-white text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-300'
									: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
							>
								{range === 'all' ? 'All' : range}
							</button>
						{/each}
					</div>
					<span class="text-xs text-gray-500">({chartData.entries.length} pts)</span>
				</div>
			</div>
			{#if chartData.hasNumeric}
				<div class="grid grid-cols-2 gap-6">
					<div>
						<h4
							class="mb-2 text-xs font-bold tracking-wide text-green-600 uppercase dark:text-green-400"
						>
							Server 1
						</h4>
						<svg viewBox="0 0 {cw} {ch}" class="w-full">
							{#each yTicks as tick (tick.value)}
								<line
									x1={pad.left}
									x2={cw - pad.right}
									y1={tick.y}
									y2={tick.y}
									stroke="currentColor"
									class="text-gray-200 dark:text-gray-700"
									stroke-width="1"
								/>
							{/each}
							{#each yTicks as tick (tick.value)}
								<text
									x={pad.left - 4}
									y={tick.y + 3}
									text-anchor="end"
									class="fill-gray-500 text-[9px] dark:fill-gray-400"
								>
									{tick.value.toFixed(1)}
								</text>
							{/each}
							<clipPath id="clip-s1">
								<rect x={pad.left} y={pad.top} width={iw} height={ih} />
							</clipPath>
							<g clip-path="url(#clip-s1)">
								{#each chartData.s1.series as s, si (si)}
									<polyline
										points={s.points.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
										fill="none"
										stroke={S1_COLORS[si % S1_COLORS.length]}
										stroke-width="2"
										stroke-linejoin="round"
										stroke-linecap="round"
									/>
								{/each}
							</g>
							{#if chartData.s1.series.length > 1}
								<text
									x={pad.left + 4}
									y={pad.top - 4}
									class="fill-gray-400 text-[8px] dark:fill-gray-500"
								>
									{chartData.s1.series.length} lines
								</text>
							{/if}
							{#if chartData.s1.series.length > 1}
								<g transform="translate({pad.left}, {ch - 16})">
									{#each chartData.s1.series.slice(0, 6) as s, si (si)}
										<line
											x1={si * 50}
											y1={0}
											x2={si * 50 + 14}
											y2={0}
											stroke={S1_COLORS[si % S1_COLORS.length]}
											stroke-width="2"
										/>
										<text
											x={si * 50 + 16}
											y={3}
											class="fill-gray-500 text-[8px] dark:fill-gray-400"
										>
											{s.label}
										</text>
									{/each}
								</g>
							{/if}
						</svg>
					</div>
					<div>
						<h4
							class="mb-2 text-xs font-bold tracking-wide text-orange-600 uppercase dark:text-orange-400"
						>
							Server 2
						</h4>
						<svg viewBox="0 0 {cw} {ch}" class="w-full">
							{#each yTicks as tick (tick.value)}
								<line
									x1={pad.left}
									x2={cw - pad.right}
									y1={tick.y}
									y2={tick.y}
									stroke="currentColor"
									class="text-gray-200 dark:text-gray-700"
									stroke-width="1"
								/>
							{/each}
							{#each yTicks as tick (tick.value)}
								<text
									x={pad.left - 4}
									y={tick.y + 3}
									text-anchor="end"
									class="fill-gray-500 text-[9px] dark:fill-gray-400"
								>
									{tick.value.toFixed(1)}
								</text>
							{/each}
							<clipPath id="clip-s2">
								<rect x={pad.left} y={pad.top} width={iw} height={ih} />
							</clipPath>
							<g clip-path="url(#clip-s2)">
								{#each chartData.s2.series as s, si (si)}
									<polyline
										points={s.points.map((p) => `${scaleX(p.x)},${scaleY(p.y)}`).join(' ')}
										fill="none"
										stroke={S2_COLORS[si % S2_COLORS.length]}
										stroke-width="2"
										stroke-linejoin="round"
										stroke-linecap="round"
									/>
								{/each}
							</g>
							{#if chartData.s2.series.length > 1}
								<text
									x={pad.left + 4}
									y={pad.top - 4}
									class="fill-gray-400 text-[8px] dark:fill-gray-500"
								>
									{chartData.s2.series.length} lines
								</text>
							{/if}
							{#if chartData.s2.series.length > 1}
								<g transform="translate({pad.left}, {ch - 16})">
									{#each chartData.s2.series.slice(0, 6) as s, si (si)}
										<line
											x1={si * 50}
											y1={0}
											x2={si * 50 + 14}
											y2={0}
											stroke={S2_COLORS[si % S2_COLORS.length]}
											stroke-width="2"
										/>
										<text
											x={si * 50 + 16}
											y={3}
											class="fill-gray-500 text-[8px] dark:fill-gray-400"
										>
											{s.label}
										</text>
									{/each}
								</g>
							{/if}
						</svg>
					</div>
				</div>
			{:else}
				<div class="flex items-center justify-center py-8 text-sm text-gray-400 dark:text-gray-500">
					Values are not numeric — chart cannot be rendered
				</div>
			{/if}
		</div>
	{/if}

	<!-- Logs Table -->
	{#if !loggerState.selectedEndpoint}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
		>
			<div
				class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-900"
			>
				<svg class="h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
					></path>
				</svg>
			</div>
			<h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-white">Select an Endpoint</h3>
			<p class="max-w-md text-gray-500">
				Choose an endpoint from the dropdown above to view logged key values over time.
				{#if loggedEndpoints.length === 0}
					<br /><br />
					<strong class="text-green-600">No logs yet.</strong> Enable key watching in the API Comparator
					to start logging.
				{/if}
			</p>
		</div>
	{:else if loggerState.loading}
		<div
			class="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 dark:border-gray-700 dark:bg-gray-800"
		>
			<svg class="h-8 w-8 animate-spin text-green-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</div>
	{:else if loggerState.logs.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800"
		>
			<p class="text-gray-500">No logs found for this endpoint.</p>
		</div>
	{:else}
		<div
			class="max-h-[65vh] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="overflow-x-auto">
				<table class="w-full" style="table-layout: fixed;">
					<thead>
						<tr
							class="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
						>
							<th
								class="relative px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.timestamp ? `width: ${columnWidths.timestamp}px` : ''}
							>
								<span class="flex items-center gap-1"> Timestamp </span>
								<button
									aria-label="Resize timestamp column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'timestamp')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
							<th
								class="relative px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.keypath ? `width: ${columnWidths.keypath}px` : ''}
							>
								Key Path
								<button
									aria-label="Resize key path column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'keypath')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
							<th
								class="relative px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.idvalue ? `width: ${columnWidths.idvalue}px` : ''}
							>
								ID Value
								<button
									aria-label="Resize ID value column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'idvalue')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
							<th
								class="relative px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.server1 ? `width: ${columnWidths.server1}px` : ''}
							>
								Server 1
								<button
									aria-label="Resize server 1 column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'server1')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
							<th
								class="relative px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.server2 ? `width: ${columnWidths.server2}px` : ''}
							>
								Server 2
								<button
									aria-label="Resize server 2 column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'server2')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
							<th
								class="relative px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
								style={columnWidths.match ? `width: ${columnWidths.match}px` : ''}
							>
								Match
								<button
									aria-label="Resize match column"
									class="absolute top-0 right-0 z-10 h-full w-2 cursor-col-resize bg-gray-300/20 transition-colors select-none hover:bg-green-500/40 active:bg-green-500/60 dark:bg-gray-600/20 dark:hover:bg-green-500/40"
									onmousedown={(e) => startResize(e, 'match')}
								>
									<div class="mx-auto h-full w-px bg-gray-300 dark:bg-gray-600"></div>
								</button>
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
						{#each filteredLogs as log (log.id)}
							{@const match = matchCache.get(log.id) ?? false}
							{@const isArray =
								Array.isArray(log.server1_value) || Array.isArray(log.server2_value)}
							<tr
								in:fly={{ y: -10, duration: 300 }}
								onclick={() => openDetail(log)}
								class="cursor-pointer transition-colors hover:bg-green-50/50 dark:hover:bg-green-900/10"
							>
								<td
									class="truncate px-4 py-3 text-sm whitespace-nowrap text-gray-600 dark:text-gray-400"
								>
									{formatTimestamp(log.timestamp)}
								</td>
								<td
									class="truncate px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-200"
									title={log.key_path}
								>
									{lastPathSegment(log.key_path)}
								</td>
								<td
									class="truncate px-4 py-3 font-mono text-sm text-gray-500 dark:text-gray-500"
									title={log.id_value ?? ''}
								>
									{log.id_value || '-'}
								</td>
								<td
									class="overflow-hidden px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300"
								>
									{#if isArray}
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												openArrayDetail(log);
											}}
											class="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40"
											title="View array elements"
										>
											<span class="font-semibold"
												>[{Array.isArray(log.server1_value)
													? (log.server1_value as unknown[]).length
													: 0} items]</span
											>
											<span class="truncate text-green-500/70 dark:text-green-400/70">
												{formatValue(log.server1_value)}
											</span>
										</button>
									{:else}
										{@const trend = trendByLogId.get(log.id)}
										<div
											class="flex items-center gap-0.5 truncate"
											title={formatValue(log.server1_value)}
										>
											{#if trend?.server1}
												{#if trend.server1 === 'up'}
													<svg
														class="h-3 w-3 shrink-0 text-green-500"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else if trend.server1 === 'down'}
													<svg
														class="h-3 w-3 shrink-0 text-red-500"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else}
													<svg
														class="h-3 w-3 shrink-0 text-gray-400"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
															clip-rule="evenodd"
														/>
													</svg>
												{/if}
											{/if}
											{formatValue(log.server1_value)}
										</div>
									{/if}
								</td>
								<td
									class="overflow-hidden px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300"
								>
									{#if isArray}
										<button
											type="button"
											onclick={(e) => {
												e.stopPropagation();
												openArrayDetail(log);
											}}
											class="group inline-flex max-w-full items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300 dark:hover:bg-green-900/40"
											title="View array elements"
										>
											<span class="font-semibold"
												>[{Array.isArray(log.server2_value)
													? (log.server2_value as unknown[]).length
													: 0} items]</span
											>
											<span class="truncate text-green-500/70 dark:text-green-400/70">
												{formatValue(log.server2_value)}
											</span>
										</button>
									{:else}
										{@const trend = trendByLogId.get(log.id)}
										<div
											class="flex items-center gap-0.5 truncate"
											title={formatValue(log.server2_value)}
										>
											{#if trend?.server2}
												{#if trend.server2 === 'up'}
													<svg
														class="h-3 w-3 shrink-0 text-green-500"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else if trend.server2 === 'down'}
													<svg
														class="h-3 w-3 shrink-0 text-red-500"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
															clip-rule="evenodd"
														/>
													</svg>
												{:else}
													<svg
														class="h-3 w-3 shrink-0 text-gray-400"
														fill="currentColor"
														viewBox="0 0 20 20"
													>
														<path
															fill-rule="evenodd"
															d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z"
															clip-rule="evenodd"
														/>
													</svg>
												{/if}
											{/if}
											{formatValue(log.server2_value)}
										</div>
									{/if}
								</td>
								<td class="px-4 py-3 text-center">
									{#if match}
										<span
											class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M5 13l4 4L19 7"
												></path>
											</svg>
										</span>
									{:else}
										<span
											class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
										>
											<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
												<path
													stroke-linecap="round"
													stroke-linejoin="round"
													stroke-width="2"
													d="M6 18L18 6M6 6l12 12"
												></path>
											</svg>
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>

		{#if totalPages > 1 && loggerState.timeRange !== 'live'}
			<div
				class="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/30"
			>
				<div class="text-xs text-gray-500 dark:text-gray-400">
					Page {currentPage} of {totalPages} ({loggerState.totalCount} total)
				</div>
				<div class="flex items-center gap-1">
					<button
						disabled={currentPage <= 1}
						onclick={() => goToPage(1)}
						class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {currentPage <= 1
							? 'text-gray-300 dark:text-gray-600'
							: 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}"
						title="First page"
					>
						«
					</button>
					<button
						disabled={currentPage <= 1}
						onclick={() => goToPage(currentPage - 1)}
						class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {currentPage <= 1
							? 'text-gray-300 dark:text-gray-600'
							: 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}"
						title="Previous page"
					>
						‹
					</button>
					{#each { length: Math.min(totalPages, 7) } as _, i (i)}
						{@const pageNum = (() => {
							if (totalPages <= 7) return i + 1;
							const half = 3;
							let start = currentPage - half;
							if (start < 1) start = 1;
							if (start + 6 > totalPages) start = totalPages - 6;
							return start + i;
						})()}
						<button
							onclick={() => goToPage(pageNum)}
							class="min-w-[28px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors {pageNum ===
							currentPage
								? 'bg-green-600 text-white'
								: 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}"
						>
							{pageNum}
						</button>
					{/each}
					<button
						disabled={currentPage >= totalPages}
						onclick={() => goToPage(currentPage + 1)}
						class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {currentPage >=
						totalPages
							? 'text-gray-300 dark:text-gray-600'
							: 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}"
						title="Next page"
					>
						›
					</button>
					<button
						disabled={currentPage >= totalPages}
						onclick={() => goToPage(totalPages)}
						class="rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors {currentPage >=
						totalPages
							? 'text-gray-300 dark:text-gray-600'
							: 'text-gray-600 hover:bg-gray-200 dark:text-gray-400 dark:hover:bg-gray-700'}"
						title="Last page"
					>
						»
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

{#if showDetailModal && selectedLogEntry}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm transition-all sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex h-[80vh] w-full max-w-6xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
		>
			<div
				class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-700"
			>
				<div>
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white">
						Log Detail: <span class="font-mono text-green-600 dark:text-green-400"
							>{selectedLogEntry.key_path}</span
						>
					</h3>
					<p class="text-xs text-gray-500 dark:text-gray-400">
						{formatTimestamp(selectedLogEntry.timestamp)} • {selectedLogEntry.endpoint}
					</p>
				</div>
				<button
					aria-label="Close"
					onclick={() => (showDetailModal = false)}
					class="text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="grid flex-1 grid-cols-2 gap-4 overflow-hidden bg-gray-50 p-4 dark:bg-gray-900/50">
				<div
					class="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<div
						class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						<span>Server 1 {selectedRequestLog ? '(Full Response)' : '(Logged Value)'}</span>
						{#if isLoadingDetail}
							<span class="text-xs font-normal text-gray-500">Loading full context...</span>
						{/if}
					</div>
					<div
						class="flex-1 overflow-auto"
						bind:this={server1ScrollContainer}
						onscroll={() => syncScroll(server1ScrollContainer, server2ScrollContainer)}
					>
						<JsonViewer
							data={selectedRequestLog
								? selectedRequestLog.response1
								: selectedLogEntry.server1_value}
							otherData={selectedRequestLog
								? selectedRequestLog.response2
								: selectedLogEntry.server2_value}
							mode="server1"
							matchingPaths={selectedRequestLog ? new Set([selectedLogEntry.key_path]) : undefined}
							{syncedExpandedPaths}
							onToggle={handleToggle}
							numericTolerancePercent={comparatorState.numericTolerancePercent}
						/>
					</div>
				</div>
				<div
					class="flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900"
				>
					<div
						class="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
					>
						<span>Server 2 {selectedRequestLog ? '(Full Response)' : '(Logged Value)'}</span>
					</div>
					<div
						class="flex-1 overflow-auto"
						bind:this={server2ScrollContainer}
						onscroll={() => syncScroll(server2ScrollContainer, server1ScrollContainer)}
					>
						<JsonViewer
							data={selectedRequestLog
								? selectedRequestLog.response2
								: selectedLogEntry.server2_value}
							otherData={selectedRequestLog
								? selectedRequestLog.response1
								: selectedLogEntry.server1_value}
							mode="server2"
							matchingPaths={selectedRequestLog ? new Set([selectedLogEntry.key_path]) : undefined}
							{syncedExpandedPaths}
							onToggle={handleToggle}
							numericTolerancePercent={comparatorState.numericTolerancePercent}
						/>
					</div>
				</div>
			</div>

			<div
				class="flex justify-end gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<button
					aria-label="Close modal"
					onclick={() => (showDetailModal = false)}
					class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

{#if arrayDetailLog}
	{@const s1Raw = Array.isArray(arrayDetailLog.server1_value)
		? (arrayDetailLog.server1_value as unknown[])
		: []}
	{@const s2Raw = Array.isArray(arrayDetailLog.server2_value)
		? (arrayDetailLog.server2_value as unknown[])
		: []}
	{@const s1 = s1Raw}
	{@const s2 = s2Raw}
	{@const maxLen = Math.max(s1.length, s2.length)}
	{@const rows = Array.from({ length: maxLen }, (_, i) => ({
		index: i,
		v1: i < s1.length ? s1[i] : undefined,
		v2: i < s2.length ? s2[i] : undefined,
		hasV1: i < s1.length,
		hasV2: i < s2.length,
		match:
			i < s1.length &&
			i < s2.length &&
			valuesMatch(s1[i], s2[i], comparatorState.numericTolerancePercent)
	}))}
	{@const filteredRows = rows.filter((r) => {
		if (arrayDetailFilter === 'all') return true;
		if (arrayDetailFilter === 'match') return r.match;
		return !r.match;
	})}
	{@const matchCount = rows.filter((r) => r.match).length}
	{@const matchPct = maxLen > 0 ? Math.round((matchCount / maxLen) * 100) : 0}
	{@const barSegments = 10}
	{@const filledBars = Math.round((matchPct / 100) * barSegments)}
	{@const mismatchCount = rows.filter((r) => r.hasV1 && r.hasV2 && !r.match).length}
	{@const missing1Count = rows.filter((r) => !r.hasV1 && r.hasV2).length}
	{@const missing2Count = rows.filter((r) => r.hasV1 && !r.hasV2).length}
	<div
		class="fixed inset-0 z-110 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl dark:bg-gray-800"
		>
			<div
				class="flex items-start justify-between gap-4 border-b border-gray-100 p-4 dark:border-gray-700"
			>
				<div class="min-w-0">
					<h3 class="text-lg font-semibold text-gray-800 dark:text-white">
						Array Compare:
						<span class="font-mono text-green-600 dark:text-green-400"
							>{arrayDetailLog.key_path}</span
						>
					</h3>
					<div class="mt-2 flex flex-wrap items-center gap-3">
						<span
							class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-bold {matchPct >=
							80
								? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
								: matchPct >= 50
									? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
									: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}"
						>
							{matchPct}% match
						</span>
						<span class="flex items-center gap-0.5">
							{#each Array(barSegments) as _, i (i)}
								<span
									class="h-3 w-2 rounded-sm {i < filledBars
										? 'bg-green-500 dark:bg-green-400'
										: 'bg-gray-200 dark:bg-gray-700'}"
								></span>
							{/each}
						</span>
					</div>
					<div
						class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400"
					>
						<span>{formatTimestamp(arrayDetailLog.timestamp)}</span>
						<span>Server 1: {s1.length}</span>
						<span>Server 2: {s2.length}</span>
						<span class="text-green-600 dark:text-green-400">✓ {matchCount} matched</span>
						<span class="text-red-500">✗ {mismatchCount} diff</span>
						{#if missing2Count > 0}
							<span class="text-orange-500">+{missing2Count} extra S1</span>
						{/if}
						{#if missing1Count > 0}
							<span class="text-orange-500">+{missing1Count} extra S2</span>
						{/if}
					</div>
				</div>
				<button
					aria-label="Close"
					onclick={closeArrayDetail}
					class="shrink-0 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-200"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6"
						fill="none"
						viewBox="0 0 24 24"
						stroke="currentColor"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div
				class="flex shrink-0 items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2 dark:border-gray-700 dark:bg-gray-900/30"
			>
				<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Filter:</span
				>
				<div
					class="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 dark:border-gray-700 dark:bg-gray-800"
				>
					<button
						onclick={() => (arrayDetailFilter = 'all')}
						class="rounded-md px-3 py-1 text-xs font-medium transition-all {arrayDetailFilter ===
						'all'
							? 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-white'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						All ({rows.length})
					</button>
					<button
						onclick={() => (arrayDetailFilter = 'match')}
						class="rounded-md px-3 py-1 text-xs font-medium transition-all {arrayDetailFilter ===
						'match'
							? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Match ({matchCount})
					</button>
					<button
						onclick={() => (arrayDetailFilter = 'mismatch')}
						class="rounded-md px-3 py-1 text-xs font-medium transition-all {arrayDetailFilter ===
						'mismatch'
							? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Diff ({rows.length - matchCount})
					</button>
				</div>
				<div class="ml-auto text-xs text-gray-500 dark:text-gray-400">
					Showing {filteredRows.length} of {rows.length}
				</div>
			</div>

			<div class="min-h-0 flex-1 overflow-auto bg-gray-50/50 p-4 dark:bg-gray-900/30">
				{#if filteredRows.length === 0}
					<div class="py-12 text-center text-sm text-gray-400">No elements to display.</div>
				{:else}
					<table
						class="w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-sm dark:border-gray-700 dark:bg-gray-800"
					>
						<thead>
							<tr
								class="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
							>
								<th
									class="w-16 px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
									>#</th
								>
								<th
									class="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
									>Server 1</th
								>
								<th
									class="px-3 py-2 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
									>Server 2</th
								>
								<th
									class="w-16 px-3 py-2 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
									>Match</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
							{#each filteredRows as row (row.index)}
								<tr class={row.match ? '' : 'bg-red-50/40 dark:bg-red-900/10'}>
									<td class="px-3 py-2 font-mono text-xs text-gray-500 dark:text-gray-400"
										>{row.index}</td
									>
									<td
										class="px-3 py-2 font-mono text-xs break-all text-gray-800 dark:text-gray-200"
									>
										{#if row.hasV1}
											{formatValue(row.v1)}
										{:else}
											<span class="text-gray-400 italic">missing</span>
										{/if}
									</td>
									<td
										class="px-3 py-2 font-mono text-xs break-all text-gray-800 dark:text-gray-200"
									>
										{#if row.hasV2}
											{formatValue(row.v2)}
										{:else}
											<span class="text-gray-400 italic">missing</span>
										{/if}
									</td>
									<td class="px-3 py-2 text-center">
										{#if row.match}
											<span
												class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2.5"
														d="M5 13l4 4L19 7"
													/>
												</svg>
											</span>
										{:else}
											<span
												class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2.5"
														d="M6 18L18 6M6 6l12 12"
													/>
												</svg>
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>

			<div
				class="flex justify-between gap-3 rounded-b-xl border-t border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50"
			>
				<button
					onclick={() => {
						if (arrayDetailLog) openDetail(arrayDetailLog);
						closeArrayDetail();
					}}
					class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
				>
					View Full Response →
				</button>
				<button
					onclick={closeArrayDetail}
					class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700 focus:ring-2 focus:ring-green-500/20 focus:outline-none"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
