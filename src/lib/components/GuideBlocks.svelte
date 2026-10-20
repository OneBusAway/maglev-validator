<script module lang="ts">
	// Content blocks shared by the in-app guides.
	import {
		accentClasses,
		legendLabels,
		toneClasses,
		type Accent,
		type Example,
		type Line,
		type Tone
	} from './guideTheme';

	export { badge, infoCards, beforeAfter, sample, legend, note };
</script>

{#snippet badge(text: string, kind: 'on' | 'off' | 'info')}
	<span
		class="rounded-full px-2 py-0.5 text-[11px] font-medium {kind === 'on'
			? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
			: kind === 'info'
				? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
				: 'bg-gray-100 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'}"
	>
		{text}
	</span>
{/snippet}

{#snippet infoCards(accent: Accent, what: string, when: string)}
	<div class="grid gap-3 sm:grid-cols-2">
		<div class="rounded-xl border p-3 {accentClasses[accent].soft}">
			<div class="mb-1 text-[11px] font-bold tracking-wide uppercase {accentClasses[accent].text}">
				What it does
			</div>
			<p class="text-sm text-gray-700 dark:text-zinc-200">{what}</p>
		</div>
		<div
			class="rounded-xl border border-gray-200 bg-gray-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
		>
			<div
				class="mb-1 text-[11px] font-bold tracking-wide text-gray-500 uppercase dark:text-zinc-400"
			>
				When to use it
			</div>
			<p class="text-sm text-gray-700 dark:text-zinc-200">{when}</p>
		</div>
	</div>
{/snippet}

{#snippet pane(title: string | null, lines: Line[])}
	<div class="min-w-0 bg-white dark:bg-zinc-900">
		{#if title}
			<div
				class="border-b border-gray-100 px-2 py-1 text-[10px] font-semibold tracking-wide text-gray-400 uppercase dark:border-zinc-800 dark:text-zinc-500"
			>
				{title}
			</div>
		{/if}
		<div class="space-y-0.5 overflow-x-auto p-1.5 font-mono text-[11px] leading-relaxed">
			{#each lines as [text, tone], i (i)}
				<div class="rounded px-1.5 {tone ? toneClasses[tone] : 'text-gray-700 dark:text-zinc-300'}">
					<span class="whitespace-pre">{text}</span>
				</div>
			{/each}
		</div>
	</div>
{/snippet}

{#snippet example(ex: Example, kind: 'before' | 'after' | 'example', accent: Accent)}
	<figure class="min-w-0 flex-1">
		<figcaption class="mb-1.5 flex items-center gap-2 text-xs">
			<span
				class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase {kind ===
				'before'
					? 'bg-gray-200 text-gray-600 dark:bg-zinc-700 dark:text-zinc-300'
					: accentClasses[accent].chip}"
			>
				{kind}
			</span>
			<span class="text-gray-500 dark:text-zinc-400">{ex.caption}</span>
		</figcaption>
		<div
			class="grid gap-px overflow-hidden rounded-lg border bg-gray-200 dark:bg-zinc-700 {kind ===
			'after'
				? accentClasses[accent].border
				: 'border-gray-200 dark:border-zinc-700'} {ex.right ? 'grid-cols-2' : 'grid-cols-1'}"
		>
			{@render pane(ex.right ? 'Server 1' : null, ex.left)}
			{#if ex.right}
				{@render pane('Server 2', ex.right)}
			{/if}
		</div>
	</figure>
{/snippet}

{#snippet beforeAfter(before: Example, after: Example, accent: Accent)}
	<div class="flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
		{@render example(before, 'before', accent)}
		<div class="flex justify-center text-gray-300 lg:pt-6 dark:text-zinc-600" aria-hidden="true">
			<svg
				class="h-6 w-6 rotate-90 lg:rotate-0"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 7l5 5m0 0l-5 5m5-5H6"
				></path>
			</svg>
		</div>
		{@render example(after, 'after', accent)}
	</div>
{/snippet}

{#snippet sample(ex: Example, accent: Accent)}
	{@render example(ex, 'example', accent)}
{/snippet}

{#snippet legend(tones: Tone[])}
	<div class="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
		<span class="text-gray-400 dark:text-zinc-500">Colors:</span>
		{#each tones as tone (tone)}
			<span class="rounded px-1.5 py-0.5 {toneClasses[tone]}">{legendLabels[tone]}</span>
		{/each}
	</div>
{/snippet}

{#snippet note(text: string)}
	<div
		class="mt-4 flex gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-100"
	>
		<svg
			class="mt-0.5 h-4 w-4 shrink-0 text-amber-500"
			fill="none"
			stroke="currentColor"
			viewBox="0 0 24 24"
		>
			<path
				stroke-linecap="round"
				stroke-linejoin="round"
				stroke-width="2"
				d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
			></path>
		</svg>
		<p><span class="font-semibold">Good to know:</span> {text}</p>
	</div>
{/snippet}
