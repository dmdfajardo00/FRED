<script lang="ts">
	type Scope = 'global' | 'us';

	interface Props {
		scope: Scope;
		onScopeChange: (s: Scope) => void;
		subtitle: string;
	}

	const { scope, onScopeChange, subtitle }: Props = $props();
</script>

<div class="mb-[18px] flex items-start justify-between gap-4">
	<div>
		<h1 class="text-[26px] font-medium tracking-[-0.01em] m-0" style:color="var(--ink-0)">Global Pulse</h1>
		<div class="text-[13px] mt-1" style:color="var(--ink-3)">{subtitle}</div>
	</div>

	<div class="flex gap-[6px]">
		<button
			type="button"
			onclick={() => onScopeChange('us')}
			class="scope-btn"
			style:background={scope === 'us' ? 'var(--ink-0)' : 'var(--bg)'}
			style:color={scope === 'us' ? 'var(--bg)' : 'var(--ink-2)'}
			style:border="1px solid {scope === 'us' ? 'var(--ink-0)' : 'var(--border)'}"
		>
			U.S. States
		</button>
		<button
			type="button"
			onclick={() => onScopeChange('global')}
			class="scope-btn"
			style:background={scope === 'global' ? 'var(--ink-0)' : 'var(--bg)'}
			style:color={scope === 'global' ? 'var(--bg)' : 'var(--ink-2)'}
			style:border="1px solid {scope === 'global' ? 'var(--ink-0)' : 'var(--border)'}"
		>
			Global
		</button>
	</div>
</div>

<style>
	.scope-btn {
		height: 32px;
		padding: 0 14px;
		font-size: 12px;
		border-radius: 5px;
		cursor: pointer;
		transition: transform 120ms;
	}
	.scope-btn:active { transform: scale(0.98); }
</style>
