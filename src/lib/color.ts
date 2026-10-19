/** '#rrggbb' → 'rgba(r, g, b, a)'. 8-digit hex colours need Chrome 62; webOS 4 has 53,
 *  which drops the whole declaration when it meets one. */
export function rgba (hex: string, alpha: number): string {
	const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
	if (!m) return hex;
	return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
}
