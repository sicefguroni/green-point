/** ui-avatars defaults to SVG; Next/Image rejects SVG unless dangerouslyAllowSVG — use PNG. */
export function buildUiAvatarsUrl(
  name: string,
  opts?: { background?: string; color?: string },
): string {
  const background = opts?.background ?? "2DC937";
  const color = opts?.color ?? "fff";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "User")}&background=${background}&color=${color}&format=png`;
}
