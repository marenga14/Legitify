<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import type { Address } from "viem";
import PageHead from "../../components/console/PageHead.vue";
import { api } from "../../lib/api";
import { shortId } from "../../lib/certificate";
import { registryStats } from "../../lib/registry";
import { registerInstitution, setInstitutionActive } from "../../lib/wallet";
import type { Institution, Overview } from "./platform";

const rows = ref<Institution[] | null>(null);
const error = ref("");
const busy = ref<number | "new" | null>(null);
const form = reactive({ name: "", admin: "", location: "" });

async function load() {
  rows.value = (await api<Overview>("/platform/overview")).institutions;
}
async function attempt(key: number | "new", work: () => Promise<void>) {
  error.value = "";
  busy.value = key;
  try {
    await work();
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = null;
  }
}
onMounted(() => load().catch((e) => (error.value = e.message)));

/** This call also makes the API re-read the chain, so the table picks up the change. */
const saveLocation = (id: number, location: string) =>
  api(`/platform/institutions/${id}`, { method: "POST", body: JSON.stringify({ location }) });

const register = () => attempt("new", async () => {
  await registerInstitution(form.name, form.admin as Address);
  await saveLocation((await registryStats()).institutions, form.location);
  Object.assign(form, { name: "", admin: "", location: "" });
});
const toggle = (i: Institution) => attempt(i.id, async () => {
  await setInstitutionActive(i.id, !i.active);
  await saveLocation(i.id, i.location);
});
</script>

<template>
  <PageHead title="Institutions" />
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
  <div v-if="rows" class="panel mt-4 overflow-x-auto" tabindex="0" role="region" aria-label="Institutions">
    <table class="data-table">
      <thead class="bg-gradient"><tr><th>No</th><th>Institution</th><th>Location</th><th>Admin wallet</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="(i, n) in rows" :key="i.id">
          <td>{{ n + 1 }}</td>
          <td>{{ i.name }}</td>
          <td><input v-model="i.location" class="field min-h-9! w-44 py-1!" :aria-label="`Location of ${i.name}`" maxlength="120" @change="attempt(i.id, async () => { await saveLocation(i.id, i.location); })" /></td>
          <td class="hash" :title="i.admin">{{ shortId(i.admin) }}</td>
          <td>{{ i.active ? "Active" : "Suspended" }}</td>
          <td><button class="btn btn-view" :disabled="busy === i.id" @click="toggle(i)">{{ busy === i.id ? "Waiting for your wallet" : i.active ? "Suspend" : "Reactivate" }}</button></td>
        </tr>
      </tbody>
    </table>
  </div>
  <form class="panel mt-4 grid gap-4 p-5 sm:grid-cols-3" @submit.prevent="register">
    <h2 class="text-lg sm:col-span-3">Register an institution</h2>
    <label>Name<input v-model="form.name" class="field mt-1" required minlength="2" /></label>
    <label>Location<input v-model="form.location" class="field mt-1" maxlength="120" /></label>
    <label>Admin wallet<input v-model="form.admin" class="field mt-1 hash" required pattern="0x[0-9a-fA-F]{40}" title="A wallet address: 0x followed by 40 characters" /></label>
    <div class="sm:col-span-3"><button class="btn" :disabled="busy === 'new'">{{ busy === "new" ? "Waiting for your wallet" : "Register institution" }}</button></div>
  </form>
</template>
