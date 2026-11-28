/**
 * Splits a `boxShadow` string into its layers on commas that sit outside parentheses.
 *
 * @param shadow - A CSS `boxShadow` value, e.g. one of the `Shadows` tokens.
 * @returns Each layer, trimmed, in order.
 */
export function splitShadowLayers(shadow: string): string[] {
  const layers: string[] = [];
  let depth = 0;
  let start = 0;

  for (let index = 0; index < shadow.length; index += 1) {
    const char = shadow[index];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      layers.push(shadow.slice(start, index).trim());
      start = index + 1;
    }
  }

  layers.push(shadow.slice(start).trim());
  return layers.filter((layer: string): boolean => layer.length > 0);
}
