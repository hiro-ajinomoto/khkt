/**
 * Icon for "danh sach bai tap" nav: Japanese-style, switches with light/dark theme.
 * Light: cherry blossom (U+1F338). Dark: Shinto shrine / torii (U+26E9 + VS16).
 * @param {'light' | 'dark'} theme
 */
export function getAssignmentsNavIcon(theme) {
  return theme === 'dark' ? '\u26E9\uFE0F' : '\uD83C\uDF38';
}
