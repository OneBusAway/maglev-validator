<script lang="ts">
	import GuideDialog from './GuideDialog.svelte';
	import { badge, beforeAfter, infoCards, legend, note } from './GuideBlocks.svelte';
	import type { Example, GuideSection, Tone } from './guideTheme';

	type ToolbarSection = GuideSection & {
		compareOnly: boolean;
		defaultOn: boolean;
		what: string;
		when: string;
		before: Example;
		after: Example;
		note?: string;
		legend?: Tone[];
	};

	const sections: ToolbarSection[] = [
		{
			id: 'scroll',
			name: 'Sync Scroll',
			group: 'Layout',
			accent: 'sky',
			icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
			compareOnly: true,
			defaultOn: true,
			what: 'Scrolling one response pane scrolls the other to the same position.',
			when: 'Keep it on while reading both responses top to bottom. Turn it off to scroll one side on its own, for example when one response is much longer.',
			before: {
				caption: 'Off: you scroll Server 1, Server 2 stays at the top',
				left: [
					['...', 'muted'],
					['12: Object{3}'],
					['13: Object{3}  ← you', 'focus'],
					['14: Object{3}']
				],
				right: [
					['0: Object{3}  ← still here', 'focus'],
					['1: Object{3}'],
					['2: Object{3}'],
					['...', 'muted']
				]
			},
			after: {
				caption: 'On: both panes move together',
				left: [
					['...', 'muted'],
					['12: Object{3}'],
					['13: Object{3}  ← you', 'focus'],
					['14: Object{3}']
				],
				right: [
					['...', 'muted'],
					['12: Object{3}'],
					['13: Object{3}  ← same spot', 'focus'],
					['14: Object{3}']
				]
			},
			note: 'It matches the pixel position, so keep Sync Select on too, or the panes drift apart when different nodes are expanded on each side.'
		},
		{
			id: 'select',
			name: 'Sync Select',
			group: 'Layout',
			accent: 'violet',
			icon: 'M4 6h16M4 12h16m-7 6h7',
			compareOnly: true,
			defaultOn: true,
			what: 'Expanding or collapsing a node on one side does the same to the node at the same place on the other side.',
			when: 'Keep it on to drill into the same field on both servers with one click. Turn it off to open nodes on one side only.',
			before: {
				caption: 'Off: you expand entry on Server 1 only',
				left: [
					['▼ entry: Object{4}', 'focus'],
					['    id: "1_100"'],
					['    name: "Main St"'],
					['    ...', 'muted']
				],
				right: [['▶ entry: Object{4}', 'muted']]
			},
			after: {
				caption: 'On: one click expands both sides',
				left: [
					['▼ entry: Object{4}', 'focus'],
					['    id: "1_100"'],
					['    name: "Main St"'],
					['    ...', 'muted']
				],
				right: [
					['▼ entry: Object{4}', 'focus'],
					['    id: "1_100"'],
					['    name: "Main St"'],
					['    ...', 'muted']
				]
			}
		},
		{
			id: 'fullscreen',
			name: 'Fullscreen',
			group: 'Layout',
			accent: 'rose',
			icon: 'M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15',
			compareOnly: false,
			defaultOn: false,
			what: 'Expands the response view to fill the whole window, hiding the inputs above it.',
			when: 'Use it for long or deeply nested responses. Press Esc or click Exit to leave.',
			before: {
				caption: 'Normal: inputs and response share the page',
				left: [
					['┌ server URLs, endpoint, params ┐', 'muted'],
					['└───────────────────────────────┘', 'muted'],
					['┌ response ─────────────────────┐', 'focus'],
					['└───────────────────────────────┘', 'focus']
				]
			},
			after: {
				caption: 'Fullscreen: the response fills the window',
				left: [
					['┌ response ─────────────────────┐', 'focus'],
					['│                               │', 'focus'],
					['│                               │', 'focus'],
					['└───────────────────────────────┘', 'focus']
				]
			}
		},
		{
			id: 'order',
			name: 'Matched Order / Real Order',
			group: 'Arrays',
			accent: 'emerald',
			icon: 'M4 6h6m-6 6h6m-6 6h6m4-12h6m-6 6h6m-6 6h6',
			compareOnly: true,
			defaultOn: true,
			what: 'Controls how array items are laid out. Matched Order puts each item on the same row as its match from the other server. Real Order shows each array exactly as its server returned it.',
			when: 'Use Matched Order to compare item by item. Switch to Real Order when you need to see the order a server actually returned.',
			before: {
				caption: 'Real Order: Server 2 returned the same stops in another order',
				left: [
					['0: { stopId: "A" }', 'a'],
					['1: { stopId: "B" }', 'b'],
					['2: { stopId: "C" }', 'c']
				],
				right: [
					['0: { stopId: "C" }', 'c'],
					['1: { stopId: "A" }', 'a'],
					['2: { stopId: "B" }', 'b']
				]
			},
			after: {
				caption: 'Matched Order: matching stops share a row',
				left: [
					['0: { stopId: "A" }', 'a'],
					['1: { stopId: "B" }', 'b'],
					['2: { stopId: "C" }', 'c']
				],
				right: [
					['1: { stopId: "A" }', 'a'],
					['2: { stopId: "B" }', 'b'],
					['0: { stopId: "C" }', 'c']
				]
			},
			legend: ['a', 'b', 'c'],
			note: 'Diff counts and != badges ignore order in both modes, so these arrays show 0 diffs either way. Labels keep the original index: "1:" on the right means it was item 1 in Server 2\'s response. Items are matched by identical content first, then by ID field (id, tripId, routeId, stopId, ...), then by position.'
		},
		{
			id: 'sort',
			name: 'Sort Arrays',
			group: 'Arrays',
			accent: 'amber',
			icon: 'M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12',
			compareOnly: false,
			defaultOn: false,
			what: 'Picks one array (auto-detected, or one you choose) and an ID field, then replaces the view with only that array from both servers, paired by ID. An ID that only one server has shows null on the other side.',
			when: 'Use it to focus on one big list (for example data.list) and spot which IDs only one server returned. Click Reset Sort to go back to the full response.',
			before: {
				caption: 'Full response, each server in its own order',
				left: [
					['data:', 'muted'],
					['  list:', 'muted'],
					['    0: { id: "1_A" }', 'a'],
					['    1: { id: "1_B" }', 'b'],
					['  references: ...', 'muted']
				],
				right: [
					['data:', 'muted'],
					['  list:', 'muted'],
					['    0: { id: "1_C" }', 'c'],
					['    1: { id: "1_A" }', 'a'],
					['  references: ...', 'muted']
				]
			},
			after: {
				caption: 'Sorted by id: only data.list, paired by ID',
				left: [
					['0: { id: "1_A" }', 'a'],
					['1: { id: "1_B" }', 'b'],
					['2: null', 'missing']
				],
				right: [
					['0: { id: "1_A" }', 'a'],
					['1: null', 'missing'],
					['2: { id: "1_C" }', 'c']
				]
			},
			legend: ['a', 'b', 'c', 'missing']
		}
	];

	const groupHints = {
		Layout: 'How the two panes move',
		Arrays: 'How array items line up'
	};
</script>

<GuideDialog
	title="Response toolbar guide"
	subtitle="A green button in the toolbar means it is on. Pick a button to see what it does."
	buttonLabel="Guide"
	buttonTitle="What do these buttons do?"
	buttonClass="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:bg-gray-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
	{sections}
	{groupHints}
>
	{#snippet content(section: ToolbarSection)}
		<div class="mb-4 flex flex-wrap gap-2">
			{@render badge(
				section.defaultOn ? 'On by default' : 'Off by default',
				section.defaultOn ? 'on' : 'off'
			)}
			{#if section.compareOnly}
				{@render badge('Two servers only', 'info')}
			{/if}
		</div>
		{@render infoCards(section.accent, section.what, section.when)}
		<div class="mt-5">
			{@render beforeAfter(section.before, section.after, section.accent)}
		</div>
		{#if section.legend}
			{@render legend(section.legend)}
		{/if}
		{#if section.note}
			{@render note(section.note)}
		{/if}
	{/snippet}
</GuideDialog>
