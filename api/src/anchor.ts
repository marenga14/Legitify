import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { dailyRoot, verifyAuditChain } from "./audit.js";
import type { Db } from "./db.js";

const DAY_MS = 86_400_000;
const NO_ROOT = `0x${"0".repeat(64)}`;

export interface AnchorTarget {
  rootOf(day: number): Promise<Hex>;
  anchor(day: number, root: Hex): Promise<void>;
}

const abi = parseAbi(["function anchor(uint32 day, bytes32 root)", "function roots(uint32 day) view returns (bytes32)"]);

export function viemAnchor(opts: { rpcUrl: string; address: Address; privateKey: Hex }): AnchorTarget {
  const transport = http(opts.rpcUrl);
  const client = createPublicClient({ transport });
  const wallet = createWalletClient({ account: privateKeyToAccount(opts.privateKey), transport });
  const contract = { address: opts.address, abi } as const;
  return {
    rootOf: (day) => client.readContract({ ...contract, functionName: "roots", args: [day] }),
    async anchor(day, root) {
      const hash = await wallet.writeContract({ ...contract, functionName: "anchor", args: [day, root], chain: null });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") throw new Error(`Anchor transaction failed: ${hash}`);
    },
  };
}

/** Anchors yesterday's root once. Refuses if the local chain doesn't verify. */
export async function anchorYesterday(db: Db, target: AnchorTarget, now = new Date()) {
  const yesterday = new Date(now.getTime() - DAY_MS);
  const day = Math.floor(yesterday.getTime() / DAY_MS);
  if ((await target.rootOf(day)) !== NO_ROOT) return "already_anchored";
  const broken = await verifyAuditChain(db);
  if (broken !== null) throw new Error(`Audit chain broken at seq ${broken}; not anchoring`);
  const root = await dailyRoot(db, yesterday);
  if (!root) return "nothing_to_anchor";
  await target.anchor(day, `0x${root}`);
  return "anchored";
}
