<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { ArrowRight, Briefcase, Building2, FileUp, Fingerprint, GraduationCap, Landmark, ListChecks, ShieldCheck, UserCheck } from "lucide-vue-next";
import VerifyConsole from "../components/VerifyConsole.vue";
import { networkName } from "../lib/config";
import { registryConnected, registryStats } from "../lib/registry";

const stats = ref<{ institutions: number; credentials: number } | null>(null);
const verifier = ref<InstanceType<typeof VerifyConsole>>();
onMounted(async () => {
  if (registryConnected) stats.value = await registryStats().catch(() => null);
});

const steps = [
  { icon: FileUp, title: "Add the document", body: "Drop in a file. It's read on your device, not uploaded." },
  { icon: Fingerprint, title: "Compare its fingerprint", body: "The file's unique fingerprint is compared with the public record." },
  { icon: ListChecks, title: "Read the result", body: "See who issued it and whether it's still in force." },
  { icon: UserCheck, title: "Ask the institution", body: "No record yet? Its staff can confirm the document." },
];
const layers = [
  { where: "Your device", reach: "Never uploaded", body: "A public check computes the file's fingerprint in your browser. The file itself goes nowhere." },
  { where: `Public record on ${networkName}`, reach: "Public", body: "Institutions publish fingerprints, issue dates and their own name. Never a person's details or their files. Anyone can read it, with no account." },
  { where: "Request desk", reach: "Private to one institution", body: "When there's no record, the document goes only to the institution you chose, encrypted at rest. With consent from both sides, an assistant reads it first and flags inconsistencies it finds." },
  { where: "A person", reach: "Accountable", body: "Only staff can confirm a document. Overdue requests move up a level automatically, and each step goes into a tamper-evident history." },
];
const audiences = [
  { icon: GraduationCap, label: "Universities and colleges" },
  { icon: Briefcase, label: "Employers" },
  { icon: Landmark, label: "Banks" },
  { icon: Building2, label: "Public agencies" },
];
</script>

<template>
  <section class="mx-auto grid max-w-7xl items-start gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1fr_1.08fr] lg:pb-24 lg:pt-10">
    <div class="hero-copy lg:pt-24">
      <h1 class="text-[clamp(3.1rem,6.6vw,5.6rem)] leading-[0.98]! tracking-[-0.04em]!">Trust should be <span class="text-verifiable">verifiable.</span></h1>
      <p class="mt-7 max-w-[34rem] text-lg text-ink-soft">
        One verification infrastructure for institutions, employers and individuals. Authenticate credentials, detect inconsistencies and establish trust in every document.
      </p>
      <div class="mt-9 flex flex-wrap gap-3">
        <button class="btn" @click="verifier?.choose()">Check a document <ArrowRight class="size-4" aria-hidden="true" /></button>
        <a href="#infrastructure" class="btn btn-quiet">Explore the infrastructure</a>
      </div>
      <p class="mt-8 flex items-center gap-2 text-sm text-ink-soft"><ShieldCheck class="size-5 text-approve" aria-hidden="true" />Public checks are free and need no account.</p>
    </div>
    <VerifyConsole ref="verifier" />
  </section>

  <section class="relative border-y border-periwinkle/15 bg-paper/70">
    <div class="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[19rem_1fr] lg:items-center">
      <div>
        <h2 class="text-4xl">From a file to <span class="text-verifiable">an answer.</span></h2>
        <p class="mt-4 text-ink-soft">A check takes seconds. When a record can't settle it, a person can.</p>
      </div>
      <ol class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <li v-for="(s, i) in steps" :key="s.title" class="relative glass p-5">
          <component :is="s.icon" class="size-8 text-periwinkle" stroke-width="1.5" aria-hidden="true" />
          <h3 class="mt-4 text-base tracking-normal!">{{ i + 1 }}. {{ s.title }}</h3>
          <p class="mt-2 text-sm text-ink-soft">{{ s.body }}</p>
          <ArrowRight v-if="i < steps.length - 1" class="absolute -right-[1.05rem] top-1/2 z-10 hidden size-4 -translate-y-1/2 text-periwinkle xl:block" aria-hidden="true" />
        </li>
      </ol>
    </div>
  </section>

  <section id="infrastructure" class="mx-auto grid max-w-7xl scroll-mt-8 gap-12 px-6 py-24 lg:grid-cols-[1fr_1.35fr]">
    <div class="lg:sticky lg:top-16 lg:self-start">
      <h2 class="text-5xl">Built in layers, so nobody has to take our word for it.</h2>
      <p class="mt-5 max-w-md text-lg text-ink-soft">Each layer shows only what it needs to. A public check reveals nothing about a person, and a private request reaches only one institution.</p>
      <RouterLink to="/developers" class="link mt-6 inline-block">Read the registry from your own software</RouterLink>
    </div>
    <ol class="rail">
      <li v-for="l in layers" :key="l.where">
        <h3 class="text-2xl">{{ l.where }}</h3>
        <p class="mt-1 text-sm font-semibold text-periwinkle">{{ l.reach }}</p>
        <p class="mt-3 max-w-xl text-ink-soft">{{ l.body }}</p>
      </li>
    </ol>
  </section>

  <section class="mx-auto max-w-7xl px-6">
    <div class="glass flex flex-wrap items-center justify-between gap-x-10 gap-y-6 px-7 py-6">
      <p class="max-w-[15rem] font-semibold">Built for everyone who has to rely on a document</p>
      <ul class="flex flex-wrap gap-x-9 gap-y-3">
        <li v-for="a in audiences" :key="a.label" class="flex items-center gap-2 text-sm text-ink-soft">
          <component :is="a.icon" class="size-5 text-periwinkle" stroke-width="1.5" aria-hidden="true" />{{ a.label }}
        </li>
      </ul>
      <dl v-if="stats" class="flex w-full gap-10 border-t border-periwinkle/20 pt-5">
        <div><dd class="text-2xl font-bold">{{ stats.institutions.toLocaleString() }}</dd><dt class="text-sm text-ink-soft">registered institutions</dt></div>
        <div><dd class="text-2xl font-bold">{{ stats.credentials.toLocaleString() }}</dd><dt class="text-sm text-ink-soft">credentials on record</dt></div>
      </dl>
    </div>
  </section>
</template>

<style scoped>
.hero-copy { animation: arrive 0.8s cubic-bezier(0.2, 0.7, 0.2, 1) both; }
@keyframes arrive { from { opacity: 0; transform: translateY(14px); } }
.rail { position: relative; display: grid; gap: 2.75rem; padding-left: 2.25rem; }
.rail::before { content: ""; position: absolute; left: 0.4rem; top: 0.5rem; bottom: 0.5rem; width: 2px; background: linear-gradient(to bottom, #7c4dff, #8fa8ff); }
.rail li { position: relative; }
.rail li::before { content: ""; position: absolute; left: -2.25rem; top: 0.35rem; width: 0.9rem; height: 0.9rem; border-radius: 50%; background: var(--color-paper); border: 3px solid var(--color-periwinkle); box-shadow: 0 0 14px rgb(124 77 255 / 0.9); }
</style>
