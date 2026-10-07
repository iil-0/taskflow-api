const fs = require('node:fs/promises');
const path = require('node:path');

const seedFile = path.join(__dirname, '../src/data/seed.json');
const dataFile = process.env.TASKS_FILE
  ? path.resolve(process.env.TASKS_FILE)
  : path.join(__dirname, '../src/data/tasks.json');
const force = process.argv.includes('--force');

async function hasTasks() {
  try {
    const tasks = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    return !Array.isArray(tasks) || tasks.length > 0;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    return true;
  }
}

async function main() {
  if (!force && await hasTasks()) {
    console.log(`${dataFile} already contains data. Use "npm run seed -- --force" to overwrite it.`);
    return;
  }
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.copyFile(seedFile, dataFile);
  console.log(`Seeded ${dataFile} with sample tasks.`);
}

main().catch(error => {
  console.error('Unable to seed task data:', error);
  process.exitCode = 1;
});
