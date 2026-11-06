<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { Plus } from "lucide-vue-next";
import PageHead from "../../components/console/PageHead.vue";
import { api } from "../../lib/api";
import { longDate, newCredentialId, shortId, stampCertificate, STATUS_LABELS } from "../../lib/certificate";
import { sha256File } from "../../lib/hash";
import { canWrite, issue } from "../../lib/wallet";

interface Row { id: string; owner_name: string; title: string; created_at: string; status: string }
const router = useRouter();
const rows = ref<Row[] | null>(null);
const error = ref("");
const dialog = ref<HTMLDialogElement>();
const form = reactive({ ownerName: "", title: "", description: "" });
const file = ref<File>();
const step = ref("");
const formError = ref("");

onMounted(async () => {
  try {
    rows.value = await api("/credentials");
  } catch (e) {
    error.value = (e as Error).message;
  }
});

function start(chosen?: File) {
  file.value = chosen;
  formError.value = "";
  dialog.value?.showModal();
}

async function create() {
  if (!file.value) return;
  formError.value = "";
  const id = newCredentialId();
  try {
    step.value = "Stamping the QR code";
    const stamped = await stampCertificate(file.value, id);
    const hash = await sha256File(stamped);
    step.value = "Saving the encrypted file";
    const body = new FormData();
    body.set("credentialId", id);
    for (const [k, v] of Object.entries(form)) body.set(k, v);
    body.set("file", stamped);
    await api("/credentials", { method: "POST", body });
    if (canWrite()) {
      step.value = "Waiting for your wallet";
      // Saved already: if this step fails, Document details offers to publish again.
      await issue(id, hash).catch(() => undefined);
    }
    router.push(`/app/documents/${id}`);
  } catch (e) {
    formError.value = (e as Error).message;
  } finally {
    step.value = "";
  }
}
</script>

<template>
  <PageHead title="Documents">
    <button class="btn btn-quiet bg-white!" @click="start()"><Plus class="size-4" aria-hidden="true" />Create certificate</button>
  </PageHead>
  <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>

  <div class="mt-4 rounded-md bg-gradient-to-r from-white to-sky p-6 shadow-sm">
    <button
      class="grid h-28 w-40 place-items-center rounded border-2 border-dashed border-harbour/60 bg-[#e6e8eb] text-harbour hover:bg-white"
      aria-label="Create certificate"
      @click="start()"
      @dragover.prevent
      @drop.prevent="start($event.dataTransfer?.files[0])"
    ><Plus class="size-8" aria-hidden="true" /></button>
  </div>

  <p v-if="rows?.length === 0" class="panel mt-4 p-6">No certificates yet. Create one to publish its fingerprint to the public record.</p>
  <div v-if="rows?.length" class="panel mt-4 overflow-x-auto" tabindex="0" role="region" aria-label="Certificates">
    <table class="data-table">
      <thead class="bg-gradient"><tr><th>No</th><th>Certificate ID</th><th>Certificate owner</th><th>Created date</th><th>Purpose</th><th>Status</th><th>Actions</th></tr></thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.id">
          <td>{{ i + 1 }}</td>
          <td class="hash" :title="r.id">{{ shortId(r.id) }}</td>
          <td>{{ r.owner_name }}</td>
          <td class="whitespace-nowrap">{{ longDate(r.created_at) }}</td>
          <td>{{ r.title }}</td>
          <td class="whitespace-nowrap">{{ STATUS_LABELS[r.status] }}</td>
          <td><RouterLink :to="`/app/documents/${r.id}`" class="btn btn-view" :aria-label="`View ${r.owner_name}, ${r.title}`">View</RouterLink></td>
        </tr>
      </tbody>
    </table>
  </div>

  <dialog ref="dialog" class="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg p-0 backdrop:bg-harbour-deep/50">
    <form class="space-y-4 p-6" @submit.prevent="create">
      <h2 class="text-xl">Create certificate</h2>
      <label class="block">Certificate owner<input v-model="form.ownerName" class="field mt-1" required minlength="2" maxlength="200" /></label>
      <label class="block">Purpose<input v-model="form.title" class="field mt-1" required minlength="2" maxlength="200" placeholder="BSc in Computer Science" /></label>
      <label class="block">Description<textarea v-model="form.description" class="field mt-1" rows="2" maxlength="2000"></textarea></label>
      <label class="block">Certificate (PDF, up to 15 MB)
        <input type="file" accept="application/pdf" class="field mt-1" :required="!file" @change="file = ($event.target as HTMLInputElement).files?.[0]" />
      </label>
      <p v-if="file" class="text-sm text-ink-soft">{{ file.name }}</p>
      <p class="text-sm text-ink-soft">A QR code is added to the last page. The stamped copy is the one that verifies, so give that copy to the holder.</p>
      <p v-if="formError" class="text-seal" role="alert">{{ formError }}</p>
      <div class="flex justify-end gap-3">
        <button type="button" class="btn btn-quiet" :disabled="!!step" @click="dialog?.close()">Cancel</button>
        <button class="btn" :disabled="!!step">{{ step || "Create certificate" }}</button>
      </div>
    </form>
  </dialog>
</template>
