<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import PageHead from "../components/console/PageHead.vue";
import { api } from "../lib/api";

interface Row {
  id: string; requester_org: string; subject: string; status: string; level: number; priority: string;
  escalation_reason: string | null; due_at: string; registry_status: string; risk: string | null;
}
interface Me { institution: string; role: string; level: number; agentEnabled: boolean }

const LEVELS: Record<number, string> = { 1: "Officer", 2: "Registrar", 3: "Legal" };
const rows = ref<Row[] | null>(null);
const me = ref<Me | null>(null);
const error = ref("");

async function load() {
  try {
    [me.value, rows.value] = await Promise.all([api<Me>("/me"), api<Row[]>("/inbox")]);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(load);

const urgent = computed(() => (rows.value ?? []).filter((r) => r.priority === "high").length);
const due = (d: string) => {
  const hours = Math.round((new Date(d).getTime() - Date.now()) / 3_600_000);
  if (hours < 0) return `${-hours} hours overdue`;
  return hours < 48 ? `Due in ${hours} hours` : `Due in ${Math.round(hours / 24)} days`;
};
</script>

<template>
  <PageHead title="Inbox">
    <p v-if="me" class="text-ink-soft">{{ LEVELS[me.level] }} level</p>
  </PageHead>
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
  <p v-if="rows && rows.length === 0" class="panel mt-4 p-6">Nothing is waiting. New requests appear here when someone sends one.</p>
  <p v-else-if="urgent" class="mt-4 font-semibold text-seal">{{ urgent }} {{ urgent === 1 ? "needs" : "need" }} attention first</p>
  <div v-if="rows?.length" class="panel mt-4 overflow-x-auto" tabindex="0" role="region" aria-label="Requests">
    <table class="data-table">
      <thead class="bg-gradient"><tr><th>No</th><th>Subject</th><th>From</th><th>Due</th><th>Level</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id">
          <td>{{ i + 1 }}</td>
          <td>
            <span class="font-semibold">{{ r.subject }}</span>
            <span v-if="r.escalation_reason" class="block text-sm text-ink-soft">{{ r.escalation_reason }}</span>
          </td>
          <td>{{ r.requester_org }}</td>
          <td :class="['whitespace-nowrap', r.priority === 'high' && 'font-semibold text-seal']">{{ due(r.due_at) }}</td>
          <td class="whitespace-nowrap">{{ LEVELS[r.level] }}<template v-if="r.status === 'in_review'">, in review</template></td>
          <td><RouterLink :to="`/app/requests/${r.id}`" class="btn btn-view" :aria-label="`View ${r.subject}`">View</RouterLink></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
