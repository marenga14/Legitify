<script setup lang="ts">
import { chainId, explorerUrl, networkName, registryAddress, rpcUrl } from "../lib/config";
import { t } from "../lib/i18n";
const sample = `import { createPublicClient, http, parseAbi } from "viem";

const client = createPublicClient({ transport: http("${rpcUrl}") });
const abi = parseAbi([
  "function credentialIdByHash(bytes32) view returns (bytes32)",
]);

const id = await client.readContract({
  address: "${registryAddress ?? "0xRegistryAddress"}",
  abi,
  functionName: "credentialIdByHash",
  args: [sha256OfFile],
});`;
</script>

<template>
  <section class="mx-auto max-w-5xl px-6 py-14">
    <h1 class="text-6xl">{{ t("developers.title") }}</h1>
    <p class="mt-5 max-w-2xl text-xl text-ink-soft">{{ t("developers.sub") }}</p>
    <h2 class="mt-12 text-3xl">{{ t("developers.network") }}</h2>
    <dl class="mt-4 space-y-2">
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">{{ t("developers.network") }}</dt><dd>{{ t("developers.networkValue", { network: networkName, id: chainId }) }}</dd></div>
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">{{ t("developers.rpc") }}</dt><dd class="hash">{{ rpcUrl }}</dd></div>
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">{{ t("developers.registry") }}</dt><dd class="hash">{{ registryAddress ?? t("developers.notDeployed") }}</dd></div>
      <div v-if="explorerUrl" class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">{{ t("developers.explorer") }}</dt><dd><a class="link" :href="explorerUrl" rel="noopener">{{ explorerUrl }}</a></dd></div>
    </dl>
    <h2 class="mt-12 text-3xl">{{ t("developers.lookup") }}</h2>
    <p class="mt-3 text-ink-soft">{{ t("developers.lookupBefore") }}<code class="hash">verifyById</code>{{ t("developers.lookupAfter") }}</p>
    <pre class="mt-4 overflow-x-auto glass p-5 text-sm text-ink"><code>{{ sample }}</code></pre>
  </section>
</template>
