export const ASSET_BASE = `${process.env.PUBLIC_URL || ''}/assets/fishing`;

/** Optimized runtime copies preserve the PNG masters for future art edits. */
export const artwork = (file: string) => `${ASSET_BASE}/${file.endsWith('.png') ? `optimized/${file.slice(0, -4)}.webp` : file}`;
