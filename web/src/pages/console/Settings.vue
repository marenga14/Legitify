<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import DetailField from "../../components/console/DetailField.vue";
import PageHead from "../../components/console/PageHead.vue";
import { api, session } from "../../lib/api";
import { t } from "../../lib/i18n";
import { networkName } from "../../lib/config";

interface Me { institution: string; role: string; level: number; agentEnabled: boolean }
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
  <PageHead :title="t('settings.title')" />
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
  <dl class="panel mt-4 grid gap-4 p-5 sm:grid-cols-2">
    <DetailField :label="t('settings.role')" :value="t(`settings.roles.${session.current?.role}`)" />
    <DetailField :label="t('settings.network')" :value="networkName" />
    <template v-if="me">
      <DetailField :label="t('settings.institution')" :value="me.institution" />
      <DetailField :label="t('settings.level')" :value="t(`levels.${me.level}`)" />
    </template>
    <DetailField class="sm:col-span-2" :label="t('settings.account')"><span class="hash">{{ session.current?.account }}</span></DetailField>
  </dl>
  <section v-if="me?.role === 'admin'" class="panel mt-4 p-5">
    <h2 class="text-lg">{{ t("settings.assistant") }}</h2>
    <p class="mt-2 max-w-prose text-ink-soft">
      {{ me.agentEnabled ? t("settings.on") : t("settings.off") }} {{ t("settings.assistantBody") }}
    </p>
    <button class="btn mt-4" @click="toggleAgent">{{ me.agentEnabled ? t("settings.turnOff") : t("settings.turnOn") }}</button>
  </section>
</template>
