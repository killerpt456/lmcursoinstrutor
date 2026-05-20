import { promises as fs } from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const projectDir = path.join(rootDir, "project");
const dataFile = path.join(projectDir, "data", "library-resources.json");

const typeConfigMap = {
  pdf: {
    directory: "pdfs",
    extensions: new Set([".pdf"]),
    defaultCategory: "Sem categoria",
  },
  video: {
    directory: "videos",
    extensions: new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]),
    defaultCategory: "Sem categoria",
  },
  summary: {
    directory: "resumos",
    extensions: new Set([".pdf", ".doc", ".docx", ".txt", ".rtf", ".odt", ".ppt", ".pptx", ".pps", ".ppsx", ".md", ".csv", ".xls", ".xlsx", ".canvas"]),
    defaultCategory: "Resumo Bernardo",
  },
};

const existingResources = await readExistingResources(dataFile);
const existingIndex = new Map();

for (const resource of existingResources) {
  const key = buildResourceKey(resource.type, resource.filename);
  if (key) {
    existingIndex.set(key, resource);
  }
}

const catalog = [];

for (const [type, config] of Object.entries(typeConfigMap)) {
  const directoryPath = path.join(projectDir, config.directory);
  const entries = await safeReadDir(directoryPath);

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const extension = path.extname(entry.name).toLowerCase();
    if (!config.extensions.has(extension)) continue;

    const filename = entry.name;
    const key = buildResourceKey(type, filename);
    const fullPath = path.join(directoryPath, filename);
    const stats = await fs.stat(fullPath);
    const existing = key ? existingIndex.get(key) : null;

    catalog.push({
      id: existing?.id || `auto-${hashKey(`${type}::${filename}`)}`,
      title: existing?.title || buildTitleFromFilename(filename),
      type,
      category: existing?.category || config.defaultCategory,
      description: existing?.description || "Ficheiro detetado automaticamente na pasta do projeto.",
      url: `./${config.directory}/${encodeURIComponent(filename)}`,
      filename,
      createdAt: Number(existing?.createdAt) || stats.mtimeMs,
      createdBy: existing?.createdBy || "sistema",
    });
  }
}

catalog.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));

await fs.mkdir(path.dirname(dataFile), { recursive: true });
await fs.writeFile(dataFile, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.log(`Updated ${path.relative(rootDir, dataFile)} with ${catalog.length} resources.`);

async function readExistingResources(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function safeReadDir(directoryPath) {
  try {
    return await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function buildResourceKey(type, filename) {
  if (!type || !filename) return null;
  return `${type}::${filename}`;
}

function buildTitleFromFilename(filename) {
  const baseName = path.parse(filename).name;
  return baseName.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim() || filename;
}

function hashKey(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}
