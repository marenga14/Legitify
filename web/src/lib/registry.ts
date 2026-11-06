import { createPublicClient, http, isHex, parseAbi, type Hex } from "viem";
import { chain, registryAddress } from "./config";

const abi = parseAbi([
  "struct Credential { address issuer; uint32 institutionId; uint40 issuedAt; uint8 revocationReason; uint40 revokedAt; bytes32 fileHash; bytes32 replacedBy; bytes storageCid; }",
  "struct Verification { uint8 status; bytes32 credentialId; string institutionName; Credential credential; }",
  "function verifyByHash(bytes32) view returns (Verification)",
  "function verifyById(bytes32) view returns (Verification)",
  "function institutionCount() view returns (uint32)",
  "function credentialCount() view returns (uint256)",
]);

export type VerdictStatus = "not_found" | "authentic" | "revoked" | "replaced" | "suspended";
const STATUSES: VerdictStatus[] = ["not_found", "authentic", "revoked", "replaced", "suspended"];
const REASONS = ["", "issued in error", "fraud", "withdrawn", "another reason"];

export interface Verdict {
  status: VerdictStatus;
  credentialId: Hex;
  institution: string;
  issuedAt: Date | null;
  revokedAt: Date | null;
  revocationReason: string;
  replacedBy: Hex | null;
  fileHash: Hex;
}

const ZERO = `0x${"0".repeat(64)}`;
export const client = createPublicClient({ chain, transport: http() });
const toDate = (s: number) => (s ? new Date(s * 1000) : null);

function toVerdict(v: {
  status: number; credentialId: Hex; institutionName: string;
  credential: { issuedAt: number; revokedAt: number; revocationReason: number; replacedBy: Hex; fileHash: Hex };
}): Verdict {
  const c = v.credential;
  return {
    status: STATUSES[v.status] ?? "not_found",
    credentialId: v.credentialId,
    institution: v.institutionName,
    issuedAt: toDate(c.issuedAt),
    revokedAt: toDate(c.revokedAt),
    revocationReason: REASONS[c.revocationReason] ?? "",
    replacedBy: c.replacedBy === ZERO ? null : c.replacedBy,
    fileHash: c.fileHash,
  };
}

export const registryConnected = Boolean(registryAddress);
const contract = () => {
  if (!registryAddress) throw new Error("The public registry isn't connected in this environment.");
  return { address: registryAddress, abi } as const;
};

export const verifyByHash = async (hash: Hex) =>
  toVerdict(await client.readContract({ ...contract(), functionName: "verifyByHash", args: [hash] }));
export const verifyById = async (id: Hex) =>
  toVerdict(await client.readContract({ ...contract(), functionName: "verifyById", args: [id] }));
export const isCredentialId = (v: string): v is Hex => isHex(v) && v.length === 66;

export async function registryStats() {
  const [institutions, credentials] = await Promise.all([
    client.readContract({ ...contract(), functionName: "institutionCount" }),
    client.readContract({ ...contract(), functionName: "credentialCount" }),
  ]);
  return { institutions: Number(institutions), credentials: Number(credentials) };
}
