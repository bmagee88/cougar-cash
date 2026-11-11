// Mechanical packing/validation only. The generated PNG masters remain unchanged.
const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const root = path.resolve(__dirname, '../public/assets/typing-boss/dragons');
const ids = ['ancient-red-dragon', 'cindermaw', 'ember-whelp'];

(async () => {
  const manifest = [];
  for (const id of ids) {
    const source = path.join(root, `${id}-attacks.png`);
    const meta = await sharp(source).metadata();
    if (meta.width !== 1536 || meta.height !== 1024 || !meta.hasAlpha) throw Error(`Expected transparent 6×4 atlas: ${id}`);
    const frames = [];
    for (let row = 0; row < 4; row += 1) {
      const hashes = new Set();
      for (let column = 0; column < 6; column += 1) {
        const pixels = await sharp(source).extract({ left: column * 256, top: row * 256, width: 256, height: 256 }).ensureAlpha().raw().toBuffer();
        let solid = 0, clear = 0;
        for (let offset = 3; offset < pixels.length; offset += 4) {
          if (pixels[offset] > 180) solid += 1;
          if (pixels[offset] < 10) clear += 1;
        }
        if (solid < 2000 || clear < 4000) throw Error(`Empty or opaque frame: ${id} ${row}:${column}`);
        hashes.add(require('node:crypto').createHash('sha256').update(pixels).digest('hex'));
        frames.push({ row, column, solid, clear });
      }
      if (hashes.size < 5) throw Error(`Attack row lacks distinct artwork: ${id} ${row}`);
    }
    await sharp(source).webp({ lossless: true, effort: 6 }).toFile(path.join(root, `${id}-attacks.webp`));
    manifest.push({ id, columns: 6, rows: ['bite', 'fireball', 'tailWhip', 'flamethrower'], cell: 256,
      runtimeBytes: (await fs.stat(path.join(root, `${id}-attacks.webp`))).size, frames });
  }
  await fs.writeFile(path.join(root, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Validated ${ids.length} transparent dragon atlases, 72 attack frames.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
