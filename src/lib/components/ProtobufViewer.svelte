<script lang="ts">
	import SimpleJsonTree from './SimpleJsonTree.svelte';

	interface Props {
		tripUpdates: unknown[];
		vehiclePositions: unknown[];
		alerts: unknown[];
		header: unknown;
		entityCount: number;
	}

	let { tripUpdates, vehiclePositions, alerts, header, entityCount }: Props = $props();

	let activeTab = $state<'tripUpdates' | 'vehiclePositions' | 'alerts' | 'header'>('tripUpdates');

	const tabs = $derived([
		{ id: 'tripUpdates' as const, label: 'Trip Updates', icon: '🚌', count: tripUpdates.length },
		{
			id: 'vehiclePositions' as const,
			label: 'Vehicle Positions',
			icon: '📍',
			count: vehiclePositions.length
		},
		{ id: 'alerts' as const, label: 'Alerts', icon: '⚠️', count: alerts.length },
		{ id: 'header' as const, label: 'Header', icon: '📋', count: null }
	]);

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
</script>

<div class="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
	<div
		class="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700"
	>
		<div class="flex items-center gap-4">
			{#each tabs as tab (tab.id)}
				<button
					onclick={() => (activeTab = tab.id)}
					class="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all {activeTab ===
					tab.id
						? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
						: 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'}"
				>
					<span>{tab.icon}</span>
					<span>{tab.label}</span>
					{#if tab.count !== null}
						<span
							class="rounded-full px-2 py-0.5 text-xs {activeTab === tab.id
								? 'bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200'
								: 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-300'}"
						>
							{tab.count}
						</span>
					{/if}
				</button>
			{/each}
		</div>
		<div class="text-sm text-slate-500 dark:text-slate-400">
			Total Entities: <span class="font-semibold text-slate-700 dark:text-slate-200"
				>{entityCount}</span
			>
		</div>
	</div>

	<div class="max-h-[600px] overflow-auto p-4">
		{#if activeTab === 'header'}
			<SimpleJsonTree value={activeData()} />
		{:else}
			{@const items = activeData() as unknown[]}
			{#if items.length === 0}
				<div class="flex flex-col items-center justify-center py-12 text-center">
					<div
						class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl dark:bg-slate-700"
					>
						{activeTab === 'tripUpdates' ? '🚌' : activeTab === 'vehiclePositions' ? '📍' : '⚠️'}
					</div>
					<p class="text-slate-500 dark:text-slate-400">
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
						<details class="group rounded-lg border border-slate-200 dark:border-slate-600">
							<summary
								class="flex cursor-pointer items-center justify-between rounded-lg bg-slate-50 px-4 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:bg-slate-700/50 dark:text-slate-300 dark:hover:bg-slate-700"
							>
								<div class="flex items-center gap-3">
									<span
										class="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
									>
										#{index + 1}
									</span>
									{#if activeTab === 'tripUpdates'}
										{@const tripUpdate = item as Record<string, unknown>}
										{@const trip = tripUpdate.trip as Record<string, string> | undefined}
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
									class="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180"
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
							<div class="border-t border-slate-200 p-4 dark:border-slate-600">
								<SimpleJsonTree value={item} />
							</div>
						</details>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
</div>
