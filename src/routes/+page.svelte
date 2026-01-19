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
	<title>Maglev Helper | API Tools</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
		rel="stylesheet"
	/>
</svelte:head>

<div
	class="min-h-screen bg-slate-50 font-['Inter',sans-serif] text-slate-900 transition-colors duration-300 dark:bg-slate-900 dark:text-slate-100"
>
	<header
		class="sticky top-0 z-50 border-b border-slate-200 bg-white transition-colors duration-300 dark:border-slate-700 dark:bg-slate-800"
	>
		<div class="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-8">
			<div class="flex items-center gap-3">
				<div
					class="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-500/30"
				>
					M
				</div>
				<span class="text-lg font-semibold tracking-tight text-slate-800 dark:text-white"
					>Maglev Helper</span
				>
			</div>

			<!-- Main Tabs - centered -->
			<div class="absolute left-1/2 -translate-x-1/2">
				<div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-700">
					<button
						onclick={() => (activeTab = 'comparator')}
						class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all {activeTab ===
						'comparator'
							? 'bg-white text-blue-600 shadow-sm dark:bg-slate-600 dark:text-blue-400'
							: 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}"
					>
						<span>🔄</span>
						<span>API Comparator</span>
					</button>
					<button
						onclick={() => (activeTab = 'protobuf')}
						class="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all {activeTab ===
						'protobuf'
							? 'bg-white text-blue-600 shadow-sm dark:bg-slate-600 dark:text-blue-400'
							: 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'}"
					>
						<span>📡</span>
						<span>GTFS Realtime</span>
					</button>
				</div>
			</div>

			<div class="flex items-center gap-4">
				<button
					onclick={toggleTheme}
					class="rounded-lg p-2 text-slate-500 transition-all hover:scale-105 hover:bg-slate-100 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-700"
					title="Toggle theme"
				>
					{#if theme === 'light'}
						<span class="text-lg">🌙</span>
					{:else}
						<span class="text-lg">☀️</span>
					{/if}
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-[1800px] px-8 py-6">
		<!-- Keep both panels mounted but hidden to preserve state -->
		<div class={activeTab === 'comparator' ? '' : 'hidden'}>
			<ComparatorPanel />
		</div>
		<div class={activeTab === 'protobuf' ? '' : 'hidden'}>
			<ProtobufPanel />
		</div>
	</main>
</div>
