<script setup lang="ts">
import VerifyConsole from "../components/VerifyConsole.vue";
import { t } from "../lib/i18n";
</script>

<template>
  <section class="mx-auto max-w-3xl px-6 py-10">
    <h1 class="text-center text-5xl">{{ t("verify.title") }}</h1>
    <div class="mt-8"><VerifyConsole /></div>
  </section>
</template>
