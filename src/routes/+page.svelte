<script lang="ts">
	import { onMount } from 'svelte';
	import ComparatorPanel from '$lib/components/ComparatorPanel.svelte';
	import ProtobufPanel from '$lib/components/ProtobufPanel.svelte';

	let activeTab = $state<'comparator' | 'protobuf'>('comparator');
	let theme = $state('light');

	onMount(() => {
		if (typeof localStorage !== 'undefined') {
			if (localStorage.theme) theme = localStorage.theme;
			if (localStorage.activeTab) activeTab = localStorage.activeTab as 'comparator' | 'protobuf';
		}
		updateTheme();
	});

	$effect(() => {
		updateTheme();
	});

	$effect(() => {
		if (typeof localStorage !== 'undefined') {
			localStorage.activeTab = activeTab;
		}
	});

	function updateTheme() {
		if (typeof document === 'undefined') return;
		if (theme === 'dark') {
			document.documentElement.classList.add('dark');
			localStorage.theme = 'dark';
		} else {
			document.documentElement.classList.remove('dark');
			localStorage.theme = 'light';
		}
	}

	function toggleTheme() {
		theme = theme === 'light' ? 'dark' : 'light';
	}
</script>

<svelte:head>
	<title>Maglev Validator | API Tools</title>
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon.png" />
	<link rel="apple-touch-icon" sizes="180x180" href="/favicon.png" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="min-h-screen bg-gray-50 font-['Inter',sans-serif] text-gray-900 transition-colors duration-200 dark:bg-gray-950 dark:text-gray-100"
>
	<header
		class="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-md transition-colors duration-200 dark:border-gray-800 dark:bg-gray-900/80"
	>
		<div class="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-6">
			<div class="flex items-center gap-3">
				<img src="/favicon.png" alt="Maglev Validator" class="h-12 w-12 rounded-lg" />
				<span class="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
					>Maglev Validator</span
				>
			</div>

			<!-- Main Tabs - centered -->
			<div class="absolute left-1/2 -translate-x-1/2">
				<div
					class="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-100 p-1 dark:border-gray-800 dark:bg-gray-800"
				>
					<button
						onclick={() => (activeTab = 'comparator')}
						class="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all {activeTab ===
						'comparator'
							? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
							: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
							></path></svg
						>
						<span>API Comparator</span>
					</button>
					<button
						onclick={() => (activeTab = 'protobuf')}
						class="flex items-center gap-2 rounded-md px-4 py-1.5 text-sm font-medium transition-all {activeTab ===
						'protobuf'
							? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white'
							: 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'}"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
							></path></svg
						>
						<span>GTFS Realtime</span>
					</button>
				</div>
			</div>

			<div class="flex items-center gap-3">
				<button
					onclick={toggleTheme}
					class="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
					title="Toggle theme"
				>
					{#if theme === 'light'}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
							></path></svg
						>
					{:else}
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
							></path></svg
						>
					{/if}
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-[1800px] px-6 py-6">
		<!-- Keep both panels mounted but hidden to preserve state -->
		<div class={activeTab === 'comparator' ? '' : 'hidden'}>
			<ComparatorPanel />
		</div>
		<div class={activeTab === 'protobuf' ? '' : 'hidden'}>
			<ProtobufPanel />
		</div>
	</main>
</div>
