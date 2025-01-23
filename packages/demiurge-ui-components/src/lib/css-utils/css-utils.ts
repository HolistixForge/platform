//

export function addAlphaToHexColor(color: string, opacity: number): string {
  const _opacity = Math.round(Math.min(Math.max(opacity, 0), 1) * 255);
  return color + _opacity.toString(16).toUpperCase();
}

//
//

export const randomColor = () =>
  '#' +
  Math.floor(0xffffff * Math.random())
    .toString(16)
    .padStart(6, '0');

//
//

export const paletteRandomColor = (v: string) => {
  const p = getCssProperties('--c-random-');
  const a = Object.keys(p);
  const l = a.length;
  const i = stringToNumberInRange(v, 1, l);
  const r = `--c-random-${i}`;
  // console.log({ p, a, l, i, r });
  return cssVar(r);
};

//
//

export const cssVar = (varName: string) => {
  const rootStyles = getComputedStyle(document.documentElement);
  return rootStyles.getPropertyValue(varName).trim();
};

//
//

/**
 * @warning expensive !
 * @todo cache results
 * @param match
 * @returns
 */
export const getCssProperties = (match: string) => {
  const extractedPalette: { [key: string]: string } = {};

  // Iterate through all style sheets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const styleSheet of document.styleSheets as any) {
    if (styleSheet instanceof CSSStyleSheet) {
      // Iterate through all rules in the style sheet
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const rule of styleSheet.cssRules as any) {
        if (rule instanceof CSSStyleRule) {
          // Iterate through all style declarations in the rule
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const declaration of rule.style as any) {
            // Check if the property matches '--c-*'
            if (declaration.startsWith(match)) {
              extractedPalette[declaration] = rule.style
                .getPropertyValue(declaration)
                .trim();
            }
          }
        }
      }
    }
  }
  return extractedPalette;
};

//
//

// DJB2 algorithm
function hashString(str: string): number {
  let hash = 5381;
  let i = str.length;
  while (i) hash = (hash * 33) ^ str.charCodeAt(--i);
  // Ensure the result is a positive integer
  return hash >>> 0;
}

function stringToNumberInRange(str: string, min: number, max: number): number {
  const hash = hashString(str);
  const range = max - min + 1;
  // Map the hash to the desired range
  const result = min + (hash % range);
  return result;
}
