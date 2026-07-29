import type { Express } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import { runSearch } from "./search";
import { hasLiveProviders } from "./providers";
import { tmdbKey, omdbKey, watchmodeKey } from "./live";
import { insertSeenSchema, settingsDataSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  // --- Settings ---
  app.get("/api/settings", (_req, res) => {
    res.json(storage.getSettings());
  });

  app.put("/api/settings", (req, res) => {
    const parsed = settingsDataSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    res.json(storage.saveSettings(parsed.data));
  });

  // --- Seen ---
  app.get("/api/seen", (_req, res) => {
    res.json(storage.getSeen());
  });

  app.post("/api/seen", (req, res) => {
    const parsed = insertSeenSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    res.json(storage.markSeen(parsed.data));
  });

  app.delete("/api/seen/:id", (req, res) => {
    storage.unmarkSeen(req.params.id);
    res.json({ ok: true });
  });

  // --- Search (AI + offline fallback) ---
  const searchQuerySchema = z.object({ q: z.string().default("") });
  app.get("/api/search", async (req, res) => {
    const { q } = searchQuerySchema.parse({ q: req.query.q ?? "" });
    const settings = storage.getSettings();
    const seenIds = storage.getSeenIds();
    const result = await runSearch(q, settings, seenIds);
    res.json(result);
  });

  // --- Status (so the UI can show whether live providers/AI are active) ---
  app.get("/api/status", (_req, res) => {
    res.json({
      liveProviders: hasLiveProviders(),
      providers: {
        tmdb: Boolean(tmdbKey()),
        omdb: Boolean(omdbKey()),
        watchmode: Boolean(watchmodeKey()),
      },
      aiAvailable: Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_BASE_URL),
    });
  });

  return httpServer;
}
