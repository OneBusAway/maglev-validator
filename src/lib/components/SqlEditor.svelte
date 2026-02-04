<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { EditorView, keymap, placeholder } from '@codemirror/view';
	import { EditorState } from '@codemirror/state';
	import { sql, SQLite } from '@codemirror/lang-sql';
	import { autocompletion, CompletionContext, type Completion } from '@codemirror/autocomplete';
	import { oneDark } from '@codemirror/theme-one-dark';
	import { defaultKeymap, historyKeymap, history } from '@codemirror/commands';
	import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';

	interface Props {
		value: string;
		onchange: (value: string) => void;
		onrun: () => void;
		tables: Array<{ name: string; columns: string[] }>;
		isDark?: boolean;
	}

	let { value = $bindable(), onchange, onrun, tables = [], isDark = false }: Props = $props();

	let editorContainer: HTMLDivElement;
	let editorView: EditorView | null = null;
	let lastExternalValue = value;

	function getCompletions(context: CompletionContext) {
		const word = context.matchBefore(/\w*/);
		if (!word || (word.from === word.to && !context.explicit)) return null;

		const completions: Completion[] = [];

		const keywords = [
			'SELECT',
			'FROM',
			'WHERE',
			'JOIN',
			'LEFT',
			'RIGHT',
			'INNER',
			'OUTER',
			'ON',
			'AND',
			'OR',
			'NOT',
			'IN',
			'LIKE',
			'BETWEEN',
			'IS',
			'NULL',
			'ORDER',
			'BY',
			'ASC',
			'DESC',
			'GROUP',
			'HAVING',
			'LIMIT',
			'OFFSET',
			'DISTINCT',
			'AS',
			'COUNT',
			'SUM',
			'AVG',
			'MIN',
			'MAX',
			'CASE',
			'WHEN',
			'THEN',
			'ELSE',
			'END',
			'UNION',
			'ALL',
			'EXISTS',
			'COALESCE',
			'CAST'
		];

		keywords.forEach((kw) => {
			completions.push({
				label: kw,
				type: 'keyword',
				boost: 1
			});
		});

		tables.forEach((table) => {
			completions.push({
				label: table.name,
				type: 'class',
				detail: 'table',
				boost: 2
			});

			table.columns.forEach((col) => {
				completions.push({
					label: col,
					type: 'property',
					detail: `${table.name}.${col}`,
					boost: 0.5
				});
				completions.push({
					label: `${table.name}.${col}`,
					type: 'property',
					detail: 'column',
					boost: 0.3
				});
			});
		});

		return {
			from: word.from,
			options: completions,
			validFor: /^\w*$/
		};
	}

	function createEditor() {
		if (!editorContainer) return;

		if (editorView) {
			editorView.destroy();
		}

		const extensions = [
			history(),
			keymap.of([
				...defaultKeymap,
				...historyKeymap,
				{
					key: 'Ctrl-Enter',
					mac: 'Cmd-Enter',
					run: () => {
						onrun();
						return true;
					}
				}
			]),
			sql({ dialect: SQLite }),
			autocompletion({
				override: [getCompletions],
				activateOnTyping: true
			}),
			placeholder(
				"Enter your SQL query here... (e.g., SELECT * FROM stops WHERE stop_name LIKE '%Station%')"
			),
			EditorView.updateListener.of((update) => {
				if (update.docChanged) {
					const newValue = update.state.doc.toString();
					if (newValue !== value) {
						lastExternalValue = newValue;
						value = newValue;
						onchange(newValue);
					}
				}
			}),
			EditorView.theme({
				'&': {
					fontSize: '14px',
					border: '1px solid #d1d5db',
					borderRadius: '8px',
					minHeight: '120px'
				},
				'&.cm-focused': {
					outline: 'none',
					borderColor: '#3b82f6',
					boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.1)'
				},
				'.cm-content': {
					padding: '12px',
					fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
				},
				'.cm-gutters': {
					display: 'none'
				},
				'.cm-placeholder': {
					color: '#9ca3af'
				}
			}),
			syntaxHighlighting(defaultHighlightStyle, { fallback: true })
		];

		if (isDark) {
			extensions.push(oneDark);
		}

		const state = EditorState.create({
			doc: value,
			extensions
		});

		editorView = new EditorView({
			state,
			parent: editorContainer
		});

		lastExternalValue = value;
	}

	$effect(() => {
		const newValue = value;

		if (editorView && newValue !== lastExternalValue) {
			lastExternalValue = newValue;
			const currentDoc = editorView.state.doc.toString();
			if (newValue !== currentDoc) {
				editorView.dispatch({
					changes: {
						from: 0,
						to: editorView.state.doc.length,
						insert: newValue
					}
				});
			}
		}
	});

	onMount(() => {
		createEditor();
	});

	onDestroy(() => {
		if (editorView) {
			editorView.destroy();
		}
	});
</script>

<div bind:this={editorContainer} class="sql-editor"></div>

<style>
	.sql-editor :global(.cm-editor) {
		background: white;
	}

	:global(.dark) .sql-editor :global(.cm-editor) {
		background: #1f2937;
		border-color: #374151;
	}

	:global(.dark) .sql-editor :global(.cm-editor.cm-focused) {
		border-color: #3b82f6;
	}

	:global(.dark) .sql-editor :global(.cm-content) {
		color: #e5e7eb;
	}

	:global(.dark) .sql-editor :global(.cm-placeholder) {
		color: #6b7280;
	}
</style>
