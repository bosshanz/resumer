export function fitPreviewScale(
  pageWidth: number,
  availableWidth: number,
  requestedScale: number
): number {
  const safeRequestedScale = Number.isFinite(requestedScale) && requestedScale > 0
    ? requestedScale
    : 1;

  if (pageWidth <= 0 || availableWidth <= 0) return safeRequestedScale;
  return Math.max(0.1, Math.min(safeRequestedScale, availableWidth / pageWidth));
}
