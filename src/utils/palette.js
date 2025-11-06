import * as d3 from 'd3';

/**
 * Read the UniGe 11-color palette from CSS custom properties and return an array
 * of color strings suitable for d3 scales.
 *
 * Returns an array of 11 color strings (CSS values). If a variable is missing,
 * the function falls back to a sensible default.
 */
export function getUnigePalette() {
    const root = getComputedStyle(document.documentElement);
    const names = [
        '--unige-palette-0',
        '--unige-palette-1',
        '--unige-palette-2',
        '--unige-palette-3',
        '--unige-palette-4',
        '--unige-palette-5',
        '--unige-palette-6',
        '--unige-palette-7',
        '--unige-palette-8',
        '--unige-palette-9',
        '--unige-palette-10'
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

export default {
    getUnigePalette,
    createUnigeOrdinalScale
};
