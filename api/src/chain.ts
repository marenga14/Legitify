import { createPublicClient, http, keccak256, parseAbi, type Address, type Hex } from "viem";

export type MemberRole = "none" | "operator" | "admin";
export interface Member {
  institutionId: number;
  role: MemberRole;
}
export type RegistryStatus = "not_found" | "authentic" | "revoked" | "replaced" | "suspended";
export interface RegistryMatch {
  status: RegistryStatus;
  institutionName: string | null;
}
export interface InstitutionInfo {
  id: number;
  name: string;
  active: boolean;
  admin: Address;
}

/** Everything the API reads from chain. Faked in tests. */
export interface Chain {
  platformOwner(): Promise<Address>;
  accountOf(owner: Address): Promise<Address>;
  getMember(account: Address): Promise<Member>;
  canIssue(account: Address): Promise<boolean>;
  verifyByHash(fileHash: Hex): Promise<RegistryMatch>;
  listInstitutions(): Promise<InstitutionInfo[]>;
}

const registryAbi = parseAbi([
  "struct Member { uint32 institutionId; uint8 role; }",
  "struct Institution { address admin; uint8 status; string name; }",
  "struct Credential { address issuer; uint32 institutionId; uint40 issuedAt; uint8 revocationReason; uint40 revokedAt; bytes32 fileHash; bytes32 replacedBy; bytes storageCid; }",
  "struct Verification { uint8 status; bytes32 credentialId; string institutionName; Credential credential; }",
  "function getMember(address) view returns (Member)",
  "function getInstitution(uint32) view returns (Institution)",
  "function institutionCount() view returns (uint32)",
  "function owner() view returns (address)",
  "function canIssue(address) view returns (bool)",
  "function verifyByHash(bytes32) view returns (Verification)",
]);
const factoryAbi = parseAbi(["function getAddress(address owner, uint256 salt) view returns (address)"]);

const ROLES: MemberRole[] = ["none", "operator", "admin"];
const STATUSES: RegistryStatus[] = ["not_found", "authentic", "revoked", "replaced", "suspended"];

export function viemChain(opts: { rpcUrl: string; registry: Address; factory: Address }): Chain {
  const client = createPublicClient({ transport: http(opts.rpcUrl) });
  const registry = { address: opts.registry, abi: registryAbi } as const;
  return {
    platformOwner: () => client.readContract({ ...registry, functionName: "owner" }),
    accountOf: (owner) =>
      client.readContract({ address: opts.factory, abi: factoryAbi, functionName: "getAddress", args: [owner, 0n] }),
    async getMember(account) {
      const m = await client.readContract({ ...registry, functionName: "getMember", args: [account] });
      return { institutionId: m.institutionId, role: ROLES[m.role] ?? "none" };
    },
    canIssue: (account) => client.readContract({ ...registry, functionName: "canIssue", args: [account] }),
    async verifyByHash(fileHash) {
      const v = await client.readContract({ ...registry, functionName: "verifyByHash", args: [fileHash] });
      return { status: STATUSES[v.status] ?? "not_found", institutionName: v.institutionName || null };
    },
    async listInstitutions() {
      const count = await client.readContract({ ...registry, functionName: "institutionCount" });
      const out: InstitutionInfo[] = [];
      for (let id = 1; id <= count; id++) {
        const i = await client.readContract({ ...registry, functionName: "getInstitution", args: [id] });
        out.push({ id, name: i.name, active: i.status === 1, admin: i.admin });
      }
      return out;
    },
  };
}

export const keccakChallenge = (text: string) => keccak256(new TextEncoder().encode(text));
