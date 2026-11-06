<script setup lang="ts">
import { chainId, explorerUrl, networkName, registryAddress, rpcUrl } from "../lib/config";
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
    <h1 class="text-6xl">Read the registry from your own software</h1>
    <p class="mt-5 max-w-2xl text-xl text-ink-soft">Credential records are public. Your application or agent can check them directly, with no key and no account.</p>
    <h2 class="mt-12 text-3xl">Network</h2>
    <dl class="mt-4 space-y-2">
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">Network</dt><dd>{{ networkName }}, chain {{ chainId }}</dd></div>
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">RPC</dt><dd class="hash">{{ rpcUrl }}</dd></div>
      <div class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">Registry</dt><dd class="hash">{{ registryAddress ?? "Not deployed on this network yet" }}</dd></div>
      <div v-if="explorerUrl" class="grid sm:grid-cols-[10rem_1fr]"><dt class="text-ink-soft">Explorer</dt><dd><a class="link" :href="explorerUrl" rel="noopener">{{ explorerUrl }}</a></dd></div>
    </dl>
    <h2 class="mt-12 text-3xl">Look up a file</h2>
    <p class="mt-3 text-ink-soft">Hash the exact file with SHA-256, then read its credential ID. <code class="hash">verifyById</code> returns the full status. A zero ID means no record.</p>
    <pre class="mt-4 overflow-x-auto glass p-5 text-sm text-ink"><code>{{ sample }}</code></pre>
  </section>
</template>
