export function extractPageText(items: Iterable<unknown>): string {
  let text = "";
  let previousY: number | null = null;
  for (const item of items) {
    if (
      !item ||
      typeof item !== "object" ||
      !("str" in item) ||
      typeof item.str !== "string"
    )
      continue;
    if (!("transform" in item) || !Array.isArray(item.transform)) continue;
    const positionY = Number(item.transform[5]);
    if (previousY !== null && Math.abs(previousY - positionY) > 3) text += "\n";
    text += `${item.str} `;
    if ("hasEOL" in item && item.hasEOL) text += "\n";
    previousY = positionY;
  }
  return `${text}\f`;
}
