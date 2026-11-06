<script setup lang="ts">
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../lib/api";

const router = useRouter();
const institutions = ref<{ id: number; name: string }[]>([]);
const form = reactive({ institutionId: "", requesterOrg: "", requesterEmail: "", subject: "", purpose: "", consentAgent: false });
const file = ref<File>();
const error = ref("");
const busy = ref(false);

onMounted(async () => {
  try {
    institutions.value = await api("/institutions");
  } catch (e) {
    error.value = (e as Error).message;
  }
});

async function submit() {
  error.value = "";
  if (!file.value) return (error.value = "Attach the document as a PDF.");
  busy.value = true;
  try {
    const body = new FormData();
    for (const [k, v] of Object.entries(form)) body.set(k, String(v));
    body.set("file", file.value);
    const { trackingToken } = await api<{ trackingToken: string }>("/requests", { method: "POST", body });
    router.push(`/track/${trackingToken}`);
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="mx-auto max-w-2xl px-6 py-12">
    <h1 class="text-5xl">Ask an institution to confirm a document</h1>
    <p class="mt-3 text-ink-soft">Your request and the file go only to the institution you choose.</p>
    <form class="glass mt-8 space-y-5 p-7" @submit.prevent="submit">
      <div>
        <label for="institution">Institution</label>
        <select id="institution" v-model="form.institutionId" class="field mt-1" required>
          <option value="" disabled>Choose an institution</option>
          <option v-for="i in institutions" :key="i.id" :value="i.id">{{ i.name }}</option>
        </select>
      </div>
      <label class="block">Your organisation<input v-model="form.requesterOrg" class="field mt-1" required minlength="2" maxlength="200" autocomplete="organization" /></label>
      <label class="block">Work email<input v-model="form.requesterEmail" type="email" class="field mt-1" required autocomplete="email" /></label>
      <label class="block">What are you checking?<input v-model="form.subject" class="field mt-1" required minlength="3" maxlength="200" placeholder="BSc certificate for a job applicant" /></label>
      <label class="block">Why do you need it confirmed?<textarea v-model="form.purpose" class="field mt-1" rows="3" required minlength="3" maxlength="2000"></textarea></label>
      <label class="block">Document (PDF, up to 15 MB)
        <input type="file" accept="application/pdf" class="field mt-1" required @change="file = ($event.target as HTMLInputElement).files?.[0]" />
      </label>
      <label class="flex items-start gap-3">
        <input v-model="form.consentAgent" type="checkbox" class="mt-1.5 size-4 accent-stamp" />
        <span>Let the institution's AI assistant read this document to help staff. It's processed by an external AI provider. Leave this off and only staff will read it.</span>
      </label>
      <p v-if="error" class="text-seal" role="alert">{{ error }}</p>
      <button class="btn" :disabled="busy">{{ busy ? "Sending" : "Send request" }}</button>
    </form>
  </section>
</template>
