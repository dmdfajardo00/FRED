/** FRED API base URL (used when fetching live data) */
export const FRED_API_BASE = 'https://api.stlouisfed.org/fred';

/** Sidebar widths */
export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_WIDTH_COLLAPSED = 56;

/** Chart color palette (CSS custom properties) */
export const CHART_COLORS = [
	'var(--chart-1)',
	'var(--chart-2)',
	'var(--chart-3)',
	'var(--chart-4)',
	'var(--chart-5)'
] as const;

/** Default chart dimensions */
export const CHART_MARGIN = { top: 12, right: 16, bottom: 36, left: 52 };

/** Zoom constraints */
export const MIN_ZOOM_SPAN_DAYS = 30;
export const MAX_ZOOM_SPAN_DAYS = 365 * 80;

/** LocalStorage keys */
export const LS_THEME = 'theme';
export const LS_SIDEBAR_OPEN = 'sidebar-open';
