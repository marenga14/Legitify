import path from "node:path";
import { serve } from "@hono/node-server";
import Anthropic from "@anthropic-ai/sdk";
import type { Address } from "viem";
import { claudeTriager } from "./agent.js";
import { createApp, runSlaSweep, syncInstitutions } from "./app.js";
import { viemChain } from "./chain.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

const config = loadConfig();
const db = await openDb(path.join(config.DATA_DIR, "db"));
const chain = viemChain({
  rpcUrl: config.RPC_URL,
  registry: config.REGISTRY_ADDRESS as Address,
  factory: config.ACCOUNT_FACTORY as Address,
});

const app = createApp({
  db,
  chain,
  triager: config.ANTHROPIC_API_KEY ? claudeTriager(new Anthropic()) : null,
  sessionSecret: config.SESSION_SECRET,
  fileMasterKey: config.FILE_MASTER_KEY,
  dataDir: config.DATA_DIR,
  webOrigin: config.WEB_ORIGIN,
  registry: config.REGISTRY_ADDRESS as Address,
  dailySponsorQuota: config.DAILY_SPONSOR_QUOTA,
});

const sync = () => syncInstitutions(db, chain).catch((e) => console.error("institution sync failed", e));
await sync();
setInterval(sync, 5 * 60_000);
setInterval(() => runSlaSweep(db).catch((e) => console.error("sla sweep failed", e)), 10 * 60_000);

serve({ fetch: app.fetch, port: config.PORT, hostname: config.HOST }, () =>
  console.log(`legitify-api on ${config.HOST}:${config.PORT}`),
);
