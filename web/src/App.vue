<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import BrandMark from "./components/BrandMark.vue";
import { session } from "./lib/api";
import { networkName } from "./lib/config";

const route = useRoute();
const consoleArea = computed(() => route.path.startsWith("/app"));
const open = ref(false);
watch(() => route.path, () => (open.value = false));
const links = [
  { to: "/verify", label: "Check a document" },
  { to: "/institutions", label: "Institutions" },
  { to: "/verifiers", label: "Employers" },
  { to: "/developers", label: "Developers" },
];
</script>

<template>
  <RouterView v-if="consoleArea" />
  <div v-else class="public-shell">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:p-3 focus:bg-sheet">Skip to content</a>
    <header class="relative z-30">
      <div class="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-5">
        <RouterLink to="/" class="flex items-center gap-2 text-xl font-bold tracking-tight"><BrandMark />Legitify</RouterLink>
        <button class="btn btn-quiet md:hidden" :aria-expanded="open" aria-controls="nav" @click="open = !open">Menu</button>
        <nav id="nav" :class="[open ? 'flex' : 'hidden', 'absolute inset-x-0 top-20 flex-col gap-1 bg-paper-deep px-6 pb-5 pt-2 shadow-xl md:static md:flex md:flex-1 md:flex-row md:items-center md:justify-end md:gap-8 md:bg-transparent md:p-0 md:shadow-none']" aria-label="Main">
          <RouterLink v-for="l in links" :key="l.to" :to="l.to" class="py-2 text-sm font-medium text-ink-soft hover:text-ink" active-class="text-ink underline decoration-periwinkle decoration-2 underline-offset-8">{{ l.label }}</RouterLink>
          <RouterLink :to="session.current ? '/app' : '/sign-in'" class="btn mt-2 min-h-10! py-1! text-sm md:mt-0">{{ session.current ? "Open console" : "Staff sign-in" }}</RouterLink>
        </nav>
      </div>
    </header>
    <main id="main" class="relative z-10"><RouterView /></main>
    <footer class="relative z-10 mt-24 border-t border-periwinkle/20">
      <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-ink-soft">
        <p>Credential records are public on {{ networkName }}. Documents and requests are not.</p>
        <RouterLink to="/request" class="link">Ask an institution to confirm a document</RouterLink>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.public-shell { position: relative; min-height: 100vh; overflow: clip; display: flex; flex-direction: column; }
.public-shell > main { flex: 1; }
/* The sweep of light from the reference. Fixed to the top of the page so every public page shares it. */
.public-shell::before {
  content: ""; position: absolute; inset: 0 0 auto; height: 58rem; pointer-events: none;
  background:
    radial-gradient(60rem 34rem at 78% 34%, rgb(92 62 245 / 0.42), transparent 70%),
    radial-gradient(38rem 26rem at 8% 0%, rgb(124 77 255 / 0.26), transparent 70%);
}
.public-shell::after {
  content: ""; position: absolute; top: 25rem; left: 34%; width: 110rem; height: 46rem; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgb(58 40 190 / 0.3), transparent);
  border-top: 1px solid rgb(143 168 255 / 0.2);
}
</style>
