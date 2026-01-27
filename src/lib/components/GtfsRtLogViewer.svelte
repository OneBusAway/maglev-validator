<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import ProtobufViewer from './ProtobufViewer.svelte';
	import { fly, fade } from 'svelte/transition';
	import { logState } from '$lib/logState.svelte';

	interface GtfsRtSnapshotEntry {
		id: number;
		timestamp: string;
		data: string;
		created_at: number;
	}

	let snapshots = $state<GtfsRtSnapshotEntry[]>([]);
	let loading = $state(false);
	let selectedSnapshotId = $state<number | null>(null);
	let showDetail = $state(false);
	let limit = $state(100);
	let timeRange = $state<'live' | '1h' | '24h' | 'all'>('live');
	let totalSnapshots = $state<number | null>(null);
	let totalSnapshotsLoading = $state(false);

	onMount(() => {
		fetchSnapshots();
	});

	$effect(() => {
		void logState.lastUpdated;
		untrack(() => {
			if (timeRange === 'live') {
				fetchSnapshots(true);
			}
		});
	});

	async function fetchTotalSnapshots() {
		totalSnapshotsLoading = true;
		try {
			const totalRes = await fetch('/api/gtfs-rt?type=snapshot&limit=0');
			const totalData = await totalRes.json();
			totalSnapshots = totalData.totalCount ?? totalData.total_snapshots ?? null;
		} catch (e) {
			totalSnapshots = null;
			console.error(e);
		} finally {
			totalSnapshotsLoading = false;
		}
	}

	async function fetchSnapshots(silent = false) {
		if (!silent) loading = true;
		try {
			let url = `/api/gtfs-rt?type=snapshot`;
			const now = new Date();
			let since;
			if (timeRange === 'live') {
				url += `&limit=${limit}`;
			} else if (timeRange !== 'all') {
				if (timeRange === '1h') {
					since = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
				} else if (timeRange === '24h') {
					since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
				}
				if (since) url += `&since=${encodeURIComponent(since)}`;
				url += `&limit=1000`;
			} else {
				url += `&limit=${limit}`;
			}
			const res = await fetch(url);
			const data = await res.json();
			snapshots = data.snapshots || [];
			if (data.totalCount !== undefined) {
				totalSnapshots = data.totalCount;
			} else if (data.total_snapshots !== undefined) {
				totalSnapshots = data.total_snapshots;
			} else {
				if (!totalSnapshotsLoading) fetchTotalSnapshots();
			}
		} catch (e) {
			console.error('Failed to fetch GTFS-RT snapshots:', e);
		} finally {
			if (!silent) loading = false;
		}
	}

	$effect(() => {
		void limit;
		void timeRange;
		untrack(() => fetchSnapshots());
	});

	function openDetail(id: number) {
		selectedSnapshotId = id;
		showDetail = true;
	}

	function formatTimestamp(ts: string) {
		return new Date(ts).toLocaleString();
	}

	const selectedData = $derived.by(() => {
		const snapshot = snapshots.find((s) => s.id === selectedSnapshotId);
		if (!snapshot) return null;
		try {
			return JSON.parse(snapshot.data);
		} catch (e) {
			console.error('Failed to parse snapshot data:', e);
			return null;
		}
	});

	async function clearSnapshots() {
		if (!confirm('Are you sure you want to clear all snapshots?')) return;
		try {
			await fetch('/api/gtfs-rt?type=snapshot', { method: 'DELETE' });
			snapshots = [];
			selectedSnapshotId = null;
		} catch (e) {
			console.error('Failed to clear snapshots:', e);
		}
	}
</script>

<div class="space-y-6">
	<div
		class="rounded-xl border border-gray-800 bg-gray-900 p-6 shadow-md transition-colors dark:border-gray-600"
	>
		<div class="mb-5 flex items-center justify-between">
			<div>
				<h2 class="text-lg font-semibold text-white">GTFS-RT Snapshot History</h2>
				<p class="text-sm text-gray-400">
					Track full system state captures across all real-time feeds
				</p>
			</div>
			<span class="rounded-full bg-indigo-900/40 px-3 py-1 text-sm font-medium text-indigo-300">
				{#if totalSnapshotsLoading}
					Loading...
				{:else if totalSnapshots !== null}
					{totalSnapshots} total snapshots
				{:else}
					{snapshots.length} snapshots
				{/if}
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-12">
			<div class="sm:col-span-5 md:col-span-4 lg:col-span-3">
				<label
					for="time-range-input"
					class="mb-1.5 block text-xs font-semibold tracking-wide text-gray-400 uppercase"
				>
					Time Range
				</label>
				<div class="flex items-center">
					<div
						id="time-range-input"
						class="flex flex-wrap gap-1.5 rounded-lg border border-gray-700 bg-gray-800 p-1"
					>
						{#each ['live', '1h', '24h', 'all'] as range (range)}
							<button
								onclick={() => (timeRange = range as 'live' | '1h' | '24h' | 'all')}
								class="flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all sm:flex-none
                                       {timeRange === range
									? 'bg-indigo-600 text-white shadow'
									: 'text-gray-300 hover:bg-gray-700'}"
							>
								{range === '1h'
									? 'Last 1h'
									: range === '24h'
										? 'Last 24h'
										: range === 'all'
											? 'All'
											: 'Live'}
							</button>
						{/each}
					</div>
					{#if timeRange === 'live'}
						<div
							class="ml-2 flex items-center gap-1.5 text-xs font-medium whitespace-nowrap text-green-400"
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
			</div>

			<div class="sm:col-span-3 md:col-span-2">
				<label
					for="limit-input"
					class="mb-1.5 block text-xs font-semibold tracking-wide text-gray-400 uppercase"
				>
					Rows
				</label>
				<input
					id="limit-input"
					type="number"
					bind:value={limit}
					min="10"
					max="1000"
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm text-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 focus:outline-none"
				/>
			</div>

			<div class="flex items-end justify-end gap-3 sm:col-span-4 md:col-span-7">
				<button
					onclick={() => fetchSnapshots()}
					disabled={loading}
					class="rounded-lg border border-gray-700 bg-gray-800 px-5 py-2.5 text-sm font-medium text-gray-200 hover:bg-gray-700 disabled:opacity-50"
				>
					Refresh
				</button>
				<button
					onclick={clearSnapshots}
					class="rounded-lg border border-red-800/50 bg-gray-800 px-5 py-2.5 text-sm font-medium text-red-400 hover:bg-red-900/30"
				>
					Clear History
				</button>
			</div>
		</div>
	</div>

	{#if snapshots.length === 0 && !loading}
		<div class="rounded-xl border border-gray-800 bg-gray-900 p-16 text-center">
			<div
				class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-800 text-gray-500"
			>
				<svg class="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
					/>
				</svg>
			</div>
			<h3 class="mb-2 text-xl font-semibold text-white">No Snapshots Found</h3>
			<p class="text-gray-400">Fetches in the "GTFS Realtime" tab will appear here.</p>
		</div>
	{:else}
		<div
			class="relative h-[70vh] overflow-y-auto rounded-b-xl border border-t-0 border-gray-800 bg-gray-900 p-6 pt-8 shadow-md"
		>
			<div class="absolute top-0 bottom-0 left-6 w-0.5 bg-gray-700"></div>

			{#each snapshots as snapshot (snapshot.id)}
				{@const data = JSON.parse(snapshot.data)}
				<div class="group relative pb-4 last:pb-0">
					<button
						onclick={() => openDetail(snapshot.id)}
						class="group w-full rounded-lg border border-gray-800 bg-gray-800/60 p-4 text-left transition-all hover:border-indigo-600/60 hover:bg-gray-800 hover:shadow-md"
					>
						<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div class="flex flex-col gap-6 sm:flex-row sm:items-center">
								<div class="min-w-35">
									<div class="text-xs font-bold tracking-wide text-gray-500 uppercase">
										Timestamp
									</div>
									<div class="mt-0.5 text-sm font-medium text-gray-200">
										{formatTimestamp(snapshot.timestamp)}
									</div>
								</div>

								<div class="flex flex-wrap gap-6 border-l border-gray-700 pl-6">
									<div class="min-w-15">
										<div class="text-xs font-bold tracking-wide text-gray-500 uppercase">Trips</div>
										<div
											class="text-xl font-black {data.tripUpdates?.length
												? 'text-blue-400'
												: 'text-gray-600'}"
										>
											{data.tripUpdates?.length || 0}
										</div>
									</div>
									<div class="min-w-15">
										<div class="text-xs font-bold tracking-wide text-gray-500 uppercase">
											Vehicles
										</div>
										<div
											class="text-xl font-black {data.vehiclePositions?.length
												? 'text-green-400'
												: 'text-gray-600'}"
										>
											{data.vehiclePositions?.length || 0}
										</div>
									</div>
									<div class="min-w-15">
										<div
											class="text-xs font-bold tracking-wide uppercase {data.alerts?.length
												? 'text-red-300'
												: 'text-gray-500'}"
										>
											Alerts
										</div>
										<div
											class="text-xl font-black {data.alerts?.length
												? 'text-red-500'
												: 'text-gray-600'}"
										>
											{data.alerts?.length || 0}
										</div>
									</div>
								</div>
							</div>

							<div
								class="flex items-center gap-2 text-indigo-400 opacity-70 transition-opacity group-hover:opacity-100"
							>
								<span class="hidden text-xs font-black tracking-wider uppercase sm:inline"
									>Inspect</span
								>
								<div
									class="rounded-lg bg-indigo-900/30 p-2 transition-colors group-hover:bg-indigo-600 group-hover:text-white"
								>
									<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
										/>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
										/>
									</svg>
								</div>
							</div>
						</div>
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

{#if showDetail && selectedData}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm sm:p-6"
		transition:fade={{ duration: 150 }}
	>
		<div
			class="flex h-[96vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl sm:max-w-400"
			in:fly={{ y: 30, duration: 250 }}
		>
			<div
				class="flex items-center justify-between border-b border-gray-800 bg-gray-950/50 px-6 py-4"
			>
				<div class="flex items-center gap-4">
					<div class="rounded-xl bg-indigo-600 p-2.5 text-white">
						<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<div>
						<h3 class="text-lg font-bold text-white">Snapshot Detail</h3>
						<p class="text-xs text-indigo-400">
							{formatTimestamp(snapshots.find((s) => s.id === selectedSnapshotId)?.timestamp || '')}
						</p>
					</div>
				</div>
				<button
					onclick={() => (showDetail = false)}
					class="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white"
					aria-label="Close modal"
				>
					<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						/>
					</svg>
				</button>
			</div>

			<div class="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
				<ProtobufViewer
					header={selectedData.header}
					tripUpdates={selectedData.tripUpdates}
					vehiclePositions={selectedData.vehiclePositions}
					alerts={selectedData.alerts}
					entityCount={selectedData.entityCount}
					rawTextTripUpdates={selectedData.rawTextTripUpdates || ''}
					rawTextVehiclePositions={selectedData.rawTextVehiclePositions || ''}
					rawTextAlerts={selectedData.rawTextAlerts || ''}
				/>
			</div>

			<div class="flex justify-end border-t border-gray-800 bg-gray-950/50 px-6 py-4">
				<button
					onclick={() => (showDetail = false)}
					class="rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	::-webkit-scrollbar {
		width: 6px;
	}
	::-webkit-scrollbar-track {
		background: transparent;
	}
	::-webkit-scrollbar-thumb {
		background: rgba(120, 120, 140, 0.5);
		border-radius: 3px;
	}
	::-webkit-scrollbar-thumb:hover {
		background: rgba(150, 150, 180, 0.8);
	}
</style>
