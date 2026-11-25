const fs = require('node:fs/promises');
const path = require('node:path');

const SEED_EXTNAMES = ['.js', '.json'];

const loadSeedItems = async dir => {
  if (!dir) {
    return [];
  }
  try {
    await fs.access(dir);
  } catch {
    return null;
  }

  const list = await fs.readdir(dir);
  const items = [];
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) {
      continue;
    }
    const extname = path.extname(file).toLowerCase();
    if (!SEED_EXTNAMES.includes(extname)) {
      continue;
    }
    let loaded;
    if (extname === '.json') {
      loaded = JSON.parse(await fs.readFile(filePath, 'utf8'));
    } else {
      delete require.cache[require.resolve(filePath)];
      loaded = require(filePath);
      loaded = loaded && loaded.default ? loaded.default : loaded;
    }
    if (Array.isArray(loaded)) {
      items.push(...loaded);
    } else if (loaded && typeof loaded === 'object') {
      items.push(loaded);
    }
  }
  return items;
};

module.exports = { loadSeedItems, SEED_EXTNAMES };
