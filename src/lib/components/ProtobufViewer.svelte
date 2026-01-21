<script lang="ts">
	import SimpleJsonTree from './SimpleJsonTree.svelte';

	interface Props {
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		header: unknown;
		entityCount: number;
		rawTextTripUpdates: string;
		rawTextVehiclePositions: string;
		rawTextAlerts: string;
	}

	let {
		tripUpdates,
		vehiclePositions,
		alerts,
		header,
		entityCount,
		rawTextTripUpdates,
		rawTextVehiclePositions,
		rawTextAlerts
	}: Props = $props();

	let activeTab = $state<'tripUpdates' | 'vehiclePositions' | 'alerts' | 'header' | 'rawText'>(
		'tripUpdates'
	);
	let activeRawTextTab = $state<'tripUpdates' | 'vehiclePositions' | 'alerts'>('tripUpdates');

	const tabs = $derived([
		{ id: 'tripUpdates' as const, label: 'Trip Updates', icon: 'trip', count: tripUpdates.length },
		{
			id: 'vehiclePositions' as const,
			label: 'Vehicle Positions',
			icon: 'vehicle',
			count: vehiclePositions.length
		},
		{ id: 'alerts' as const, label: 'Alerts', icon: 'alert', count: alerts.length },
		{ id: 'header' as const, label: 'Header', icon: 'header', count: null },
		{ id: 'rawText' as const, label: 'Raw Text', icon: 'code', count: null }
	]);

	const rawTextTabs = $derived([
		{
			id: 'tripUpdates' as const,
			label: 'Trip Updates',
			icon: 'trip',
			hasContent: rawTextTripUpdates.length > 0
		},
		{
			id: 'vehiclePositions' as const,
			label: 'Vehicle Positions',
			icon: 'vehicle',
			hasContent: rawTextVehiclePositions.length > 0
		},
		{ id: 'alerts' as const, label: 'Alerts', icon: 'alert', hasContent: rawTextAlerts.length > 0 }
	]);

	const currentRawText = $derived(() => {
		switch (activeRawTextTab) {
			case 'tripUpdates':
				return rawTextTripUpdates;
			case 'vehiclePositions':
				return rawTextVehiclePositions;
			case 'alerts':
				return rawTextAlerts;
			default:
				return '';
		}
	});

	const activeData = $derived(() => {
		switch (activeTab) {
			case 'tripUpdates':
				return tripUpdates;
			case 'vehiclePositions':
				return vehiclePositions;
			case 'alerts':
				return alerts;
			case 'header':
				return header;
		}
	});

	let globalExpand = $state<boolean | null>(null);

	function expandAll() {
		globalExpand = true;
	}

	function collapseAll() {
		globalExpand = false;
	}

	$effect(() => {
		void activeTab;
		globalExpand = null;
	});

	let copySuccess = $state(false);

	async function copyRawText() {
		await navigator.clipboard.writeText(currentRawText());
		copySuccess = true;
		setTimeout(() => {
			copySuccess = false;
		}, 2000);
	}
</script>

<div class="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
	<div class="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
		<div class="flex items-center gap-4">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all {activeTab ===
					tab.id
						? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
						: 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'}"
				>
					{#if tab.icon === 'trip'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
							></path></svg
						>
					{:else if tab.icon === 'vehicle'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
							></path><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
							></path></svg
						>
					{:else if tab.icon === 'alert'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							></path></svg
						>
					{:else if tab.icon === 'header'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
							></path></svg
						>
					{:else if tab.icon === 'code'}
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
							></path></svg
						>
					{/if}
					<span>{tab.label}</span>
					{#if tab.count !== null}
						<span
							class="rounded-full px-2 py-0.5 text-xs {activeTab === tab.id
								? 'bg-indigo-200 text-indigo-800 dark:bg-indigo-800 dark:text-indigo-200'
								: 'bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300'}"
						>
							{tab.count}
						</span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="flex items-center gap-4">
			{#if activeTab !== 'rawText'}
				<div class="flex gap-2">
					<button
						onclick={expandAll}
						class="flex items-center gap-1.5 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-100 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
						title="Expand all nodes"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M19 9l-7 7-7-7"
							></path></svg
						>
						Expand All
					</button>
					<button
						onclick={collapseAll}
						class="flex items-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 dark:hover:bg-yellow-900/50"
						title="Collapse all nodes"
					>
						<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M5 15l7-7 7 7"
							></path></svg
						>
						Collapse All
					</button>
				</div>
			{/if}
			<div class="text-sm text-gray-500 dark:text-gray-400">
				Total Entities: <span class="font-semibold text-gray-700 dark:text-gray-200"
					>{entityCount}</span
				>
			</div>
		</div>
	</div>

	<div class="max-h-[600px] overflow-auto p-4">
		{#if activeTab === 'rawText'}
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap items-center gap-2 rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
					<span class="text-xs font-medium text-gray-500 dark:text-gray-400">View:</span>
					{#each rawTextTabs as tab (tab.id)}
						{#if tab.hasContent}
							<button
								onclick={() => (activeRawTextTab = tab.id)}
								class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium shadow-sm transition-colors {activeRawTextTab ===
								tab.id
									? 'bg-indigo-500 text-white dark:bg-indigo-600'
									: 'bg-white text-gray-700 hover:bg-blue-50 hover:text-indigo-700 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-indigo-900/30 dark:hover:text-indigo-400'}"
							>
								{#if tab.icon === 'trip'}
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
										></path></svg
									>
								{:else if tab.icon === 'vehicle'}
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
										></path><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
										></path></svg
									>
								{:else if tab.icon === 'alert'}
									<svg class="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
										></path></svg
									>
								{/if}
								<span>{tab.label}</span>
							</button>
						{/if}
					{/each}
				</div>

				<div class="relative">
					<button
						onclick={copyRawText}
						class="absolute top-2 right-2 z-10 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors {copySuccess
							? 'bg-green-500 text-white dark:bg-green-600'
							: 'bg-gray-200 text-gray-600 hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500'}"
					>
						{#if copySuccess}
							<svg
								class="mr-1 inline h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 13l4 4L19 7"
								></path></svg
							>Copied
						{:else}
							<svg
								class="mr-1 inline h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
								></path></svg
							>Copy
						{/if}
					</button>
					{#if currentRawText()}
						<pre
							class="rounded-lg bg-gray-50 p-4 pr-20 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:bg-gray-900 dark:text-gray-300">{currentRawText()}</pre>
					{:else}
						<div
							class="flex flex-col items-center justify-center rounded-lg bg-gray-50 py-12 text-center dark:bg-gray-900"
						>
							<div
								class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
							>
								<svg
									class="h-8 w-8 text-gray-400"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
									></path></svg
								>
							</div>
							<p class="text-gray-500 dark:text-gray-400">
								No raw text available for this feed type
							</p>
						</div>
					{/if}
				</div>
			</div>
		{:else if activeTab === 'header'}
			<SimpleJsonTree value={activeData()} {globalExpand} />
		{:else}
			{@const items = activeData() as unknown[]}
			{#if items.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700"
					>
						{#if activeTab === 'tripUpdates'}
							<svg
								class="h-8 w-8 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
								></path></svg
							>
						{:else if activeTab === 'vehiclePositions'}
							<svg
								class="h-8 w-8 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
								></path><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
								></path></svg
							>
						{:else}
							<svg
								class="h-8 w-8 text-gray-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
								></path></svg
							>
						{/if}
					</div>
					<p class="text-gray-500 dark:text-gray-400">
						No {activeTab === 'tripUpdates'
							? 'trip updates'
							: activeTab === 'vehiclePositions'
								? 'vehicle positions'
								: 'alerts'} in this feed
					</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each items as item, index (index)}
						<details class="group rounded-lg border border-gray-200 dark:border-gray-600">
							<summary
								class="flex cursor-pointer items-center justify-between rounded-lg bg-gray-50 px-4 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-700/50 dark:text-gray-300 dark:hover:bg-gray-700"
							>
								<div class="flex items-center gap-3">
									<span
										class="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400"
									>
										#{index + 1}
									</span>
									{#if activeTab === 'tripUpdates'}
										{@const tripUpdate = item as Record<string, unknown>}
										{@const trip = tripUpdate.trip as Record<string, string> | undefined}
										{@const vehicleInfo = tripUpdate.vehicle as Record<string, string> | undefined}
										<span class="font-mono text-sm">
											{trip?.tripId || tripUpdate.id || 'Unknown Trip'}
										</span>
										{#if trip?.routeId}
											<span
												class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900/50 dark:text-green-400"
											>
												Route: {trip.routeId}
											</span>
										{/if}
										{#if vehicleInfo?.id || vehicleInfo?.label}
											<span
												class="flex items-center gap-1 rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-700 dark:bg-orange-900/50 dark:text-orange-400"
											>
												<svg class="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
													></path></svg
												>
												{vehicleInfo?.id || vehicleInfo?.label}
											</span>
										{/if}
									{:else if activeTab === 'vehiclePositions'}
										{@const vehicle = item as Record<string, unknown>}
										{@const vehicleInfo = vehicle.vehicle as Record<string, string> | undefined}
										{@const trip = vehicle.trip as Record<string, string> | undefined}
										<span class="font-mono text-sm">
											{vehicleInfo?.id || vehicleInfo?.label || vehicle.id || 'Unknown Vehicle'}
										</span>
										{#if trip?.routeId}
											<span
												class="rounded bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/50 dark:text-purple-400"
											>
												Route: {trip.routeId}
											</span>
										{/if}
										{#if trip?.tripId}
											<span
												class="rounded bg-cyan-100 px-2 py-0.5 text-xs text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-400"
											>
												Trip: {trip.tripId}
											</span>
										{/if}
									{:else if activeTab === 'alerts'}
										{@const alert = item as Record<string, unknown>}
										{@const headerText = alert.headerText as Record<string, unknown[]> | undefined}
										{@const translation = headerText?.translation?.[0] as
											| Record<string, string>
											| undefined}
										<span class="text-sm">
											{translation?.text || alert.id || 'Alert'}
										</span>
									{/if}
								</div>
								<svg
									class="h-5 w-5 text-gray-400 transition-transform group-open:rotate-180"
									fill="none"
									viewBox="0 0 24 24"
									stroke="currentColor"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M19 9l-7 7-7-7"
									/>
								</svg>
							</summary>
							<div class="border-t border-gray-200 p-4 dark:border-gray-600">
								<SimpleJsonTree value={item} {globalExpand} />
							</div>
						</details>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
