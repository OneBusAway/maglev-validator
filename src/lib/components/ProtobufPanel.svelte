<script lang="ts">
	import { onMount } from 'svelte';
	import ProtobufViewer from '$lib/components/ProtobufViewer.svelte';

	let tripUpdatesUrl = $state('https://webservices.umoiq.com/api/gtfs-rt/v1/trip-updates/unitrans');
	let vehiclePositionsUrl = $state(
		'https://webservices.umoiq.com/api/gtfs-rt/v1/vehicle-positions/unitrans'
	);
	let serviceAlertsUrl = $state(
		'https://webservices.umoiq.com/api/gtfs-rt/v1/service-alerts/unitrans'
	);
	let headers = $state<{ key: string; value: string }[]>([{ key: '', value: '' }]);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);
	let feedData = $state<{
		header: unknown;
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		entityCount: number;
	} | null>(null);

	let autoRefresh = $state(false);
	let refreshInterval = $state(30);
	let refreshTimer: number | undefined = undefined;
	let lastFetchTime = $state<Date | null>(null);

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			if (localStorage.tripUpdatesUrl) tripUpdatesUrl = localStorage.tripUpdatesUrl;
			if (localStorage.vehiclePositionsUrl) vehiclePositionsUrl = localStorage.vehiclePositionsUrl;
			if (localStorage.serviceAlertsUrl) serviceAlertsUrl = localStorage.serviceAlertsUrl;
			if (localStorage.protobufHeaders) {
				try {
					headers = JSON.parse(localStorage.protobufHeaders);
				} catch {
					headers = [{ key: '', value: '' }];
				}
			}
		}
	});

	$effect(() => {
		if (autoRefresh) {
			startAutoRefresh();
		} else {
			stopAutoRefresh();
		}
		return () => stopAutoRefresh();
	});

	function addHeader() {
		headers = [...headers, { key: '', value: '' }];
	}

	function removeHeader(index: number) {
		headers = headers.filter((_, i) => i !== index);
	}

	function updateHeader(index: number, field: 'key' | 'value', value: string) {
		headers = headers.map((h, i) => (i === index ? { ...h, [field]: value } : h));
	}

	function saveToLocalStorage() {
		if (typeof localStorage !== 'undefined') {
			localStorage.tripUpdatesUrl = tripUpdatesUrl;
			localStorage.vehiclePositionsUrl = vehiclePositionsUrl;
			localStorage.serviceAlertsUrl = serviceAlertsUrl;
			localStorage.protobufHeaders = JSON.stringify(headers);
		}
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		fetchAllFeeds();
		refreshTimer = window.setInterval(() => {
			fetchAllFeeds();
		}, refreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (refreshTimer !== undefined) {
			clearInterval(refreshTimer);
			refreshTimer = undefined;
		}
	}

	async function fetchSingleFeed(url: string): Promise<{
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		header: unknown;
	} | null> {
		if (!url) return null;

		const response = await fetch('/api/protobuf', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				url,
				headers: headers.filter((h) => h.key && h.value)
			})
		});

		const data = await response.json();
		if (data.error) throw new Error(data.error);
		return data;
	}

	async function fetchAllFeeds() {
		const hasAnyUrl = tripUpdatesUrl || vehiclePositionsUrl || serviceAlertsUrl;
		if (!hasAnyUrl) {
			error = 'Please enter at least one feed URL';
			return;
		}

		loading = true;
		error = undefined;
		saveToLocalStorage();

		try {
			const results = await Promise.allSettled([
				fetchSingleFeed(tripUpdatesUrl),
				fetchSingleFeed(vehiclePositionsUrl),
				fetchSingleFeed(serviceAlertsUrl)
			]);

			const tripData = results[0].status === 'fulfilled' ? results[0].value : null;
			const vehicleData = results[1].status === 'fulfilled' ? results[1].value : null;
			const alertData = results[2].status === 'fulfilled' ? results[2].value : null;

			// Collect errors
			const errors: string[] = [];
			if (tripUpdatesUrl && results[0].status === 'rejected') {
				errors.push(`Trip Updates: ${results[0].reason?.message || 'Failed'}`);
			}
			if (vehiclePositionsUrl && results[1].status === 'rejected') {
				errors.push(`Vehicle Positions: ${results[1].reason?.message || 'Failed'}`);
			}
			if (serviceAlertsUrl && results[2].status === 'rejected') {
				errors.push(`Service Alerts: ${results[2].reason?.message || 'Failed'}`);
			}

			if (errors.length > 0 && !tripData && !vehicleData && !alertData) {
				error = errors.join('; ');
				return;
			}

			// Merge all data
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

			feedData = {
				header,
				tripUpdates: allTripUpdates,
				vehiclePositions: allVehiclePositions,
				alerts: allAlerts,
				entityCount: allTripUpdates.length + allVehiclePositions.length + allAlerts.length
			};

			if (errors.length > 0) {
				error = `Partial success. Errors: ${errors.join('; ')}`;
			}

			lastFetchTime = new Date();
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800"
>
	<div class="space-y-6 p-6">
		<!-- Feed URLs -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
				>
					<span class="flex items-center gap-2"> 🚌 Trip Updates URL </span>
					<input
						type="text"
						bind:value={tripUpdatesUrl}
						placeholder="https://example.com/gtfs-rt/trip-updates"
						class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600 dark:focus:ring-blue-500/40"
					/>
				</label>
			</div>
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
				>
					<span class="flex items-center gap-2"> 📍 Vehicle Positions URL </span>
					<input
						type="text"
						bind:value={vehiclePositionsUrl}
						placeholder="https://example.com/gtfs-rt/vehicle-positions"
						class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600 dark:focus:ring-blue-500/40"
					/>
				</label>
			</div>
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
				>
					<span class="flex items-center gap-2"> ⚠️ Service Alerts URL </span>
					<input
						type="text"
						bind:value={serviceAlertsUrl}
						placeholder="https://example.com/gtfs-rt/service-alerts"
						class="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600 dark:focus:ring-blue-500/40"
					/>
				</label>
			</div>
		</div>

		<!-- Headers -->
		<div>
			<div class="mb-2 flex items-center justify-between">
				<span
					class="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>Custom Headers (API Key, etc.)</span
				>
				<button
					onclick={addHeader}
					class="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
				>
					+ Add Header
				</button>
			</div>
			<div class="space-y-2">
				{#each headers as header, index (index)}
					<div class="flex items-center gap-2">
						<input
							type="text"
							value={header.key}
							oninput={(e) => updateHeader(index, 'key', e.currentTarget.value)}
							placeholder="Header Name (e.g., x-api-key)"
							class="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600"
						/>
						<input
							type="text"
							value={header.value}
							oninput={(e) => updateHeader(index, 'value', e.currentTarget.value)}
							placeholder="Header Value"
							class="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600"
						/>
						{#if headers.length > 1}
							<button
								onclick={() => removeHeader(index)}
								class="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
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
			class="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700"
		>
			<div class="flex items-center gap-4">
				<label class="flex cursor-pointer items-center gap-2 select-none">
					<input
						type="checkbox"
						bind:checked={autoRefresh}
						class="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-700"
					/>
					<span class="text-sm font-medium text-slate-600 dark:text-slate-400">Auto-refresh</span>
				</label>
				{#if autoRefresh}
					<div class="flex items-center gap-2">
						<input
							type="number"
							bind:value={refreshInterval}
							min="5"
							max="300"
							class="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
						/>
						<span class="text-xs text-slate-400">sec</span>
					</div>
				{/if}
				{#if lastFetchTime}
					<span class="text-xs text-slate-400">
						Last fetched: {lastFetchTime.toLocaleTimeString()}
					</span>
				{/if}
			</div>

			<button
				onclick={fetchAllFeeds}
				disabled={loading}
				class="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 font-medium text-white transition-all hover:bg-blue-700 hover:shadow-lg active:scale-[0.98] disabled:bg-blue-400 disabled:shadow-none"
			>
				{#if loading}
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
					Fetch All Feeds
				{/if}
			</button>
		</div>
	</div>
</div>

{#if error}
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
			<p class="text-sm text-red-700 dark:text-red-300">{error}</p>
		</div>
	</div>
{/if}

{#if feedData}
	<div class="mb-4">
		<h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">
			GTFS Realtime Feed Data
		</h2>
	</div>
	<ProtobufViewer
		tripUpdates={feedData.tripUpdates}
		vehiclePositions={feedData.vehiclePositions}
		alerts={feedData.alerts}
		header={feedData.header}
		entityCount={feedData.entityCount}
	/>
{:else if !loading}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-16 text-center transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800"
	>
		<div
			class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-900"
		>
			📡
		</div>
		<h3 class="mb-2 text-xl font-semibold text-slate-800 dark:text-white">
			GTFS Realtime Protobuf Reader
		</h3>
		<p class="mb-4 max-w-md text-slate-500">
			Enter your GTFS Realtime feed URLs above. You can use any combination of Trip Updates, Vehicle
			Positions, and Service Alerts feeds.
		</p>
	</div>
{/if}
