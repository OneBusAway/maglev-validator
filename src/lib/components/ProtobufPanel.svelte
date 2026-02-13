<script lang="ts">
	import ProtobufViewer from '$lib/components/ProtobufViewer.svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { logState } from '$lib/logState.svelte';
	import { protobufState as pbState } from '$lib/panelState.svelte';

	function handleKeyDown(e: KeyboardEvent) {
		if (e.ctrlKey && e.key === 'Enter' && !pbState.loading) {
			e.preventDefault();
			fetchAllFeeds();
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKeyDown);

		if (typeof localStorage !== 'undefined') {
			const hasState =
				pbState.tripUpdatesUrl || pbState.vehiclePositionsUrl || pbState.serviceAlertsUrl;

			if (!hasState) {
				if (localStorage.tripUpdatesUrl) pbState.tripUpdatesUrl = localStorage.tripUpdatesUrl;
				if (localStorage.vehiclePositionsUrl)
					pbState.vehiclePositionsUrl = localStorage.vehiclePositionsUrl;
				if (localStorage.serviceAlertsUrl) pbState.serviceAlertsUrl = localStorage.serviceAlertsUrl;

				if (localStorage.protobufHeaders) {
					try {
						pbState.headers = JSON.parse(localStorage.protobufHeaders);
					} catch {
						pbState.headers = [{ key: '', value: '' }];
					}
				}
				if (localStorage.gtfsRtLoggingEnabled !== undefined) {
					pbState.loggingEnabled = localStorage.gtfsRtLoggingEnabled === 'true';
				}
			}
		}
	});

	onDestroy(() => {
		if (browser) {
			window.removeEventListener('keydown', handleKeyDown);
		}
		stopAutoRefresh();
	});

	$effect(() => {
		if (pbState.autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
		return () => stopAutoRefresh();
	});

	function addHeader() {
		pbState.headers = [...pbState.headers, { key: '', value: '' }];
	}

	function removeHeader(index: number) {
		pbState.headers = pbState.headers.filter((_, i) => i !== index);
	}

	function updateHeader(index: number, field: 'key' | 'value', value: string) {
		pbState.headers = pbState.headers.map((h, i) => (i === index ? { ...h, [field]: value } : h));
	}

	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.tripUpdatesUrl = pbState.tripUpdatesUrl;
			localStorage.vehiclePositionsUrl = pbState.vehiclePositionsUrl;
			localStorage.serviceAlertsUrl = pbState.serviceAlertsUrl;
			localStorage.protobufHeaders = JSON.stringify(pbState.headers);
			localStorage.gtfsRtLoggingEnabled = String(pbState.loggingEnabled);
		}
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		if (!pbState.feedData) fetchAllFeeds();

		pbState.refreshTimer = window.setInterval(() => {
			fetchAllFeeds();
		}, pbState.refreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (pbState.refreshTimer !== undefined) {
			clearInterval(pbState.refreshTimer);
			pbState.refreshTimer = undefined;
		}
	}

	async function fetchSingleFeed(
		url: string,
		sessionId?: string
	): Promise<{
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		header: unknown;
		totals?: { tripUpdates: number; vehiclePositions: number; alerts: number };
		limited?: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean };
		pagination?: {
			limit: number;
			offset: { tripUpdates: number; vehiclePositions: number; alerts: number };
			hasMore: { tripUpdates: boolean; vehiclePositions: boolean; alerts: boolean };
		};
	} | null> {
		if (!url) return null;

		const response = await fetch('/api/protobuf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url,
				headers: pbState.headers.filter((h) => h.key && h.value),
				sessionId
			})
		});

		const data = await response.json();
		if (data.error) throw new Error(data.error);
		return data;
	}

	async function fetchAllFeeds() {
		const hasAnyUrl =
			pbState.tripUpdatesUrl || pbState.vehiclePositionsUrl || pbState.serviceAlertsUrl;
		if (!hasAnyUrl) {
			pbState.error = 'Please enter at least one feed URL';
			return;
		}

		pbState.loading = true;
		pbState.error = undefined;
		saveToLocalStorage();

		const sessionId = crypto.randomUUID();

		try {
			const results = await Promise.allSettled([
				fetchSingleFeed(pbState.tripUpdatesUrl, sessionId),
				fetchSingleFeed(pbState.vehiclePositionsUrl, sessionId),
				fetchSingleFeed(pbState.serviceAlertsUrl, sessionId)
			]);

			const tripData = results[0].status === 'fulfilled' ? results[0].value : null;
			const vehicleData = results[1].status === 'fulfilled' ? results[1].value : null;
			const alertData = results[2].status === 'fulfilled' ? results[2].value : null;

			const errors: string[] = [];
			if (pbState.tripUpdatesUrl && results[0].status === 'rejected') {
				errors.push(`Trip Updates: ${results[0].reason?.message || 'Failed'}`);
			}
			if (pbState.vehiclePositionsUrl && results[1].status === 'rejected') {
				errors.push(`Vehicle Positions: ${results[1].reason?.message || 'Failed'}`);
			}
			if (pbState.serviceAlertsUrl && results[2].status === 'rejected') {
				errors.push(`Service Alerts: ${results[2].reason?.message || 'Failed'}`);
			}

			if (errors.length > 0 && !tripData && !vehicleData && !alertData) {
				pbState.error = errors.join('; ');
				return;
			}

			const allTripUpdates = [
				...(tripData?.tripUpdates || []),
				...(vehicleData?.tripUpdates || []),
				...(alertData?.tripUpdates || [])
			];

			const allVehiclePositions = [
				...(tripData?.vehiclePositions || []),
				...(vehicleData?.vehiclePositions || []),
				...(alertData?.vehiclePositions || [])
			];

			const allAlerts = [
				...(tripData?.alerts || []),
				...(vehicleData?.alerts || []),
				...(alertData?.alerts || [])
			];

			const header = tripData?.header || vehicleData?.header || alertData?.header;

			const totals = {
				tripUpdates:
					(tripData?.totals?.tripUpdates || tripData?.tripUpdates?.length || 0) +
					(vehicleData?.totals?.tripUpdates || vehicleData?.tripUpdates?.length || 0) +
					(alertData?.totals?.tripUpdates || alertData?.tripUpdates?.length || 0),
				vehiclePositions:
					(tripData?.totals?.vehiclePositions || tripData?.vehiclePositions?.length || 0) +
					(vehicleData?.totals?.vehiclePositions || vehicleData?.vehiclePositions?.length || 0) +
					(alertData?.totals?.vehiclePositions || alertData?.vehiclePositions?.length || 0),
				alerts:
					(tripData?.totals?.alerts || tripData?.alerts?.length || 0) +
					(vehicleData?.totals?.alerts || vehicleData?.alerts?.length || 0) +
					(alertData?.totals?.alerts || alertData?.alerts?.length || 0)
			};

			const limited = {
				tripUpdates: !!(
					tripData?.limited?.tripUpdates ||
					vehicleData?.limited?.tripUpdates ||
					alertData?.limited?.tripUpdates
				),
				vehiclePositions: !!(
					tripData?.limited?.vehiclePositions ||
					vehicleData?.limited?.vehiclePositions ||
					alertData?.limited?.vehiclePositions
				),
				alerts: !!(
					tripData?.limited?.alerts ||
					vehicleData?.limited?.alerts ||
					alertData?.limited?.alerts
				)
			};

			pbState.paginationState = {
				hasMore: {
					tripUpdates: !!(
						tripData?.pagination?.hasMore?.tripUpdates ||
						vehicleData?.pagination?.hasMore?.tripUpdates ||
						alertData?.pagination?.hasMore?.tripUpdates
					),
					vehiclePositions: !!(
						tripData?.pagination?.hasMore?.vehiclePositions ||
						vehicleData?.pagination?.hasMore?.vehiclePositions ||
						alertData?.pagination?.hasMore?.vehiclePositions
					),
					alerts: !!(
						tripData?.pagination?.hasMore?.alerts ||
						vehicleData?.pagination?.hasMore?.alerts ||
						alertData?.pagination?.hasMore?.alerts
					)
				},
				loading: { tripUpdates: false, vehiclePositions: false, alerts: false }
			};

			pbState.currentFetchUrls = {
				tripUpdates: pbState.tripUpdatesUrl,
				vehiclePositions: pbState.vehiclePositionsUrl,
				alerts: pbState.serviceAlertsUrl
			};

			pbState.feedData = {
				header,
				tripUpdates: allTripUpdates,
				vehiclePositions: allVehiclePositions,
				alerts: allAlerts,
				entityCount: allTripUpdates.length + allVehiclePositions.length + allAlerts.length,
				totals,
				limited
			};

			if (errors.length > 0) {
				pbState.error = `Partial success. Errors: ${errors.join('; ')}`;
			}

			if (pbState.feedData && pbState.loggingEnabled) {
				await fetch('/api/gtfs-rt', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						timestamp: new Date().toISOString(),
						data: {
							header: pbState.feedData.header,
							tripUpdates: pbState.feedData.tripUpdates,
							vehiclePositions: pbState.feedData.vehiclePositions,
							alerts: pbState.feedData.alerts,
							entityCount: pbState.feedData.entityCount,
							totals: pbState.feedData.totals,
							limited: pbState.feedData.limited
						}
					})
				});
				logState.triggerUpdate();
			}

			pbState.lastFetchTime = new Date();
		} catch (e) {
			pbState.error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			pbState.loading = false;
		}
	}

	async function loadMoreEntities(entityType: 'tripUpdates' | 'vehiclePositions' | 'alerts') {
		if (
			!pbState.feedData ||
			pbState.paginationState.loading[entityType] ||
			!pbState.paginationState.hasMore[entityType]
		) {
			return;
		}

		pbState.paginationState.loading[entityType] = true;

		try {
			const url =
				entityType === 'tripUpdates'
					? pbState.currentFetchUrls.tripUpdates
					: entityType === 'vehiclePositions'
						? pbState.currentFetchUrls.vehiclePositions
						: pbState.currentFetchUrls.alerts;

			if (!url) {
				pbState.paginationState.loading[entityType] = false;
				return;
			}

			const currentOffset = (pbState.feedData[entityType] as unknown[])?.length || 0;

			const response = await fetch('/api/protobuf', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url,
					headers: pbState.headers.filter((h) => h.key && h.value),
					offset: {
						tripUpdates: entityType === 'tripUpdates' ? currentOffset : 0,
						vehiclePositions: entityType === 'vehiclePositions' ? currentOffset : 0,
						alerts: entityType === 'alerts' ? currentOffset : 0
					}
				})
			});

			const data = await response.json();
			if (data.error) throw new Error(data.error);

			if (entityType === 'tripUpdates' && data.tripUpdates) {
				pbState.feedData.tripUpdates = [
					...(pbState.feedData.tripUpdates || []),
					...data.tripUpdates
				];
			} else if (entityType === 'vehiclePositions' && data.vehiclePositions) {
				pbState.feedData.vehiclePositions = [
					...(pbState.feedData.vehiclePositions || []),
					...data.vehiclePositions
				];
			} else if (entityType === 'alerts' && data.alerts) {
				pbState.feedData.alerts = [...(pbState.feedData.alerts || []), ...data.alerts];
			}

			if (pbState.feedData.limited) {
				pbState.feedData.limited[entityType] = data.pagination?.hasMore?.[entityType] ?? false;
			}

			pbState.paginationState.hasMore[entityType] = data.pagination?.hasMore?.[entityType] ?? false;
		} catch (e) {
			console.error(`Failed to load more ${entityType}:`, e);
		} finally {
			pbState.paginationState.loading[entityType] = false;
		}
	}
</script>

<div
	class="mb-6 rounded-xl border border-gray-200 bg-white shadow-sm transition-colors duration-300 dark:border-gray-700 dark:bg-gray-800"
>
	<div class="space-y-6 p-6">
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Trip Updates URL
					<input
						type="text"
						bind:value={pbState.tripUpdatesUrl}
						placeholder="https://example.com/gtfs-rt/trip-updates"
						class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-indigo-500/40"
					/>
				</label>
			</div>
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Vehicle Positions URL
					<input
						type="text"
						bind:value={pbState.vehiclePositionsUrl}
						placeholder="https://example.com/gtfs-rt/vehicle-positions"
						class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-indigo-500/40"
					/>
				</label>
			</div>
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
				>
					Service Alerts URL
					<input
						type="text"
						bind:value={pbState.serviceAlertsUrl}
						placeholder="https://example.com/gtfs-rt/service-alerts"
						class="mt-2 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600 dark:focus:ring-indigo-500/40"
					/>
				</label>
			</div>
		</div>

		<div>
			<div class="mb-2 flex items-center justify-between">
				<span class="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400"
					>Custom Headers (API Key, etc.)</span
				>
				<button
					onclick={addHeader}
					class="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-blue-300"
				>
					+ Add Header
				</button>
			</div>
			<div class="space-y-2">
				{#each pbState.headers as header, index (index)}
					<div class="flex items-center gap-2">
						<input
							type="text"
							value={header.key}
							oninput={(e) => updateHeader(index, 'key', e.currentTarget.value)}
							placeholder="Header Name (e.g., x-api-key)"
							class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600"
						/>
						<input
							type="text"
							value={header.value}
							oninput={(e) => updateHeader(index, 'value', e.currentTarget.value)}
							placeholder="Header Value"
							class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 font-mono text-sm text-gray-700 transition-all placeholder:text-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:placeholder:text-gray-600"
						/>
						{#if pbState.headers.length > 1}
							<button
								onclick={() => removeHeader(index)}
								class="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
								title="Remove header"
							>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									class="h-5 w-5"
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
						{/if}
					</div>
				{/each}
			</div>
		</div>

		<div
			class="flex items-center justify-between border-t border-gray-100 pt-4 dark:border-gray-700"
		>
			<div class="flex items-center gap-4">
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={pbState.autoRefresh}
						class="h-4 w-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Auto-refresh</span>
				</label>
				{#if pbState.autoRefresh}
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={pbState.refreshInterval}
							min="5"
							max="300"
							class="w-16 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-gray-700 focus:border-indigo-500 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
						/>
						<span class="text-xs text-gray-400">sec</span>
					</div>
				{/if}
				<div class="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={pbState.loggingEnabled}
						onchange={saveToLocalStorage}
						class="h-4 w-4 rounded border-gray-300 bg-white text-indigo-600 focus:ring-indigo-500 focus:ring-offset-0 dark:border-gray-600 dark:bg-gray-700"
					/>
					<span class="text-sm font-medium text-gray-600 dark:text-gray-400">Enable logging</span>
				</label>
				{#if pbState.lastFetchTime}
					<span class="text-xs text-gray-400">
						Last fetched: {pbState.lastFetchTime?.toLocaleTimeString()}
					</span>
				{/if}
			</div>

			<button
				onclick={fetchAllFeeds}
				disabled={pbState.loading}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-indigo-700 hover:shadow-lg active:scale-[0.98] disabled:bg-indigo-400 disabled:shadow-none"
				title="Fetch All Feeds (Ctrl+Enter)"
			>
				{#if pbState.loading}
					<svg
						class="h-4 w-4 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Fetching...
				{:else}
					<span>Fetch All Feeds</span>
					<kbd class="ml-1 rounded bg-indigo-500 px-1.5 py-0.5 text-xs font-normal">Ctrl+↵</kbd>
				{/if}
			</button>
		</div>
	</div>
</div>

{#if pbState.error}
	<div
		class="mb-6 flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/20 dark:bg-red-900/10"
	>
		<div
			class="rounded-lg border border-red-100 bg-white p-2 font-bold text-red-500 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
		>
			!
		</div>
		<div>
			<h3 class="mb-1 font-semibold text-red-900 dark:text-red-200">Request Failed</h3>
			<p class="text-sm text-red-700 dark:text-red-300">{pbState.error}</p>
		</div>
	</div>
{/if}

{#if pbState.feedData}
	<div class="mb-4">
		<h2 class="text-lg font-semibold text-gray-800 dark:text-gray-100">GTFS Realtime Feed Data</h2>
	</div>
	<ProtobufViewer
		tripUpdates={pbState.feedData.tripUpdates}
		vehiclePositions={pbState.feedData.vehiclePositions}
		alerts={pbState.feedData.alerts}
		header={pbState.feedData.header}
		entityCount={pbState.feedData.entityCount}
		totals={pbState.feedData.totals}
		limited={pbState.feedData.limited}
		onLoadMore={loadMoreEntities}
		paginationLoading={pbState.paginationState.loading}
		hasMorePages={pbState.paginationState.hasMore}
	/>
{:else if !pbState.loading}
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
					d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
				></path>
			</svg>
		</div>
		<h3 class="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
			GTFS Realtime Protobuf Reader
		</h3>
		<p class="mb-4 max-w-md text-gray-500">
			Enter your GTFS Realtime feed URLs above. You can use any combination of Trip Updates, Vehicle
			Positions, and Service Alerts feeds.
		</p>
	</div>
{/if}
