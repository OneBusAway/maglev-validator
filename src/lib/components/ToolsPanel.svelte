<script lang="ts">
	import { fly } from 'svelte/transition';
	import { formatTimestamp } from '$lib/utils/date';
	import { onMount } from 'svelte';

	let { isOpen = $bindable(false) } = $props();

	let inputValue = $state('');
	let now = $state(Date.now());
	let result = $derived(formatTimestamp(inputValue, now));
	let autoOpen = $state(true);
	let lastSelection = $state('');

	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('toolsAutoOpen');
		if (saved !== null) {
			autoOpen = saved === 'true';
		}
	}

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem('toolsAutoOpen', String(autoOpen));
		}
	});

	function handleSelection() {
		const selectionObj = window.getSelection();
		const selection = selectionObj?.toString().trim() || '';

		if (selection === lastSelection) return;
		lastSelection = selection;

		if (!selection) return;

		if (
			selectionObj?.anchorNode?.parentElement?.closest('.tools-panel-container') ||
			selectionObj?.focusNode?.parentElement?.closest('.tools-panel-container')
		) {
			return;
		}

		if (!isOpen) {
			if (autoOpen && /^\d{10,13}$/.test(selection)) {
				inputValue = selection;
				isOpen = true;
			}
		} else {
			if (/^\d+$/.test(selection)) {
				inputValue = selection;
			}
		}
	}

	onMount(() => {
		const onSelectionChange = () => {
			setTimeout(handleSelection, 500);
		};
		document.addEventListener('selectionchange', onSelectionChange);

		const interval = setInterval(() => {
			if (isOpen) {
				now = Date.now();
			}
		}, 1000);

		return () => {
			document.removeEventListener('selectionchange', onSelectionChange);
			clearInterval(interval);
		};
	});
</script>

{#if isOpen}
	<div
		class="tools-panel-container fixed right-6 bottom-6 z-[101] flex max-h-[80vh] w-96 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl transition-transform dark:border-gray-700 dark:bg-gray-900"
		transition:fly={{ y: 20, duration: 300 }}
	>
		<!-- Header -->
		<div
			class="flex items-center justify-between border-b border-gray-100 p-4 dark:border-gray-800"
		>
			<h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Dev Tools</h2>
			<button
				onclick={() => (isOpen = false)}
				class="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>
		</div>

		<div class="flex-1 space-y-6 overflow-y-auto p-4">
			<section class="space-y-4">
				<div class="flex items-center justify-between">
					<h3
						class="flex items-center gap-2 text-sm font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
						Timestamp Converter
					</h3>
					<div class="flex items-center gap-2">
						<input
							type="checkbox"
							id="auto-open"
							bind:checked={autoOpen}
							class="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800"
						/>
						<label
							for="auto-open"
							class="cursor-pointer text-xs text-gray-500 select-none dark:text-gray-400"
						>
							Auto-open
						</label>
					</div>
				</div>

				<div>
					<label
						for="ts-input"
						class="mb-1.5 block text-xs font-medium text-gray-700 dark:text-gray-300"
					>
						Epoch Timestamp (Seconds or Milliseconds)
					</label>
					<input
						id="ts-input"
						type="text"
						bind:value={inputValue}
						placeholder="e.g. 1770671432"
						class="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
					/>
				</div>

				{#if result.isValid}
					<div
						class="rounded-lg border border-indigo-100 bg-indigo-50/50 p-4 dark:border-indigo-900/30 dark:bg-indigo-900/10"
					>
						<div class="space-y-3">
							<div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Local Time</div>
								<div class="font-mono text-sm font-semibold text-gray-900 dark:text-gray-100">
									{result.local}
								</div>
							</div>
							<div>
								<div class="text-xs text-gray-500 dark:text-gray-400">UTC</div>
								<div class="font-mono text-sm text-gray-700 dark:text-gray-300">{result.utc}</div>
							</div>
							{#if result.serviceDay}
								<div>
									<!-- Helper: Common Timestamps -->
									<div class="text-xs text-indigo-600 dark:text-indigo-400">GTFS Service Time</div>
									<div class="font-mono text-sm font-medium text-indigo-700 dark:text-indigo-300">
										{result.serviceDay}
									</div>
								</div>
							{/if}
							<div>
								<div class="text-xs text-gray-500 dark:text-gray-400">Relative</div>
								<div class="text-sm text-gray-700 dark:text-gray-300">{result.relative}</div>
							</div>
							<div class="border-t border-indigo-100 pt-2 dark:border-indigo-900/30">
								<span
									class="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-gray-600 shadow-sm dark:bg-gray-800 dark:text-gray-300"
								>
									Detected: {result.isSeconds ? 'Seconds' : 'Milliseconds'}
								</span>
							</div>
						</div>
					</div>
				{:else if inputValue}
					<div
						class="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-600 dark:border-red-900/30 dark:bg-red-900/20 dark:text-red-400"
					>
						Invalid timestamp
					</div>
				{/if}
			</section>

			<section class="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
				<h3 class="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
					Quick Values
				</h3>
				<div class="grid grid-cols-2 gap-2">
					<button
						onclick={() => (inputValue = Math.floor(Date.now() / 1000).toString())}
						class="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						Now (Sec)
					</button>
					<button
						onclick={() => (inputValue = Date.now().toString())}
						class="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						Now (Ms)
					</button>
				</div>
			</section>
		</div>
	</div>
{/if}
