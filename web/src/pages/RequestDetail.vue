<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import { useRoute } from "vue-router";
import PageHead from "../components/console/PageHead.vue";
import { api } from "../lib/api";

interface Triage {
  documentType: string; claimedIssuer: string | null; credentialTitle: string | null; issueDate: string | null;
  referenceNumber: string | null; summary: string; riskLevel: string; riskFlags: { code: string; explanation: string }[]; confidence: number;
}
interface Req {
  id: string; subject: string; purpose: string; requester_org: string; requester_email: string; status: string; level: number;
  escalation_reason: string | null; registry_status: string; registry_institution: string | null; triage_status: string;
  triage: Triage | null; consent_agent: boolean; file_name: string; answer_outcome: string | null; answer_note: string | null; receipt_hash: string | null;
}
const LEVELS: Record<number, string> = { 1: "Officer", 2: "Registrar", 3: "Legal" };
const REGISTRY: Record<string, string> = {
  authentic: "This exact file is on your public record and in force.",
  revoked: "This exact file is on the public record, and it was revoked.",
  replaced: "This exact file is on the public record, and a newer version exists.",
  suspended: "This file is on the public record under a suspended institution.",
  not_found: "This exact file isn't on the public record.",
  unchecked: "The public record couldn't be checked for this file.",
};
const ACTIONS: Record<string, string> = {
  "request.received": "Request received", "triage.done": "Agent read the document", "triage.unavailable": "Agent couldn't read the document",
  "request.escalated": "Escalated", "request.claimed": "Claimed by staff", "file.viewed": "File viewed", "request.answered": "Answered",
};

const id = String(useRoute().params.id);
const r = ref<Req | null>(null);
const log = ref<{ action: string; actor: string; created_at: string }[]>([]);
const fileUrl = ref("");
const error = ref("");
const answer = reactive({ outcome: "confirmed", note: "" });
const escalating = ref(false);
const reason = ref("");

async function load() {
  try {
    r.value = await api<Req>(`/requests/${id}`);
    log.value = await api(`/requests/${id}/audit`);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function act(path: string, body: unknown) {
  error.value = "";
  try {
    await api(`/requests/${id}/${path}`, { method: "POST", body: JSON.stringify(body) });
    await load();
    return true;
  } catch (e) {
    error.value = (e as Error).message;
    return false;
  }
}
async function openFile() {
  try {
    fileUrl.value = URL.createObjectURL(await api<Blob>(`/requests/${id}/file`));
    await load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
async function escalate() {
  if (await act("escalate", { reason: reason.value })) {
    escalating.value = false;
    reason.value = "";
  }
}
onMounted(load);
onBeforeUnmount(() => fileUrl.value && URL.revokeObjectURL(fileUrl.value));

const agentNote = computed(() => {
  if (!r.value) return "";
  if (r.value.triage) return "";
  if (!r.value.consent_agent) return "The requester didn't consent to the agent reading this.";
  return r.value.triage_status === "unavailable" ? "The agent couldn't read this document." : "The agent is off for your institution.";
});
</script>

<template>
  <PageHead :title="r?.subject ?? 'Request'" back="/app/inbox" back-label="Back to inbox" />
  <section>
    <p v-if="error" class="mt-4 text-seal" role="alert">{{ error }}</p>
    <div v-if="r" class="mt-4 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div class="panel p-5">
        <p class="mt-2 text-ink-soft">From {{ r.requester_org }} (<a class="link" :href="`mailto:${r.requester_email}`">{{ r.requester_email }}</a>), {{ LEVELS[r.level] }} level</p>
        <p v-if="r.escalation_reason" class="mt-2 font-semibold text-seal">{{ r.escalation_reason }}</p>
        <p class="mt-4 max-w-prose whitespace-pre-line">{{ r.purpose }}</p>

        <h2 class="mt-6 text-xl">Public record</h2>
        <p class="mt-2">{{ REGISTRY[r.registry_status] }}</p>

        <h2 class="mt-6 text-xl">Agent's reading</h2>
        <p v-if="agentNote" class="mt-2 text-ink-soft">{{ agentNote }}</p>
        <template v-if="r.triage">
          <p class="mt-1 text-ink-soft">A prompt for your review, not a decision. Reading confidence {{ Math.round(r.triage.confidence * 100) }}%.</p>
          <p class="mt-3 max-w-prose">{{ r.triage.summary }}</p>
          <dl class="mt-4 grid max-w-xl grid-cols-[9rem_1fr] gap-y-1">
            <dt class="text-ink-soft">Claimed issuer</dt><dd>{{ r.triage.claimedIssuer ?? "Not stated" }}</dd>
            <dt class="text-ink-soft">Title</dt><dd>{{ r.triage.credentialTitle ?? "Not stated" }}</dd>
            <dt class="text-ink-soft">Date</dt><dd>{{ r.triage.issueDate ?? "Not stated" }}</dd>
            <dt class="text-ink-soft">Reference</dt><dd>{{ r.triage.referenceNumber ?? "Not stated" }}</dd>
          </dl>
          <ul v-if="r.triage.riskFlags.length" class="mt-4 space-y-1">
            <li v-for="f in r.triage.riskFlags" :key="f.code" class="text-seal">{{ f.explanation }}</li>
          </ul>
        </template>

        <h2 class="mt-6 text-xl">Document</h2>
        <button v-if="!fileUrl" class="btn btn-quiet mt-3" @click="openFile">Open {{ r.file_name }}</button>
        <iframe v-else :src="fileUrl" :title="r.file_name" class="mt-3 h-[34rem] w-full border border-ink/30 bg-white"></iframe>
      </div>

      <aside class="panel self-start p-5">
        <div v-if="r.status === 'answered'">
          <h2 class="text-xl">Answered</h2>
          <p class="mt-2">{{ { confirmed: "Confirmed", not_confirmed: "Not confirmed", needs_information: "More information needed" }[r.answer_outcome!] }}</p>
          <p v-if="r.answer_note" class="mt-2 whitespace-pre-line">{{ r.answer_note }}</p>
          <p class="mt-3 text-ink-soft">Receipt <span class="hash">{{ r.receipt_hash }}</span></p>
        </div>
        <form v-else class="space-y-4" @submit.prevent="act('answer', answer)">
          <h2 class="text-xl">Your answer</h2>
          <fieldset class="space-y-1">
            <legend class="sr-only">Outcome</legend>
            <label class="flex gap-2"><input v-model="answer.outcome" type="radio" value="confirmed" class="accent-stamp" />Confirm this document</label>
            <label class="flex gap-2"><input v-model="answer.outcome" type="radio" value="not_confirmed" class="accent-stamp" />Don't confirm</label>
            <label class="flex gap-2"><input v-model="answer.outcome" type="radio" value="needs_information" class="accent-stamp" />Ask for more information</label>
          </fieldset>
          <label class="block">Note to the requester
            <textarea v-model="answer.note" class="field mt-1" rows="3" maxlength="2000" :required="answer.outcome !== 'confirmed'"></textarea>
          </label>
          <div class="flex flex-wrap gap-3">
            <button class="btn">Send answer</button>
            <button v-if="r.status === 'received'" type="button" class="btn btn-quiet" @click="act('claim', {})">Claim</button>
            <button v-if="r.level < 3" type="button" class="btn btn-quiet" @click="escalating = !escalating">Escalate</button>
          </div>
        </form>
        <form v-if="escalating" class="mt-4 space-y-3" @submit.prevent="escalate">
          <label class="block">Why does this need to go up?<textarea v-model="reason" class="field mt-1" rows="2" required minlength="3"></textarea></label>
          <button class="btn">Escalate to {{ LEVELS[r.level + 1] }}</button>
        </form>

        <h2 class="mt-8 text-xl">History</h2>
        <ol class="mt-3 space-y-2">
          <li v-for="(e, i) in log" :key="i">
            {{ ACTIONS[e.action] ?? e.action }}
            <span class="block text-sm text-ink-soft">{{ new Date(e.created_at).toLocaleString() }}</span>
          </li>
        </ol>
      </aside>
    </div>
  </section>
</template>
