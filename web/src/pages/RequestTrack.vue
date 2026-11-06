<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../lib/api";

interface Track {
  subject: string; institution: string; status: string; submittedAt: string; dueAt: string;
  outcome: string | null; note: string | null; answeredAt: string | null; receipt: string | null;
}
const token = String(useRoute().params.token);
const r = ref<Track | null>(null);
const error = ref("");
const link = location.href;
onMounted(async () => {
  try {
    r.value = await api(`/requests/track/${token}`);
  } catch (e) {
    error.value = (e as Error).message;
  }
});
const outcome = computed(() => ({
  confirmed: { title: "Confirmed", tone: "text-approve" },
  not_confirmed: { title: "Not confirmed", tone: "text-seal" },
  needs_information: { title: "More information needed", tone: "text-caution" },
})[r.value?.outcome ?? ""]);
const date = (d: string) => new Date(d).toLocaleDateString(undefined, { dateStyle: "long" });
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-12">
    <p v-if="error" class="text-seal" role="alert">{{ error }}</p>
    <template v-else-if="r">
      <h1 class="text-5xl">{{ r.subject }}</h1>
      <p class="mt-2 text-ink-soft">Sent to {{ r.institution }} on {{ date(r.submittedAt) }}</p>
      <div v-if="outcome" class="mt-8">
        <h2 :class="['text-3xl', outcome.tone]">{{ outcome.title }}</h2>
        <p v-if="r.note" class="mt-2 max-w-prose whitespace-pre-line">{{ r.note }}</p>
        <p class="mt-2 text-ink-soft">{{ r.institution }} answered on {{ date(r.answeredAt!) }}.</p>
        <p class="mt-4 text-ink-soft">Receipt <span class="hash">{{ r.receipt }}</span></p>
      </div>
      <div v-else class="mt-8">
        <h2 class="text-3xl">Waiting for {{ r.institution }}</h2>
        <p class="mt-2 max-w-prose text-ink-soft">{{ r.status === "in_review" ? "Staff are reviewing it." : "It's in their queue." }}</p>
      </div>
      <p class="mt-10 glass p-5">Save this link to check back. It's the only way to reach this request.<br /><span class="hash">{{ link }}</span></p>
    </template>
    <p v-else>Loading your request</p>
  </section>
</template>
