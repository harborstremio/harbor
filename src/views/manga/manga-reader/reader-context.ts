export function visibleReaderPages(
  pages: string[],
  spread: string,
): Array<{ number: number; src: string }> {
  if (!/^\d+(?:-\d+)?$/.test(spread)) return [];
  const numbers = [...new Set(spread.split("-").map(Number))];
  if (
    numbers.some((number) => number < 1 || number > pages.length) ||
    (numbers.length === 2 && Math.abs(numbers[0] - numbers[1]) !== 1)
  )
    return [];
  return numbers.map((number) => ({ number, src: pages[number - 1] }));
}
