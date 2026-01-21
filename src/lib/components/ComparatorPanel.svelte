<script lang="ts">
	import { endpoints } from '$lib/endpoints';
	import DiffViewer from '$lib/components/DiffViewer.svelte';
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let response1 = $state<unknown>(undefined);
	let response2 = $state<unknown>(undefined);
	let loading = $state(false);
	let error = $state<string | undefined>(undefined);

	let server1Base = $state('http://localhost:4000/api/where/');
	let server2Base = $state('https://unitrans-api.server.onebusawaycloud.com/api/where/');
	let selectedEndpoint = $state('trip-details');
	let params = $state<Record<string, string>>({});
	let focusPath = $state('');
	let ignoredKeysInput = $state('');

	let autoRefresh = $state(false);
	let refreshInterval = $state(5);
	let refreshTimer: number | undefined = undefined;

	let showIgnoreModal = $state(false);
	let ignoreSearch = $state('');

	const ignoredKeys = $derived(
		ignoredKeysInput
			.split(',')
			.map((k) => k.trim())
			.filter((k) => k.length > 0)
	);

	const availableKeys = $derived.by(() => {
		const keys = new Set<string>();
		if (response1) collectKeys(response1, keys);
		if (response2) collectKeys(response2, keys);
		return Array.from(keys).sort();
	});

	function collectKeys(obj: unknown, keys: Set<string>) {
		if (!obj || typeof obj !== 'object') return;
		if (Array.isArray(obj)) {
			obj.forEach((item) => collectKeys(item, keys));
		} else {
			Object.keys(obj as Record<string, unknown>).forEach((key) => {
				keys.add(key);
				collectKeys((obj as Record<string, unknown>)[key], keys);
			});
		}
	}

	function toggleIgnoreKey(key: string) {
		const current = new SvelteSet(ignoredKeys);
		if (current.has(key)) {
			current.delete(key);
		} else {
			current.add(key);
		}
		ignoredKeysInput = Array.from(current).join(', ');
		handleIgnoreInput();
	}

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			if (localStorage.server1Base) server1Base = localStorage.server1Base;
			if (localStorage.server2Base) server2Base = localStorage.server2Base;
			ignoredKeysInput = localStorage.getItem(`ignore_${selectedEndpoint}`) || '';
		}
		updateParams();
	});

	$effect(() => {
		updateParams();
	});

	let lastEndpoint = '';
	$effect(() => {
		if (selectedEndpoint !== lastEndpoint) {
			if (typeof localStorage !== 'undefined') {
				ignoredKeysInput = localStorage.getItem(`ignore_${selectedEndpoint}`) || '';
			}
			lastEndpoint = selectedEndpoint;
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

	function handleIgnoreInput() {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(`ignore_${selectedEndpoint}`, ignoredKeysInput);
		}
	}

	function updateParams() {
		const endpoint = endpoints.find((e) => e.id === selectedEndpoint);
		if (endpoint) {
			const newParams: Record<string, string> = {};
			endpoint.params.forEach((p) => {
				newParams[p.name] = p.default;
			});

			if (Object.keys(params).length === 0 || lastEndpoint !== selectedEndpoint) {
				params = newParams;
			}
		}
	}

	function startAutoRefresh() {
		stopAutoRefresh();
		fetchBoth();
		refreshTimer = window.setInterval(() => {
			fetchBoth();
		}, refreshInterval * 1000);
	}

	function stopAutoRefresh() {
		if (refreshTimer !== undefined) {
			clearInterval(refreshTimer);
			refreshTimer = undefined;
		}
	}

	async function fetchBoth() {
		loading = true;
		error = undefined;

		const endpoint = endpoints.find((e) => e.id === selectedEndpoint);
		if (!endpoint) return;

		try {
			const url1 = buildUrl(server1Base, endpoint, params);
			const url2 = buildUrl(server2Base, endpoint, params);

			const response = await fetch('/api/proxy', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url1, url2 })
			});

			const data = await response.json();

			if (data.error) {
				error = data.error;
				return;
			}

			response1 = data.response1;
			response2 = data.response2;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error';
		} finally {
			loading = false;
		}
	}

	function buildUrl(
		base: string,
		endpoint: (typeof endpoints)[number],
		params: Record<string, string>
	): string {
		let path = endpoint.path;
		let queryParams: string[] = [];

		Object.entries(params).forEach(([key, value]) => {
			if (endpoint.params.find((p) => p.name === key && p.inPath)) {
				path = path.replace(`{${key}}`, value);
			} else {
				queryParams.push(`${key}=${encodeURIComponent(value)}`);
			}
		});

		return base + path + (queryParams.length ? '?' + queryParams.join('&') : '');
	}

	function handleParamChange(paramName: string, value: string) {
		params = { ...params, [paramName]: value };
	}
</script>

<div
	class="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800"
>
	<div class="space-y-6 p-6">
		<div class="grid grid-cols-2 gap-6">
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>Server 1 URL</label
				>
				<input
					type="text"
					bind:value={server1Base}
					class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:focus:ring-blue-500/40"
				/>
			</div>
			<div>
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>Server 2 URL</label
				>
				<input
					type="text"
					bind:value={server2Base}
					class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:focus:ring-blue-500/40"
				/>
			</div>
		</div>

		<div class="grid grid-cols-12 gap-6">
			<div class="col-span-3">
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>API Endpoint</label
				>
				<div class="relative">
					<select
						bind:value={selectedEndpoint}
						class="w-full cursor-pointer appearance-none rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:focus:ring-blue-500/40"
					>
						{#each endpoints as endpoint (endpoint.id)}
							<option value={endpoint.id}>{endpoint.name}</option>
						{/each}
					</select>
				</div>
			</div>

			{#each endpoints.find((e) => e.id === selectedEndpoint)?.params || [] as param (param.name)}
				<div class="col-span-3">
					<label
						class="mb-2 flex items-center gap-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>
						{param.label}
						{#if param.required}<span class="text-red-500"> * </span>{/if}
					</label>
					<input
						type="text"
						value={params[param.name] || ''}
						oninput={(e) => handleParamChange(param.name, e.currentTarget.value)}
						placeholder={param.placeholder || ''}
						class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:focus:ring-blue-500/40"
					/>
				</div>
			{/each}

			<div class="col-span-2">
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>JSON Path Filter</label
				>
				<input
					type="text"
					bind:value={focusPath}
					placeholder="e.g. data.entry.status"
					class="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:placeholder:text-slate-600 dark:focus:ring-blue-500/40"
				/>
			</div>

			<div class="col-span-2">
				<label
					class="mb-2 block text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
					>Ignored Keys</label
				>
				<button
					onclick={() => (showIgnoreModal = true)}
					class="group flex w-full items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:focus:ring-blue-500/40"
				>
					<span class="truncate">
						{ignoredKeys.length ? `${ignoredKeys.length} keys ignored` : 'Select keys...'}
					</span>
					<span class="text-slate-400 transition-colors group-hover:text-blue-500">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							class="h-4 w-4"
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
					</span>
				</button>
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
							min="1"
							max="60"
							class="w-16 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center text-sm font-medium text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
						/>
						<span class="text-xs text-slate-400">sec</span>
					</div>
				{/if}
			</div>

			<button
				onclick={fetchBoth}
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
					Running...
				{:else}
					Run Comparison
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

{#if response1 || response2}
	<div class="mb-4 flex items-center justify-between">
		<h2 class="text-lg font-semibold text-slate-800 dark:text-slate-100">Response Comparison</h2>
		<div class="flex items-center gap-6 text-sm font-medium">
			<span class="mr-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
				<span class="h-3 w-3 rounded bg-red-500"></span> Different
			</span>
			<span class="mr-4 flex items-center gap-2 text-slate-600 dark:text-slate-400">
				<span class="h-3 w-3 rounded bg-orange-400"></span> Missing
			</span>
			<span class="flex items-center gap-2 text-slate-600 dark:text-slate-400">
				<span class="h-3 w-3 rounded bg-green-500"></span> Extra
			</span>
		</div>
	</div>

	<DiffViewer {response1} {response2} {focusPath} {ignoredKeys} />
{:else if !loading}
	<div
		class="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-16 text-center transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800"
	>
		<div
			class="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 text-3xl dark:bg-slate-900"
		>
			🤖
		</div>
		<h3 class="mb-2 text-xl font-semibold text-slate-800 dark:text-white">Ready to Compare</h3>
		<p class="max-w-md text-slate-500">
			Configure your endpoints above, then click <strong class="text-blue-600"
				>Run Comparison</strong
			> to analyze the API response differences.
		</p>
	</div>
{/if}

{#if showIgnoreModal}
	<div
		class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm transition-all sm:p-6"
		role="dialog"
		aria-modal="true"
	>
		<div
			class="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-2xl dark:bg-slate-800"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 p-4 dark:border-slate-700"
			>
				<h3 class="text-lg font-semibold text-slate-800 dark:text-white">Ignore Keys</h3>
				<button
					onclick={() => (showIgnoreModal = false)}
					class="text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-200"
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
			</div>

			<div
				class="border-b border-slate-100 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
			>
				<input
					type="text"
					bind:value={ignoreSearch}
					placeholder="Search keys..."
					class="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
				/>
			</div>

			<div class="flex-1 overflow-y-auto p-2">
				{#if availableKeys.length === 0}
					<div class="p-8 text-center text-slate-400 italic">
						No keys found. Run a comparison first!
					</div>
				{:else}
					{@const filteredKeys = availableKeys.filter((k) =>
						k.toLowerCase().includes(ignoreSearch.toLowerCase())
					)}
					<div class="grid grid-cols-1 gap-1">
						{#each filteredKeys as key (key)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
							>
								<input
									type="checkbox"
									checked={ignoredKeys.includes(key)}
									onchange={() => toggleIgnoreKey(key)}
									class="h-4 w-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-offset-0 dark:border-slate-600 dark:bg-slate-700"
								/>
								<span class="font-mono text-sm font-medium text-slate-700 dark:text-slate-300"
									>{key}</span
								>
								{#if ignoredKeys.includes(key)}
									<span class="ml-auto text-xs font-medium text-blue-600 dark:text-blue-400"
										>Ignored</span
									>
								{/if}
							</label>
						{/each}
						{#if filteredKeys.length === 0}
							<div class="p-4 text-center text-sm text-slate-400">
								No keys match "{ignoreSearch}"
							</div>
						{/if}
					</div>
				{/if}
			</div>

			<div
				class="flex justify-end gap-3 rounded-b-xl border-t border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50"
			>
				<button
					onclick={() => (showIgnoreModal = false)}
					class="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800 dark:text-slate-300 dark:hover:text-white"
				>
					Close
				</button>
			</div>
		</div>
	</div>
{/if}
