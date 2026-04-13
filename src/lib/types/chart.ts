/** Chart margin/padding dimensions */
export interface ChartMargin {
	top: number;
	right: number;
	bottom: number;
	left: number;
}

/** Zoom domain expressed as timestamps */
export interface ZoomDomain {
	start: number;
	end: number;
}

/** A rendered data point after scale transformation */
export interface ScaledPoint {
	x: number;
	y: number;
	date: string;
	value: number | null;
}

/** Chart layer render props passed from ChartWrapper */
export interface LayerProps {
	width: number;
	height: number;
	margin: ChartMargin;
	xMin: number;
	xMax: number;
	yMin: number;
	yMax: number;
	color: string;
	points: ScaledPoint[];
}
