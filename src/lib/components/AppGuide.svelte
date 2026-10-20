<script lang="ts">
	import GuideDialog from './GuideDialog.svelte';
	import { beforeAfter, legend, note, sample } from './GuideBlocks.svelte';
	import { accentClasses, type Example, type GuideSection, type Tone } from './guideTheme';

	interface Props {
		// The app's active tab; the guide opens on that tab's page.
		activeTab: string;
	}

	let { activeTab }: Props = $props();

	type AppSection = GuideSection & {
		summary: string;
		steps?: { title: string; detail: string }[];
		features?: { name: string; detail: string; example?: string }[];
		examples?: { title: string; before?: Example; after: Example; legend?: Tone[] }[];
		note?: string;
	};

	const sections: AppSection[] = [
		{
			id: 'overview',
			name: 'Overview',
			group: 'Start here',
			accent: 'green',
			icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
			summary:
				'Maglev Validator is a developer tool for OneBusAway. It calls the same REST endpoint on two servers (for example the Go Maglev server and the Java server) and shows the differences, decodes GTFS-Realtime feeds, lets you query GTFS Static data with SQL, and keeps a history of the values you choose to watch.',
			features: [
				{
					name: 'API Comparator',
					detail:
						'Fetch an endpoint from one or two servers and diff the JSON side by side. Called API Inspector in 1 Server mode.'
				},
				{
					name: 'GTFS Realtime',
					detail: 'Fetch trip update, vehicle position and alert feeds and read them as JSON.'
				},
				{
					name: 'GTFS Static',
					detail: 'Load a GTFS zip, browse its tables and run SQL queries.'
				},
				{
					name: 'Logger History',
					detail: 'Review the watched-key values and GTFS-RT snapshots saved over time.'
				}
			],
			steps: [
				{ title: 'Open API Comparator', detail: 'The first tab in the top bar.' },
				{
					title: 'Enter the two server URLs',
					detail: 'Server 1 and Server 2 base URLs, for example a local Maglev and a Java server.'
				},
				{
					title: 'Pick an endpoint and fill its parameters',
					detail: 'Search the endpoint list, then fill the ID, key and other fields.'
				},
				{
					title: 'Press Ctrl+Enter',
					detail: 'Both responses load side by side with every difference highlighted.'
				}
			],
			note: 'Every tab has its own page in this guide. The response area of the comparator also has its own Guide button for the toolbar above the results.'
		},
		{
			id: 'comparator',
			name: 'API Comparator',
			group: 'Tools',
			accent: 'sky',
			icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
			summary:
				'Calls the same OneBusAway endpoint on one or two servers. With two servers it shows both responses side by side and counts every difference, ignoring array order.',
			steps: [
				{
					title: 'Pick a mode',
					detail:
						'"1 Server" inspects a single response (the tab becomes API Inspector). "2 Servers" compares two.'
				},
				{
					title: 'Enter the server URL(s)',
					detail:
						'The base URL of each server, for example https://api.pugetsound.onebusaway.org. URLs you used before are suggested.'
				},
				{
					title: 'Choose an API Endpoint',
					detail: 'Type to search, for example "arrivals" or "trip".'
				},
				{
					title: 'Fill the parameters',
					detail:
						'The ID, key and any query parameters. Put several IDs in Batch IDs (one per line) to fetch them all and switch between results. Use Server 2 ID when the second server names the same thing differently.'
				},
				{
					title: 'Run it',
					detail: 'Click Run Comparison (or Fetch in 1 Server mode), or press Ctrl+Enter.'
				}
			],
			features: [
				{
					name: 'JSON Path Filter',
					detail: 'Show only part of the response.',
					example: 'data.entry'
				},
				{
					name: 'Ignore Keys',
					detail: 'Leave keys out of the diff, such as timestamps that always differ.',
					example: 'currentTime'
				},
				{
					name: 'Watch Keys (Log)',
					detail:
						'Record the value of chosen keys on both servers each time you fetch. Review them in Logger History. You can also click the eye icon next to any field in the results.',
					example: 'data.entry.status'
				},
				{
					name: 'Auto-refresh',
					detail: 'Fetch again every few seconds, handy for live data and for logging.'
				},
				{
					name: 'Tolerance ±%',
					detail: 'Numbers within this percentage of each other count as equal.',
					example: '0.5'
				},
				{
					name: 'GTFS-RT exports',
					detail:
						'GTFS-Realtime endpoints are decoded to JSON, and entities are matched by vehicle, trip or alert ID because the feed entity IDs differ between servers.'
				}
			],
			examples: [
				{
					title: 'Reading the results',
					after: {
						caption: 'What the diff markers mean',
						left: [
							['name: "Main St"'],
							['direction: "N"   != "S"', 'diff'],
							['url: not in this response', 'missing'],
							['stops: Array[4]  2 diffs', 'diff']
						],
						right: [
							['name: "Main St"'],
							['direction: "S"   != "N"', 'diff'],
							['url: Object{1}   extra', 'missing'],
							['stops: Array[4]  2 diffs', 'diff']
						]
					},
					legend: ['diff', 'missing']
				},
				{
					title: 'Ignore Keys',
					before: {
						caption: 'A timestamp is always different',
						left: [['currentTime: 1770671432   != ...', 'diff'], ['data: Object{2}']],
						right: [['currentTime: 1770671436   != ...', 'diff'], ['data: Object{2}']]
					},
					after: {
						caption: 'Ignore Keys: currentTime',
						left: [['data: Object{2}', 'focus']],
						right: [['data: Object{2}', 'focus']]
					}
				},
				{
					title: 'Tolerance ±%',
					before: {
						caption: 'Tolerance 0: a 0.3% gap is a diff',
						left: [['distanceAlongTrip: 1200   != 1203.5', 'diff']],
						right: [['distanceAlongTrip: 1203.5 != 1200', 'diff']]
					},
					after: {
						caption: 'Tolerance 0.5%: treated as equal',
						left: [['distanceAlongTrip: 1200', 'focus']],
						right: [['distanceAlongTrip: 1203.5', 'focus']]
					}
				}
			],
			note: 'Arrays are compared without regard to order, so the same items in a different order are not a diff. The Guide button in the response toolbar explains Sync Scroll, Sync Select, Matched Order, Sort Arrays and Fullscreen.'
		},
		{
			id: 'gtfsrt',
			name: 'GTFS Realtime',
			group: 'Tools',
			accent: 'violet',
			icon: 'M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z',
			summary:
				'Fetches GTFS-Realtime protobuf feeds and decodes them into readable JSON: trip updates, vehicle positions and service alerts.',
			steps: [
				{
					title: 'Enter the feed URLs',
					detail:
						'Fill any of trip updates, vehicle positions and service alerts. You do not need all three.'
				},
				{
					title: 'Add headers if needed',
					detail: 'For feeds that need an API key in a header, for example x-api-key.'
				},
				{
					title: 'Fetch',
					detail: 'Fetch Selected or Fetch All Feeds, or press Ctrl+Enter.'
				},
				{
					title: 'Browse the result',
					detail: 'Switch between feeds and read the decoded entities.'
				}
			],
			features: [
				{ name: 'Auto-refresh', detail: 'Fetch the feeds again on an interval.' },
				{
					name: 'Enable logging',
					detail: 'Save every fetch as a snapshot you can review in Logger History, GTFS-RT.'
				}
			]
		},
		{
			id: 'static',
			name: 'GTFS Static',
			group: 'Tools',
			accent: 'amber',
			icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
			summary:
				'Loads a GTFS static zip into a local database so you can browse its tables and query it with SQL.',
			steps: [
				{
					title: 'Load a feed',
					detail: 'Paste the URL of a gtfs.zip, or click to upload the file. Recent URLs are kept.'
				},
				{
					title: 'Browse a table',
					detail:
						'Pick one under Available Tables (routes, stops, trips, ...). Search and page through rows.'
				},
				{
					title: 'Query with SQL',
					detail: 'Write a SELECT query in the SQL Query editor and run it.'
				}
			],
			features: [
				{
					name: 'SQL Query',
					detail: 'Only SELECT queries are allowed, so the data cannot be changed by accident.',
					example: "SELECT * FROM stops WHERE stop_name LIKE '%Pine%'"
				},
				{
					name: 'Query History and favorites',
					detail: 'Past queries are listed; save useful ones to favorites with a name.'
				}
			]
		},
		{
			id: 'logger',
			name: 'Logger History',
			group: 'History',
			accent: 'rose',
			icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
			summary:
				'Everything the app logged over time, in two sub-tabs: watched API keys and GTFS-RT snapshots.',
			features: [
				{
					name: 'API',
					detail:
						'Every fetch with Watch Keys set saves the Server 1 and Server 2 values of those keys. Choose an endpoint, filter by key or ID, check the Match column (✓ or ✗) to see whether both servers agreed, and open a row to load the full responses.'
				},
				{
					name: 'GTFS-RT',
					detail:
						'Snapshots saved while Enable logging is on in GTFS Realtime. Inspect one to see its trip updates and alerts.'
				}
			],
			examples: [
				{
					title: 'Watching a key over time',
					after: {
						caption: 'Logger History, API, key data.entry.status',
						left: [
							['10:00:05  "SCHEDULED"', 'muted'],
							['10:00:10  "SCHEDULED"', 'muted'],
							['10:00:15  "CANCELED"', 'diff']
						],
						right: [
							['"SCHEDULED"   ✓', 'muted'],
							['"SCHEDULED"   ✓', 'muted'],
							['"SCHEDULED"   ✗', 'diff']
						]
					},
					legend: ['diff']
				}
			],
			note: 'To start logging, add keys under Watch Keys in API Comparator, or click the eye icon on a field in the results, then fetch (Auto-refresh logs on every refresh).'
		},
		{
			id: 'workspace',
			name: 'Split, tools and theme',
			group: 'Workspace',
			accent: 'emerald',
			icon: 'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
			summary: 'The buttons on the right of the top bar.',
			features: [
				{
					name: 'Split',
					detail:
						'Show two tools side by side, for example API Comparator next to GTFS Static. Pick each side from its dropdown and drag the divider to resize.'
				},
				{
					name: 'Dev Tools (clock icon)',
					detail:
						'A timestamp converter: paste a Unix timestamp to see it as local time, GTFS service time and relative time.',
					example: '1770671432'
				},
				{
					name: 'Theme (sun / moon)',
					detail: 'Switch between light and dark mode.'
				}
			],
			note: 'Your inputs, tabs and settings are saved in this browser, so they are still there after a reload.'
		}
	];

	const groupHints = {
		'Start here': 'What this app is',
		Tools: 'The main tabs',
		History: 'What was logged',
		Workspace: 'Top bar buttons'
	};

	const tabToSection: Record<string, string> = {
		comparator: 'comparator',
		protobuf: 'gtfsrt',
		'gtfs-static': 'static',
		logger: 'logger'
	};
</script>

<GuideDialog
	title="How to use Maglev Validator"
	subtitle="A short tour of every tab. It opens on the tab you are using."
	buttonLabel="Guide"
	buttonTitle="How to use this app"
	buttonClass="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
	{sections}
	{groupHints}
	initialId={tabToSection[activeTab] ?? 'overview'}
>
	{#snippet content(section: AppSection)}
		{@const accent = accentClasses[section.accent]}
		<p class="rounded-xl border p-3 text-sm text-gray-700 dark:text-zinc-200 {accent.soft}">
			{section.summary}
		</p>

		{#if section.steps}
			<h4 class="mt-5 mb-2 text-[11px] font-bold tracking-wide uppercase {accent.text}">
				{section.id === 'overview' ? 'Quick start' : 'How to use it'}
			</h4>
			<ol class="space-y-2">
				{#each section.steps as step, i (step.title)}
					<li class="flex gap-3">
						<span
							class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold {accent.chip}"
						>
							{i + 1}
						</span>
						<div class="text-sm">
							<span class="font-semibold text-gray-800 dark:text-zinc-100">{step.title}.</span>
							<span class="text-gray-600 dark:text-zinc-300">{step.detail}</span>
						</div>
					</li>
				{/each}
			</ol>
		{/if}

		{#if section.features}
			<h4 class="mt-5 mb-2 text-[11px] font-bold tracking-wide uppercase {accent.text}">
				{section.id === 'overview' ? 'The tabs' : 'Options'}
			</h4>
			<div class="grid gap-2 sm:grid-cols-2">
				{#each section.features as feature (feature.name)}
					<div
						class="rounded-lg border border-gray-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900/40"
					>
						<div class="text-sm font-semibold text-gray-800 dark:text-zinc-100">{feature.name}</div>
						<p class="mt-0.5 text-sm text-gray-600 dark:text-zinc-300">{feature.detail}</p>
						{#if feature.example}
							<div class="mt-1.5 text-xs text-gray-400 dark:text-zinc-500">
								e.g. <code
									class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-700 dark:bg-zinc-800 dark:text-zinc-200"
									>{feature.example}</code
								>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		{#if section.examples}
			{#each section.examples as ex (ex.title)}
				<h4 class="mt-6 mb-2 text-[11px] font-bold tracking-wide uppercase {accent.text}">
					Example: {ex.title}
				</h4>
				{#if ex.before}
					{@render beforeAfter(ex.before, ex.after, section.accent)}
				{:else}
					{@render sample(ex.after, section.accent)}
				{/if}
				{#if ex.legend}
					{@render legend(ex.legend)}
				{/if}
			{/each}
		{/if}

		{#if section.note}
			{@render note(section.note)}
		{/if}
	{/snippet}
</GuideDialog>
