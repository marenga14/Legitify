<script setup lang="ts">
import { RouterLink } from "vue-router";
const results = [
  { title: "Issued", tone: "text-approve", body: "The institution issued this exact file and it's still in force." },
  { title: "Revoked", tone: "text-seal", body: "The institution withdrew it. The result shows when and why." },
  { title: "Replaced", tone: "text-caution", body: "A corrected version exists. Ask the holder for it." },
  { title: "Issuer suspended", tone: "text-caution", body: "The record exists, but confirm with the institution directly." },
  { title: "No record", tone: "text-ink", body: "This file wasn't issued through Legitify. That doesn't make it fake, so ask the institution." },
];
</script>

<template>
  <section class="mx-auto max-w-7xl px-6 py-14">
    <h1 class="max-w-4xl text-6xl">Know a certificate is real before you act on it</h1>
    <p class="mt-5 max-w-2xl text-xl text-ink-soft">Check a file yourself in seconds, or ask the institution directly when there's no record yet.</p>
    <div class="mt-8 flex flex-wrap gap-3">
      <RouterLink to="/verify" class="btn">Check a document</RouterLink>
      <RouterLink to="/request" class="btn btn-quiet">Ask an institution</RouterLink>
    </div>
    <h2 class="mt-16 text-4xl">What each result means</h2>
    <dl class="glass mt-6 max-w-4xl px-6">
      <div v-for="r in results" :key="r.title" class="grid gap-1 border-b border-periwinkle/15 py-4 last:border-0 sm:grid-cols-[12rem_1fr]">
        <dt :class="['text-lg font-semibold', r.tone]">{{ r.title }}</dt>
        <dd class="text-ink-soft">{{ r.body }}</dd>
      </div>
    </dl>
  </section>
</template>
