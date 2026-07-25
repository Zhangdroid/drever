export function keepItemVisible(
  scrollOffset: number,
  viewportSize: number,
  itemOffset: number,
  itemSize: number,
) {
  if (itemOffset < scrollOffset) return itemOffset;

  const itemEnd = itemOffset + itemSize;
  if (itemEnd > scrollOffset + viewportSize) return itemEnd - viewportSize;

  return scrollOffset;
}

export function centerItem(
  viewportSize: number,
  contentSize: number,
  itemOffset: number,
  itemSize: number,
) {
  const centeredOffset = itemOffset - (viewportSize - itemSize) / 2;
  return Math.min(Math.max(centeredOffset, 0), Math.max(contentSize - viewportSize, 0));
}
