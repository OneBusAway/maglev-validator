<script lang="ts" generics="S extends GuideSection">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { accentClasses, HELP_ICON, type GuideSection } from './guideTheme';

	interface Props {
		title: string;
		subtitle: string;
		buttonLabel: string;
		buttonTitle: string;
		buttonClass: string;
		sections: S[];
		groupHints?: Record<string, string>;
		// Section to show when the dialog opens.
		initialId?: string;
		content: Snippet<[S]>;
	}

	let {
		title,
		subtitle,
		buttonLabel,
		buttonTitle,
		buttonClass,
		sections,
		groupHints = {},
		initialId,
		content
	}: Props = $props();

	const groups = $derived([...new Set(sections.map((s) => s.group))]);

	let open = $state(false);
	let activeId = $state('');
	const activeIndex = $derived(
		Math.max(
			0,
			sections.findIndex((s) => s.id === activeId)
		)
	);
	const active = $derived(sections[activeIndex]);

	// Render the dialog under <body>: an ancestor with backdrop-filter or a
	// transform (like the sticky app header) would otherwise clip the fixed overlay.
	function portal(node: HTMLElement) {
		document.body.appendChild(node);
		return { destroy: () => node.remove() };
	}

	function show() {
		activeId = initialId ?? sections[0].id;
		open = true;
	}

	$effect(() => {
		if (!browser || !open) return;
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') open = false;
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

{#snippet icon(path: string, cls: string)}
	<svg class={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
		<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={path}></path>
	</svg>
{/snippet}

<button
	type="button"
	onclick={show}
	class={buttonClass}
	title={buttonTitle}
	aria-label={buttonTitle}
>
	{@render icon(HELP_ICON, 'h-4 w-4')}
	<span class="hidden sm:inline">{buttonLabel}</span>
</button>

{#if open}
	<div use:portal class="fixed inset-0 z-[100] flex items-center justify-center p-4">
		<button
			type="button"
			class="absolute inset-0 cursor-default bg-black/50 backdrop-blur-sm"
			onclick={() => (open = false)}
			aria-label="Close guide"
		></button>
		<div
			role="dialog"
			aria-modal="true"
			aria-label={title}
			class="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-2xl dark:border-zinc-700 dark:bg-zinc-800"
		>
			<header
				class="flex shrink-0 items-center justify-between gap-4 border-b border-gray-100 bg-gradient-to-r from-green-50 to-white px-5 py-4 dark:border-zinc-700 dark:from-green-900/20 dark:to-zinc-800"
			>
				<div class="flex items-center gap-3">
					<span
						class="flex h-9 w-9 items-center justify-center rounded-xl bg-green-600 text-white shadow-sm"
					>
						{@render icon(HELP_ICON, 'h-5 w-5')}
					</span>
					<div>
						<h2 class="text-base font-semibold text-gray-800 dark:text-white">{title}</h2>
						<p class="text-xs text-gray-500 dark:text-zinc-400">{subtitle}</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-200"
					aria-label="Close guide"
				>
					{@render icon('M6 18L18 6M6 6l12 12', 'h-5 w-5')}
				</button>
			</header>

			<div class="flex min-h-0 flex-1 flex-col md:flex-row">
				<nav
					class="flex shrink-0 gap-1 overflow-x-auto border-b border-gray-100 bg-gray-50/70 p-3 md:w-60 md:flex-col md:overflow-y-auto md:border-r md:border-b-0 dark:border-zinc-700 dark:bg-zinc-900/40"
				>
					{#each groups as group (group)}
						<div class="hidden px-2 pt-2 pb-1 md:block">
							<div
								class="text-[10px] font-bold tracking-wider text-gray-400 uppercase dark:text-zinc-500"
							>
								{group}
							</div>
							{#if groupHints[group]}
								<div class="text-[11px] text-gray-400 dark:text-zinc-500">{groupHints[group]}</div>
							{/if}
						</div>
						{#each sections.filter((s) => s.group === group) as section (section.id)}
							<button
								type="button"
								onclick={() => (activeId = section.id)}
								class="flex shrink-0 items-center gap-2.5 rounded-lg border-l-4 px-2.5 py-2 text-left text-sm transition-colors {active.id ===
								section.id
									? `${accentClasses[section.accent].border} bg-white font-semibold text-gray-800 shadow-sm dark:bg-zinc-800 dark:text-zinc-100`
									: 'border-transparent text-gray-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/60'}"
							>
								<span
									class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg {accentClasses[
										section.accent
									].chip}"
								>
									{@render icon(section.icon, 'h-4 w-4')}
								</span>
								<span class="whitespace-nowrap">{section.name}</span>
							</button>
						{/each}
					{/each}
				</nav>

				<div class="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					{#key active.id}
						<div class="mb-4 flex flex-wrap items-center gap-3">
							<span
								class="flex h-10 w-10 items-center justify-center rounded-xl {accentClasses[
									active.accent
								].chip}"
							>
								{@render icon(active.icon, 'h-5 w-5')}
							</span>
							<h3 class="text-lg font-semibold text-gray-800 dark:text-zinc-100">{active.name}</h3>
						</div>
						{@render content(active)}
					{/key}
				</div>
			</div>

			<footer
				class="flex shrink-0 items-center justify-between border-t border-gray-100 px-5 py-3 dark:border-zinc-700"
			>
				<button
					type="button"
					disabled={activeIndex === 0}
					onclick={() => (activeId = sections[activeIndex - 1].id)}
					class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
				>
					← Previous
				</button>
				<div class="flex gap-1.5">
					{#each sections as section (section.id)}
						<button
							type="button"
							onclick={() => (activeId = section.id)}
							class="h-2 rounded-full transition-all {section.id === active.id
								? 'w-5 bg-green-600'
								: 'w-2 bg-gray-300 dark:bg-zinc-600'}"
							aria-label={section.name}
						></button>
					{/each}
				</div>
				<button
					type="button"
					disabled={activeIndex === sections.length - 1}
					onclick={() => (activeId = sections[activeIndex + 1].id)}
					class="rounded-lg px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 dark:text-zinc-300 dark:hover:bg-zinc-700"
				>
					Next →
				</button>
			</footer>
		</div>
	</div>
{/if}
