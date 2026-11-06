<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import BarChart from "../../components/console/BarChart.vue";
import { api, session } from "../../lib/api";
import { t } from "../../lib/i18n";

interface Stats {
  operators: number; documents: number; openRequests: number; answered: number;
  documentsByMonth: { month: string; count: number }[]; requestsByMonth: { month: string; count: number }[];
}
const stats = ref<Stats | null>(null);
const institution = ref("");
const error = ref("");
onMounted(async () => {
  try {
    [stats.value, { institution: institution.value }] = await Promise.all([api<Stats>("/stats"), api<{ institution: string }>("/me")]);
  } catch (e) {
    error.value = (e as Error).message;
  }
});
const cards = computed(() => {
  const s = stats.value;
  if (!s) return [];
  return [
    ...(session.current?.role === "admin" ? [{ name: t("dashboard.operators"), number: s.operators, to: "/app/operators" }] : []),
    { name: t("dashboard.documents"), number: s.documents, to: "/app/documents" },
    { name: t("dashboard.openRequests"), number: s.openRequests, to: "/app/inbox" },
    { name: t("dashboard.answered"), number: s.answered, to: "/app/inbox" },
  ];
});
</script>

<template>
  <h1 class="sr-only">{{ t("dashboard.title") }}</h1>
  <p v-if="error" class="text-seal" role="alert">{{ error }}</p>
  <div class="relative flex min-h-36 items-center justify-between overflow-hidden rounded-md bg-gradient-to-r from-white via-[#d6eef8] to-sky px-7 py-5 shadow-sm">
    <p class="text-2xl font-bold text-harbour">{{ institution }}</p>
    <span class="grid size-28 shrink-0 place-items-center rounded-full border border-approve/50 bg-white"><img src="/seal.jpg" alt="" class="crest-mark size-20" /></span>
  </div>
  <div v-if="stats" class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <RouterLink v-for="c in cards" :key="c.name" :to="c.to" class="panel overflow-hidden hover:shadow-md">
      <span class="block border-b border-[#dfe5e9] bg-[#f1f3f5] px-4 py-2.5 text-lg font-bold text-harbour">{{ c.name }}</span>
      <span class="block py-6 text-center text-6xl font-extrabold text-harbour">{{ c.number.toLocaleString() }}</span>
    </RouterLink>
  </div>
  <div v-if="stats" class="mt-4 grid gap-3 xl:grid-cols-2">
    <BarChart :title="t('dashboard.certificatesChart')" :noun="t('dashboard.certificatesNoun')" :data="stats.documentsByMonth" />
    <BarChart :title="t('dashboard.requestsChart')" :noun="t('dashboard.requestsNoun')" :data="stats.requestsByMonth" />
  </div>
</template>
