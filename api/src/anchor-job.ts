import path from "node:path";
import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dailyRoot, verifyAuditChain } from "./audit.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";

/** Anchors yesterday's audit root. Refuses if the local chain doesn't verify. */
const config = loadConfig();
if (!config.ANCHOR_ADDRESS || !config.ANCHOR_PRIVATE_KEY) throw new Error("Set ANCHOR_ADDRESS and ANCHOR_PRIVATE_KEY");

const db = await openDb(path.join(config.DATA_DIR, "db"));
const broken = await verifyAuditChain(db);
if (broken !== null) throw new Error(`Audit chain broken at seq ${broken}; not anchoring`);

const yesterday = new Date(Date.now() - 86_400_000);
const root = await dailyRoot(db, yesterday);
if (!root) {
  console.log("Nothing to anchor");
  process.exit(0);
}

const abi = parseAbi(["function anchor(uint32 day, bytes32 root)"]);
const transport = http(config.RPC_URL);
const client = createPublicClient({ transport });
const wallet = createWalletClient({ account: privateKeyToAccount(config.ANCHOR_PRIVATE_KEY as Hex), transport });
const hash = await wallet.writeContract({
  address: config.ANCHOR_ADDRESS as Address,
  abi,
  functionName: "anchor",
  args: [Math.floor(yesterday.getTime() / 86_400_000), `0x${root}`],
  chain: null,
});
await client.waitForTransactionReceipt({ hash });
console.log("Anchored", hash);
