import { createWalletClient, custom, parseAbi, type Address, type Hex } from "viem";
import { session } from "./api";
import { chain, registryAddress } from "./config";
import { client } from "./registry";

const abi = parseAbi([
  "function issue(bytes32 credentialId, bytes32 fileHash, bytes storageCid)",
  "function addOperator(address account)",
  "function registerInstitution(string name, address admin) returns (uint32)",
  "function setInstitutionStatus(uint32 institutionId, uint8 status)",
]);
const SUSPENDED = 2;
const ACTIVE = 1;

export const SMART_ACCOUNT_NOTE = "Your wallet signs in through a smart account, which can't publish to the public record from here yet. Ask an admin with a directly registered wallet to do this.";
export const canWrite = () => session.current?.mode === "eoa";

function friendly(e: unknown) {
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (err.code === 4001 || /reject|denied/i.test(err.message ?? "")) return new Error("You cancelled the request in your wallet. Nothing was published.");
  return new Error(err.shortMessage ?? err.message ?? "The wallet request failed.");
}

async function send(functionName: string, args: readonly unknown[]) {
  if (!window.ethereum) throw new Error("No browser wallet was found. Install one to continue.");
  if (!registryAddress) throw new Error("The public registry isn't connected in this environment.");
  if (!canWrite()) throw new Error(SMART_ACCOUNT_NOTE);
  try {
    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
    const [account] = await wallet.requestAddresses();
    if (account!.toLowerCase() !== session.current!.account.toLowerCase()) {
      throw new Error(`Switch your wallet to ${session.current!.account}, the account you signed in with.`);
    }
    await wallet.switchChain({ id: chain.id }).catch(() => undefined);
    const hash = await wallet.writeContract({ account: account!, chain, address: registryAddress, abi, functionName, args } as never);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error("The public record refused this transaction.");
  } catch (e) {
    throw friendly(e);
  }
}

export const issue = (credentialId: Hex, fileHash: Hex) => send("issue", [credentialId, fileHash, "0x"]);
export const addOperator = (account: Address) => send("addOperator", [account]);
export const registerInstitution = (name: string, admin: Address) => send("registerInstitution", [name, admin]);
export const setInstitutionActive = (id: number, active: boolean) => send("setInstitutionStatus", [id, active ? ACTIVE : SUSPENDED]);
