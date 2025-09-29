import { Browser, BrowserContext, Page } from "playwright-core";
import { z } from "zod";
import path from "path";
import fs from "fs";

// Zod schemas for validation
export const TwitterConfigSchema = z.object({
  username: z.string(),
  password: z.string(),
  targetProfile: z.string(),
  tweetLimit: z.number().default(20),
  commentLimit: z.number().default(20),
  outputDir: z.string().default(path.join(process.cwd(), "tmp")),
});

export type TwitterConfig = z.infer<typeof TwitterConfigSchema>;

export interface TweetData {
  url: string;
  Tweet: string;
  Likes: string;
  Comments: string[];
}
