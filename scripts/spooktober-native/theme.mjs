// Map neutral interface colors while preserving artwork, masks, brands and blood.
export function applyHarborTheme(css) {
  const neutral = (hex, property) => {
    let digits = hex.slice(1);
    if (digits.length === 3 || digits.length === 4) digits = [...digits].map(value => value + value).join('');
    const channels = [0, 2, 4].map(index => parseInt(digits.slice(index, index + 2), 16));
    if (Math.max(...channels) - Math.min(...channels) > 30) return hex;
    const level = channels.reduce((sum, value) => sum + value, 0) / 3;
    const foreground = property === 'color';
    const edge = /border|outline/.test(property);
    const token = edge ? 'edge' : foreground
      ? level < 85 ? 'canvas' : level < 145 ? 'ink-subtle' : level < 207 ? 'ink-muted' : 'ink'
      : level < 32 ? 'canvas' : level < 45 ? 'surface' : level < 59 ? 'elevated' : level < 105 ? 'raised' : 'ink';
    const color = `var(--color-${token})`;
    if (digits.length !== 8) return color;
    const opacity = Math.round(parseInt(digits.slice(6), 16) / 255 * 1000) / 10;
    return `color-mix(in srgb,${color} ${opacity}%,transparent)`;
  };
  return css.replace(/(^|[;{])(\s*)(background(?:-color)?|color|border(?:-(?:top|right|bottom|left))?(?:-color)?|outline(?:-color)?|--playlist-[\w-]+)\s*:\s*([^;{}]+)/gm,
    (_declaration, delimiter, space, property, value) => `${delimiter}${space}${property}:${value.replace(/#[\da-f]{8}\b|#[\da-f]{6}\b|#[\da-f]{4}\b|#[\da-f]{3}\b/gi, hex => neutral(hex, property))}`);
}
