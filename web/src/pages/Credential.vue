<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import Fingerprint from "../components/Fingerprint.vue";
import VerdictPanel from "../components/VerdictPanel.vue";
import { isCredentialId, verifyById, type Verdict } from "../lib/registry";

const id = String(useRoute().params.id);
const verdict = ref<Verdict | null>(null);
const error = ref("");
onMounted(async () => {
  if (!isCredentialId(id)) {
    error.value = "This link isn't a valid credential link. Check it wasn't cut off.";
    return;
  }
  try {
    verdict.value = await verifyById(id);
  } catch (e) {
    error.value = e instanceof Error && e.message.includes("connected") ? e.message : "The public record can't be reached right now. Try again shortly.";
  }
});
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-14">
    <h1 class="sr-only">Credential record</h1>
    <div v-if="verdict" class="glass grid gap-6 p-7 sm:grid-cols-[1fr_9rem]">
      <VerdictPanel :verdict="verdict" />
      <Fingerprint v-if="verdict.status !== 'not_found'" :hash="verdict.fileHash" class="size-36 text-periwinkle" />
    </div>
    <p v-else-if="error" class="text-seal">{{ error }}</p>
    <p v-else>Reading the public record</p>
  </section>
</template>
