<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { explorerUrl, registryAddress } from "../lib/config";
import type { Verdict } from "../lib/registry";

const props = defineProps<{ verdict: Verdict; fileHash?: string }>();
const when = (d: Date | null) => d?.toLocaleDateString(undefined, { dateStyle: "long" }) ?? "";

const copy = computed(() => {
  const v = props.verdict;
  switch (v.status) {
    case "authentic": return { tone: "text-approve", title: `Issued by ${v.institution}`, body: `This record was issued on ${when(v.issuedAt)} and is still in force.` };
    case "revoked": return { tone: "text-seal", title: "This credential was revoked", body: `${v.institution} revoked it on ${when(v.revokedAt)}. Reason given: ${v.revocationReason}.` };
    case "replaced": return { tone: "text-caution", title: "A newer version exists", body: `${v.institution} replaced this credential with a corrected one. Ask the holder for the current version.` };
    case "suspended": return { tone: "text-caution", title: `Issued by ${v.institution}, which is suspended`, body: `This record was issued on ${when(v.issuedAt)}, but ${v.institution} is currently suspended from Legitify. Confirm with the institution directly.` };
    default: return { tone: "text-ink", title: "No record found", body: "This exact file wasn't issued through Legitify. That doesn't make it fake: older documents and re-saved copies won't match. You can ask the institution to confirm it." };
  }
});
</script>

<template>
  <div role="status">
    <h2 :class="['text-2xl', copy.tone]">{{ copy.title }}</h2>
    <p class="mt-3 max-w-prose">{{ copy.body }}</p>
    <div class="mt-5 flex flex-wrap gap-3">
      <RouterLink v-if="verdict.status === 'not_found'" to="/request" class="btn">Ask the institution</RouterLink>
      <RouterLink v-if="verdict.replacedBy" :to="`/v/${verdict.replacedBy}`" class="btn">View the current version</RouterLink>
      <a v-if="explorerUrl && verdict.status !== 'not_found'" :href="`${explorerUrl}/address/${registryAddress}`" class="btn btn-quiet" rel="noopener">See the public record</a>
    </div>
    <details v-if="fileHash || verdict.status !== 'not_found'" class="mt-5 text-ink-soft">
      <summary class="cursor-pointer">Technical details</summary>
      <dl class="mt-2 space-y-2">
        <div v-if="fileHash"><dt>File fingerprint</dt><dd class="hash">{{ fileHash }}</dd></div>
        <div v-if="verdict.status !== 'not_found'"><dt>Credential ID</dt><dd class="hash">{{ verdict.credentialId }}</dd></div>
      </dl>
    </details>
  </div>
</template>
