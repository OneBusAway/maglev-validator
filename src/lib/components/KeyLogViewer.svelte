<script lang="ts">
	import { endpoints as configuredEndpoints } from '$lib/endpoints';
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { logState } from '$lib/logState.svelte';
	import { fly } from 'svelte/transition';

	import JsonViewer from '$lib/components/JsonViewer.svelte';

	interface KeyLogEntry {
		id: number;
		request_id?: number | null;
		timestamp: string;
		endpoint: string;
		key_path: string;
		server1_value: unknown;
		server2_value: unknown;
		created_at: number;
	}

	let logs = $state<KeyLogEntry[]>([]);
	let loggedEndpoints = $state<string[]>([]);
	let keyPaths = $state<string[]>([]);
	let loading = $state(false);
	let totalCount = $state(0);

	let selectedEndpoint = $state('');
	let selectedKeyPath = $state('');
	let limit = $state(100);
	let timeRange = $state<'live' | '1h' | '24h' | 'all'>('live');
	let filterMode = $state<'all' | 'match' | 'mismatch'>('all');

	let showDetailModal = $state(false);
	let selectedLogEntry = $state<KeyLogEntry | null>(null);
	let selectedRequestLog = $state<{ response1: unknown; response2: unknown } | null>(null);
	let isLoadingDetail = $state(false);

	let syncedExpandedPaths = new SvelteSet<string>();
	let server1ScrollContainer = $state<HTMLElement | undefined>(undefined);
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
		syncedExpandedPaths = new SvelteSet<string>();

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

	const filteredLogs = $derived(
		logs.filter((log) => {
			if (filterMode === 'all') return true;
			const match = valuesMatch(log.server1_value, log.server2_value);
			return filterMode === 'match' ? match : !match;
		})
	);

	onMount(() => {
		fetchLoggedEndpoints();
		fetchCount();
	});

	$effect(() => {
		if (selectedEndpoint) {
			fetchKeyPaths(selectedEndpoint);
			fetchLogs(false);
			fetchCount();
		} else {
			keyPaths = [];
			selectedKeyPath = '';
		}
	});

	$effect(() => {
		if (timeRange === 'live') {
			void logState.lastUpdated;

			untrack(() => {
				if (selectedEndpoint) {
					fetchLogs(true);
					fetchCount();
				}
			});
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
			keyPaths = data.keyPaths || [];
		} catch (e) {
			console.error('Failed to fetch key paths:', e);
		}
	}

	async function fetchCount() {
		try {
			const res = await fetch('/api/keylog?meta=count');
			const data = await res.json();
			totalCount = data.count || 0;
		} catch (e) {
			console.error('Failed to fetch count:', e);
		}
	}

	async function fetchLogs(silent = false) {
		if (!selectedEndpoint) return;

		if (!silent) loading = true;
		try {
			let url = `/api/keylog?endpoint=${encodeURIComponent(selectedEndpoint)}`;

			if (timeRange === 'live') {
				url += `&limit=${limit}`;
			} else if (timeRange !== 'all') {
				const now = new Date();
				let since;
				if (timeRange === '1h') {
					since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
				} else if (timeRange === '24h') {
					since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
				}
				if (since) url += `&since=${encodeURIComponent(since)}`;

				url += `&limit=${1000}`;
			} else {
				url += `&limit=${limit}`;
			}

			if (selectedKeyPath) {
				url += `&keyPath=${encodeURIComponent(selectedKeyPath)}`;
			}

			const res = await fetch(url);
			const data = await res.json();
			logs = data.logs || [];
		} catch (e) {
			console.error('Failed to fetch logs:', e);
		} finally {
			if (!silent) loading = false;
		}
	}

	async function clearLogs() {
		if (!confirm('Are you sure you want to clear all logs?')) return;

		try {
			const url = selectedEndpoint
				? `/api/keylog?endpoint=${encodeURIComponent(selectedEndpoint)}`
				: '/api/keylog';
			await fetch(url, { method: 'DELETE' });
			logs = [];
			await fetchLoggedEndpoints();
			await fetchCount();
		} catch (e) {
			console.error('Failed to clear logs:', e);
		}
	}

	function formatValue(value: unknown): string {
		if (value === null || value === undefined) return '—';
		if (typeof value === 'object') return JSON.stringify(value);
		return String(value);
	}

	function valuesMatch(v1: unknown, v2: unknown): boolean {
		return JSON.stringify(v1) === JSON.stringify(v2);
	}

	function formatTimestamp(ts: string): string {
		try {
			const date = new Date(ts);
			return date.toLocaleString();
		} catch {
			return ts;
		}
	}

	function exportCSV() {
		if (logs.length === 0) return;

		const headers = [
			'Timestamp',
			'Endpoint',
			'Key Path',
			'Server 1 Value',
			'Server 2 Value',
			'Match'
		];
		const rows = logs.map((log) => [
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
		a.download = `keylog-${selectedEndpoint}-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

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
					class="rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
				>
					{totalCount} total logs
				</span>
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
					bind:value={selectedEndpoint}
					class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
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
					Key Path
				</label>
				<select
					id="keypath-select"
					bind:value={selectedKeyPath}
					disabled={!selectedEndpoint}
					class="w-full cursor-pointer appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
				>
					<option value="">All keys</option>
					{#each keyPaths as kp (kp)}
						<option value={kp}>{kp}</option>
					{/each}
				</select>
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
					bind:value={limit}
					min="10"
					max="1000"
					class="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm text-gray-700 transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
				/>
			</div>

			<div class="col-span-4">
				<div
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Filter
				</div>
				<div
					class="flex w-full items-center rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900"
				>
					<button
						onclick={() => (filterMode = 'all')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {filterMode ===
						'all'
							? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						All
					</button>
					<button
						onclick={() => (filterMode = 'match')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {filterMode ===
						'match'
							? 'bg-white text-green-700 shadow-sm dark:bg-green-900/30 dark:text-green-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Match
					</button>
					<button
						onclick={() => (filterMode = 'mismatch')}
						class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all {filterMode ===
						'mismatch'
							? 'bg-white text-red-700 shadow-sm dark:bg-red-900/30 dark:text-red-400'
							: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
					>
						Diff
					</button>
				</div>
			</div>

			<div
				class="col-span-12 flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
			>
				<div class="flex items-center gap-2">
					<div
						class="mr-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>
						Time Range:
					</div>
					<div
						class="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-900"
					>
						{#each ['live', '1h', '24h', 'all'] as range (range)}
							<button
								onclick={() => (timeRange = range as 'live' | '1h' | '24h' | 'all')}
								class="rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-all {timeRange ===
								range
									? 'bg-white text-indigo-700 shadow-sm dark:bg-indigo-900/30 dark:text-indigo-300'
									: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'}"
							>
								{range === '1h' ? 'Last 1h' : range === '24h' ? 'Last 24h' : range}
							</button>
						{/each}
					</div>
					{#if timeRange === 'live'}
						<div
							class="ml-2 flex animate-pulse items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-400"
						>
							<span class="relative flex h-2 w-2">
								<span
									class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
								></span>
								<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
							</span>
							Live
						</div>
					{/if}
				</div>

				<div class="flex items-center gap-3">
					<button
						onclick={exportCSV}
						disabled={logs.length === 0}
						class="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						Export CSV
					</button>

					<button
						onclick={clearLogs}
						class="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-50 dark:border-red-900/30 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
					>
						Clear Logs
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Logs Table -->
	{#if !selectedEndpoint}
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
					<strong class="text-indigo-600">No logs yet.</strong> Enable key watching in the API Comparator
					to start logging.
				{/if}
			</p>
		</div>
	{:else if loading}
		<div
			class="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-16 dark:border-gray-700 dark:bg-gray-800"
		>
			<svg class="h-8 w-8 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
				<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
				></circle>
				<path
					class="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				></path>
			</svg>
		</div>
	{:else if logs.length === 0}
		<div
			class="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white p-16 text-center dark:border-gray-700 dark:bg-gray-800"
		>
			<p class="text-gray-500">No logs found for this endpoint.</p>
		</div>
	{:else}
		<div
			class="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800"
		>
			<div class="overflow-x-auto">
				<table class="w-full">
					<thead>
						<tr
							class="border-b border-gray-100 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50"
						>
							<th
								class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
							>
								Timestamp
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
							>
								Key Path
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
							>
								Server 1
							</th>
							<th
								class="px-4 py-3 text-left text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
							>
								Server 2
							</th>
							<th
								class="px-4 py-3 text-center text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
							>
								Match
							</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-gray-100 dark:divide-gray-700">
						{#each filteredLogs as log (log.id)}
							{@const match = valuesMatch(log.server1_value, log.server2_value)}
							<tr
								in:fly={{ y: -10, duration: 300 }}
								onclick={() => openDetail(log)}
								class="cursor-pointer transition-colors hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10"
							>
								<td class="px-4 py-3 text-sm whitespace-nowrap text-gray-600 dark:text-gray-400">
									{formatTimestamp(log.timestamp)}
								</td>
								<td class="px-4 py-3 font-mono text-sm text-gray-900 dark:text-gray-200">
									{log.key_path}
								</td>
								<td
									class="max-w-xs truncate px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300"
									title={formatValue(log.server1_value)}
								>
									{formatValue(log.server1_value)}
								</td>
								<td
									class="max-w-xs truncate px-4 py-3 font-mono text-sm text-gray-700 dark:text-gray-300"
									title={formatValue(log.server2_value)}
								>
									{formatValue(log.server2_value)}
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
						Log Detail: <span class="font-mono text-indigo-600 dark:text-indigo-400"
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
					class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
