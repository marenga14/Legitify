import { createWalletClient, custom, parseAbi, type Address, type Hex } from "viem";
import { session } from "./api";
import { chain, registryAddress } from "./config";
import { t } from "./i18n";
import { client } from "./registry";

const abi = parseAbi([
  "function issue(bytes32 credentialId, bytes32 fileHash, bytes storageCid)",
  "function addOperator(address account)",
  "function registerInstitution(string name, address admin) returns (uint32)",
  "function setInstitutionStatus(uint32 institutionId, uint8 status)",
]);
const SUSPENDED = 2;
const ACTIVE = 1;

export const canWrite = () => session.current?.mode === "eoa";

function friendly(e: unknown) {
  const err = e as { shortMessage?: string; message?: string; code?: number };
  if (err.code === 4001 || /reject|denied/i.test(err.message ?? "")) return new Error(t("errors.walletCancelled"));
  return new Error(err.shortMessage ?? err.message ?? t("errors.walletFailed"));
}

async function send(functionName: string, args: readonly unknown[]) {
  if (!window.ethereum) throw new Error(t("errors.noWallet"));
  if (!registryAddress) throw new Error(t("errors.registryOff"));
  if (!canWrite()) throw new Error(t("errors.smartAccount"));
  try {
    const wallet = createWalletClient({ chain, transport: custom(window.ethereum) });
    const [account] = await wallet.requestAddresses();
    if (account!.toLowerCase() !== session.current!.account.toLowerCase()) {
      throw new Error(t("errors.switchWallet", { account: session.current!.account }));
    }
    await wallet.switchChain({ id: chain.id }).catch(() => undefined);
    const hash = await wallet.writeContract({ account: account!, chain, address: registryAddress, abi, functionName, args } as never);
    const receipt = await client.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") throw new Error(t("errors.txRefused"));
  } catch (e) {
    throw friendly(e);
  }
}

export const issue = (credentialId: Hex, fileHash: Hex) => send("issue", [credentialId, fileHash, "0x"]);
export const addOperator = (account: Address) => send("addOperator", [account]);
export const registerInstitution = (name: string, admin: Address) => send("registerInstitution", [name, admin]);
export const setInstitutionActive = (id: number, active: boolean) => send("setInstitutionStatus", [id, active ? ACTIVE : SUSPENDED]);
