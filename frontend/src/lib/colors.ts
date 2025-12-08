import * as d3 from 'd3';

/**
 * Generates a deterministic, high-saturation, pleasant color from any string.
 * Used as a fallback/stateless generator.
 */
export function getDeterministicColor(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    const hue = Math.abs(hash % 360);
    const saturation = 60 + Math.abs(hash % 20);
    const lightness = 40 + Math.abs(hash % 20);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Generates a distinct color based on a numeric index.
 * Uses the Golden Angle (~137.508°) to strictly prevent hue overlap.
 * Uses disjoint cycles for Saturation and Lightness to ensure variety.
 */
export const getSequentialColor = (index: number): string => {
    // Hue: Golden Angle (~137.508 degrees)
    // This provides optimal distribution around the color wheel,
    // ensuring no two indices share the same hue for a very long time.
    const hue = (index * 137.508) % 360;

    // Saturation: Cycle [Vibrant, Semi-Muted, Max, High]
    // Cycle length 4
    const saturationLevels = [75, 60, 100, 85];
    const saturation = saturationLevels[index % saturationLevels.length];

    // Lightness: Cycle [Mid, Dark, Light, Mid-Dark, Mid-Light]
    // Cycle length 5 (Prime, coprime to 4) creates a 20-step unique S/L pattern
    // Ranges constrained to 35-75% to avoid colors becoming indistinguishable (too black/white)
    const lightnessLevels = [50, 35, 70, 45, 65];
    const lightness = lightnessLevels[index % lightnessLevels.length];

    return `hsl(${hue.toFixed(1)}, ${saturation}%, ${lightness}%)`;
};

/**
 * Helper to generate a gradient definition from a base color.
 * Useful for Object/Case styling where a gradient is preferred over solid color.
 */
export const getObjectGradient = (baseColor: string, idPrefix: string) => {
    // Generate a lighter version for the gradient top
    const colorObj = d3.hsl(baseColor);
    const lighter = colorObj.copy();

    // Increase lightness but cap it at 95% to prevent pure white washout
    lighter.l = Math.min(lighter.l + 0.35, 0.95);

    return {
        id: `${idPrefix}-gradient-${baseColor.replace(/[^a-zA-Z0-9]/g, '')}`,
        base: baseColor,
        lighter: lighter.toString(),
        css: `linear-gradient(135deg, ${lighter.toString()} 0%, ${baseColor} 100%)`,
    };
};

export const DESELECTED_COLOR = '#D1D5DB';
