<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute, useRouter } from "vue-router";
import { Building2, FileText, Inbox, LayoutDashboard, LogOut, Menu, Settings, Users, X } from "lucide-vue-next";
import { api, session, setSession } from "../../lib/api";

const route = useRoute();
const router = useRouter();
const open = ref(false);
const institution = ref("");
const storage = ref<number | null>(null);
const isStaff = computed(() => session.current && session.current.role !== "platform");

const nav = computed(() => {
  const role = session.current?.role;
  if (role === "platform") return [
    { to: "/app/platform", label: "Dashboard", icon: LayoutDashboard, exact: true },
    { to: "/app/platform/institutions", label: "Institutions", icon: Building2 },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ];
  return [
    { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/app/inbox", label: "Inbox", icon: Inbox },
    ...(role === "admin" ? [{ to: "/app/operators", label: "Operators", icon: Users }] : []),
    { to: "/app/documents", label: "Documents", icon: FileText },
    { to: "/app/settings", label: "Settings", icon: Settings },
  ];
});
const isActive = (item: { to: string; exact?: boolean }) =>
  item.exact ? route.path === item.to : route.path.startsWith(item.to) || (item.to === "/app/inbox" && route.path.startsWith("/app/requests"));

const size = computed(() => {
  const b = storage.value ?? 0;
  if (b < 1024 ** 2) return `${Math.ceil(b / 1024)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  return `${(b / 1024 ** 3).toFixed(2)} GB`;
});

async function refreshStorage() {
  if (isStaff.value) storage.value = await api<{ storageBytes: number }>("/stats").then((s) => s.storageBytes).catch(() => null);
}
onMounted(async () => {
  if (isStaff.value) institution.value = await api<{ institution: string }>("/me").then((m) => m.institution).catch(() => "");
  refreshStorage();
});
watch(() => route.path, () => {
  open.value = false;
  refreshStorage();
});
// An expired session clears itself in api(), wherever the failing call was made.
watch(() => session.current, (s) => {
  if (!s) router.replace("/sign-in");
});
async function signOut() {
  await router.push("/"); // Leave first, or the watcher above would send them to sign-in.
  setSession(null);
}
</script>

<template>
  <a href="#console-main" class="sr-only focus:not-sr-only focus:absolute focus:z-40 focus:bg-white focus:p-3">Skip to content</a>
  <div class="min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
    <div v-if="open" class="fixed inset-0 z-30 bg-harbour-deep/50 lg:hidden" @click="open = false"></div>
    <aside :class="[open ? 'flex' : 'hidden', 'fixed inset-y-0 left-0 z-40 m-2 w-64 flex-col overflow-hidden rounded-md bg-sky lg:sticky lg:top-2 lg:flex lg:h-[calc(100vh-1rem)] lg:w-auto']">
      <div class="relative flex justify-center bg-crest py-2">
        <RouterLink to="/app" aria-label="Legitify console home"><img src="/seal.jpg" alt="" class="crest-mark size-24" /></RouterLink>
        <button class="absolute right-2 top-2 rounded p-1 text-harbour lg:hidden" aria-label="Close menu" @click="open = false"><X class="size-5" aria-hidden="true" /></button>
      </div>
      <nav class="mt-3 flex-1 space-y-1 overflow-y-auto px-2" aria-label="Console">
        <RouterLink v-for="item in nav" :key="item.to" :to="item.to" :class="['flex items-center gap-3 rounded px-3 py-2.5 font-semibold', isActive(item) ? 'bg-harbour text-white' : 'text-harbour hover:bg-white/45']" :aria-current="isActive(item) ? 'page' : undefined">
          <span class="grid size-6 place-items-center rounded-full border-2 border-current"><component :is="item.icon" class="size-3.5" aria-hidden="true" /></span>
          {{ item.label }}
        </RouterLink>
      </nav>
      <div v-if="storage !== null" class="m-3 rounded-md bg-white p-4 text-harbour shadow">
        <p class="text-sm">Encrypted storage used</p>
        <p class="text-xl font-bold">{{ size }}</p>
      </div>
    </aside>

    <div class="min-w-0">
      <header class="m-2 flex items-center justify-between gap-3 rounded-md bg-white px-4 py-2 shadow-sm">
        <div class="flex min-w-0 items-center gap-3">
          <button class="rounded p-1 text-harbour lg:hidden" aria-label="Open menu" :aria-expanded="open" @click="open = true"><Menu class="size-6" aria-hidden="true" /></button>
          <p class="min-w-0 leading-tight">
            <span class="block text-xl font-bold text-ink">Legitify</span>
            <span class="block truncate font-semibold text-approve">{{ isStaff ? institution : "Platform administration" }}</span>
          </p>
        </div>
        <button class="rounded p-2 text-harbour hover:bg-paper-deep" aria-label="Sign out" title="Sign out" @click="signOut"><LogOut class="size-5" aria-hidden="true" /></button>
      </header>
      <main id="console-main" class="m-2 rounded-md bg-paper p-4 sm:p-5"><RouterView :key="route.path" /></main>
    </div>
  </div>
</template>
