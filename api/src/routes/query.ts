import { Router } from "express";
import { z } from "zod";

import { composeQuery } from "../compose/compose.js";

export const queryRouter = Router();

const QuerySchema = z.object({
  prompt: z.string().trim().min(1, "prompt is required").max(2000, "prompt is too long"),
  mode: z.enum(["pattern-hunt", "executive-story", "playbook-remix"]),
  safeDemo: z.boolean().optional().default(false),
});

queryRouter.post("/", (req, res) => {
  const parsed = QuerySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  try {
    res.json(composeQuery(parsed.data));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    res.status(500).json({ error: message });
  }
});
