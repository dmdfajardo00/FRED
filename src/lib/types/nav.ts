/** Navigation route definition */
export interface NavRoute {
	path: string;
	label: string;
	icon: string;
	exact?: boolean;
}

/** Breadcrumb segment */
export interface Breadcrumb {
	label: string;
	href?: string;
}
