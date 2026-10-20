// Shared styling for the in-app guides (GuideDialog and its content).

export type Accent = 'green' | 'sky' | 'violet' | 'emerald' | 'amber' | 'rose';

export type GuideSection = {
	id: string;
	name: string;
	group: string;
	accent: Accent;
	icon: string;
};

export const accentClasses: Record<
	Accent,
	{ chip: string; text: string; border: string; soft: string }
> = {
	green: {
		chip: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
		text: 'text-green-700 dark:text-green-300',
		border: 'border-green-500',
		soft: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20'
	},
	sky: {
		chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
		text: 'text-sky-700 dark:text-sky-300',
		border: 'border-sky-500',
		soft: 'border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20'
	},
	violet: {
		chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
		text: 'text-violet-700 dark:text-violet-300',
		border: 'border-violet-500',
		soft: 'border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20'
	},
	emerald: {
		chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
		text: 'text-emerald-700 dark:text-emerald-300',
		border: 'border-emerald-500',
		soft: 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
	},
	amber: {
		chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
		text: 'text-amber-700 dark:text-amber-300',
		border: 'border-amber-500',
		soft: 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20'
	},
	rose: {
		chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
		text: 'text-rose-700 dark:text-rose-300',
		border: 'border-rose-500',
		soft: 'border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-900/20'
	}
};

export const HELP_ICON =
	'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';

// Example rows: a/b/c mark the same item on both sides, focus marks where the
// user is or what changed, diff marks a changed value, missing marks an absent item, muted is context.
export type Tone = 'a' | 'b' | 'c' | 'focus' | 'diff' | 'missing' | 'muted';
export type Line = [text: string, tone?: Tone];
export type Example = { caption: string; left: Line[]; right?: Line[] };

export const toneClasses: Record<Tone, string> = {
	a: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200',
	b: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200',
	c: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200',
	focus: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200',
	diff: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
	missing: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200',
	muted: 'text-gray-400 dark:text-zinc-500'
};

export const legendLabels: Record<Tone, string> = {
	a: 'item A: same item',
	b: 'item B: same item',
	c: 'item C: same item',
	focus: 'what to look at',
	diff: 'different value',
	missing: 'only one server has it',
	muted: 'context'
};
