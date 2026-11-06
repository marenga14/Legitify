<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DetailField from "../../components/console/DetailField.vue";
import PageHead from "../../components/console/PageHead.vue";
import { api, session } from "../../lib/api";
import { networkName } from "../../lib/config";

interface Me { institution: string; role: string; level: number; agentEnabled: boolean }
const LEVELS: Record<number, string> = { 1: "Officer", 2: "Registrar", 3: "Legal" };
const ROLES: Record<string, string> = { platform: "Platform administrator", admin: "Institution administrator", operator: "Operator" };
const me = ref<Me | null>(null);
const error = ref("");
const staff = computed(() => session.current?.role !== "platform");

onMounted(async () => {
  if (!staff.value) return;
  try {
    me.value = await api("/me");
  } catch (e) {
    error.value = (e as Error).message;
  }
});
async function toggleAgent() {
  error.value = "";
  const enabled = !me.value!.agentEnabled;
  try {
    await api("/institution/agent", { method: "PUT", body: JSON.stringify({ enabled }) });
    me.value!.agentEnabled = enabled;
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <PageHead title="Settings" />
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
  <dl class="panel mt-4 grid gap-4 p-5 sm:grid-cols-2">
    <DetailField label="Role" :value="ROLES[session.current?.role ?? '']" />
    <DetailField label="Network" :value="networkName" />
    <template v-if="me">
      <DetailField label="Institution" :value="me.institution" />
      <DetailField label="Review level" :value="LEVELS[me.level]" />
    </template>
    <DetailField class="sm:col-span-2" label="Account"><span class="hash">{{ session.current?.account }}</span></DetailField>
  </dl>
  <section v-if="me?.role === 'admin'" class="panel mt-4 p-5">
    <h2 class="text-lg">Document assistant</h2>
    <p class="mt-2 max-w-prose text-ink-soft">
      {{ me.agentEnabled ? "On." : "Off." }} When it's on, an external AI provider reads documents for requesters who consent, and prepares a summary and any inconsistencies it finds. Only staff can answer a request.
    </p>
    <button class="btn mt-4" @click="toggleAgent">{{ me.agentEnabled ? "Turn off assistant" : "Turn on assistant" }}</button>
  </section>
</template>
