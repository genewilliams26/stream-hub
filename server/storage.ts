import {
  seenProductions,
  appSettings,
  settingsDataSchema,
  type SeenProduction,
  type InsertSeen,
  type SettingsData,
} from "@shared/schema";
import { DEFAULT_SETTINGS } from "./defaults";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

// Create tables if they don't exist (no migration step needed on the Pi).
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS seen_productions (
    production_id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    media_type TEXT NOT NULL DEFAULT 'movie',
    year INTEGER,
    seen_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY,
    data TEXT NOT NULL
  );
`);

export const db = drizzle(sqlite);

export interface IStorage {
  getSettings(): SettingsData;
  saveSettings(data: SettingsData): SettingsData;
  getSeen(): SeenProduction[];
  getSeenIds(): Set<string>;
  markSeen(item: InsertSeen): SeenProduction;
  unmarkSeen(productionId: string): void;
}

export class DatabaseStorage implements IStorage {
  getSettings(): SettingsData {
    const row = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
    if (!row) {
      this.saveSettings(DEFAULT_SETTINGS);
      return DEFAULT_SETTINGS;
    }
    try {
      // Merge with defaults so newly-added fields/services appear automatically.
      const parsed = JSON.parse(row.data);
      return settingsDataSchema.parse({ ...DEFAULT_SETTINGS, ...parsed });
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(data: SettingsData): SettingsData {
    const validated = settingsDataSchema.parse(data);
    const json = JSON.stringify(validated);
    const existing = db.select().from(appSettings).where(eq(appSettings.id, 1)).get();
    if (existing) {
      db.update(appSettings).set({ data: json }).where(eq(appSettings.id, 1)).run();
    } else {
      db.insert(appSettings).values({ id: 1, data: json }).run();
    }
    return validated;
  }

  getSeen(): SeenProduction[] {
    return db.select().from(seenProductions).all();
  }

  getSeenIds(): Set<string> {
    return new Set(this.getSeen().map((s) => s.productionId));
  }

  markSeen(item: InsertSeen): SeenProduction {
    const existing = db
      .select()
      .from(seenProductions)
      .where(eq(seenProductions.productionId, item.productionId))
      .get();
    if (existing) return existing;
    return db
      .insert(seenProductions)
      .values({ ...item, seenAt: Date.now() })
      .returning()
      .get();
  }

  unmarkSeen(productionId: string): void {
    db.delete(seenProductions).where(eq(seenProductions.productionId, productionId)).run();
  }
}

export const storage = new DatabaseStorage();
