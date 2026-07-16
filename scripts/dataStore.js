import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "..", "public", "data.json");

/**
 * refresh-news.js and refresh-social.js run on different schedules and
 * each only owns half of each politician's record (news vs social). Both
 * read the full current data.json, update only their half, and write the
 * whole thing back -- so neither run clobbers the other's most recent data.
 */
export async function loadData() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastUpdated: null, windowHours: 24, politicians: [] };
  }
}

export async function saveData(data) {
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));
}

export function findOrCreatePolitician(data, politician) {
  let record = data.politicians.find((p) => p.id === politician.id);
  if (!record) {
    record = {
      id: politician.id,
      name: politician.name,
      overallSentiment: null,
      newsSentiment: null,
      socialSentiment: null,
      mentions: { total: 0, news: 0, social: 0 },
      news: [],
      social: [],
    };
    data.politicians.push(record);
  }
  return record;
}

/** Collects every item id currently present across all politicians, in
 * both news and social, so the sentiment cache can be pruned to just
 * what's still live. */
export function collectLiveItemIds(data) {
  const ids = [];
  for (const p of data.politicians) {
    for (const n of p.news ?? []) ids.push(n.id);
    for (const s of p.social ?? []) ids.push(s.id);
  }
  return ids;
}