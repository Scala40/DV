import * as d3 from 'd3';

/**
 * Read the UniGe 11-color palette from CSS custom properties and return an array
 * of color strings suitable for d3 scales.
 *
 * Returns an array of 11 color strings (CSS values). If a variable is missing,
 * the function falls back to a sensible default.
 */
function getUnigePalette() {
    const root = getComputedStyle(document.documentElement);
    const names = [
        '--color-unige-blue',
        '--color-architettura-design',
        '--color-scienze-mfn',
        '--color-unige-red',
        '--color-unige-yellow',
        '--color-lettere-filosofia',
        '--color-scienze-formazione',
        '--color-unige-light-blue',
        '--color-ingegneria',        
        '--color-scienze-politiche',
    ];
    return names.map(n => (root.getPropertyValue(n) || '').trim() || '#999999');
}

/**
 * Create a d3 ordinal scale that maps input domain values to the UniGe palette.
 * Example:
 *   const scale = createUnigeOrdinalScale();
 *   scale.domain(categories);
 *
 * If you want fewer than 11 colors you can still use this function; d3 will
 * cycle through the palette automatically when domain length > palette length.
 */
export function createUnigeOrdinalScale() {
    const palette = getUnigePalette();
    return d3.scaleOrdinal().range(palette);
}

export function createUnigeSequentialScale_YlRd() {
    const names = [
        '--color-economia',
        '--color-architettura-design',
        '--color-medicina',
        '--color-unige-red',
        '--color-scienze-formazione',
    ]
    const root = getComputedStyle(document.documentElement);
    const palette = names.map(n => (root.getPropertyValue(n) || '').trim() || '#999999');
    return d3.scaleSequential()
        .interpolator(d3.interpolateRgbBasis(palette));
}