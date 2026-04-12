import { getChartConfig } from '$lib/mock/fred-data';
import { error } from '@sveltejs/kit';

export function load({ params }: { params: { id: string } }) {
	const chart = getChartConfig(params.id);
	if (!chart) {
		error(404, `Series "${params.id}" not found.`);
	}
	return { chart };
}
