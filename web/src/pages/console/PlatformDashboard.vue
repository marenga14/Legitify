<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import PageHead from "../../components/console/PageHead.vue";
import { api } from "../../lib/api";
import type { Overview } from "./platform";

const data = ref<Overview | null>(null);
const error = ref("");
onMounted(async () => {
  try {
    data.value = await api("/platform/overview");
  } catch (e) {
    error.value = (e as Error).message;
  }
});
const cards = computed(() => {
  const d = data.value;
  return d ? [
    { name: "Institutions", number: d.institutions.length },
    { name: "Active", number: d.institutions.filter((i) => i.active).length },
    { name: "Documents", number: d.documents },
    { name: "Requests", number: d.requests },
  ] : [];
});
</script>

<template>
  <PageHead title="Dashboard" />
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
  <div class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <div v-for="c in cards" :key="c.name" class="panel overflow-hidden">
      <p class="border-b border-[#dfe5e9] bg-[#f1f3f5] px-4 py-2.5 text-lg font-bold text-harbour">{{ c.name }}</p>
      <p class="py-6 text-center text-6xl font-extrabold text-harbour">{{ c.number.toLocaleString() }}</p>
    </div>
  </div>
  <div v-if="data" class="panel mt-4 overflow-x-auto" tabindex="0" role="region" aria-label="Institutions">
    <table class="data-table">
      <thead class="bg-gradient"><tr><th>No</th><th>Institution</th><th>Location</th><th>Status</th><th>Documents</th><th>Requests</th></tr></thead>
      <tbody>
        <tr v-for="(i, n) in data.institutions" :key="i.id">
          <td>{{ n + 1 }}</td><td>{{ i.name }}</td><td>{{ i.location }}</td><td>{{ i.active ? "Active" : "Suspended" }}</td><td>{{ i.documents }}</td><td>{{ i.requests }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
