<script setup lang="ts">
import { RouterLink } from "vue-router";
import { contactEmail } from "../lib/config";

const items = [
  { title: "One inbox for verification requests", body: "Requests stop arriving through scattered emails and front desks. Each has an owner, a deadline and a history." },
  { title: "An agent that reads first", body: "It summarises each document, pulls out the issuer, title, date and reference, and flags inconsistencies. You turn it on, and requesters consent." },
  { title: "Escalation that doesn't depend on memory", body: "Officers have 72 hours, registrars 48 and legal 24. Overdue requests move up a level automatically." },
  { title: "Your decision, always", body: "The agent can raise a concern but can't answer. Only your staff can confirm a document." },
  { title: "A history you can show an auditor", body: "Every view, escalation and answer is logged in a chain that exposes tampering, and its fingerprint can be published on-chain." },
];
</script>

<template>
  <section class="mx-auto max-w-7xl px-6 py-14">
    <h1 class="max-w-4xl text-6xl">Answer verification requests without the back-and-forth</h1>
    <p class="mt-5 max-w-2xl text-xl text-ink-soft">A private workspace for registrars. Requests come in, the agent prepares them, and your staff decide.</p>
    <div class="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      <div v-for="i in items" :key="i.title" class="glass p-6">
        <h2 class="text-xl">{{ i.title }}</h2>
        <p class="mt-2 max-w-prose text-ink-soft">{{ i.body }}</p>
      </div>
    </div>
    <div class="mt-12 flex flex-wrap gap-3">
      <a v-if="contactEmail" class="btn" :href="`mailto:${contactEmail}?subject=Legitify%20for%20our%20institution`">Talk to us about joining</a>
      <RouterLink to="/sign-in" class="btn btn-quiet">Staff sign-in</RouterLink>
    </div>
  </section>
</template>
