<script setup lang="ts">
import ServiceAccountsPanel from "@/components/admin/service-accounts-panel.vue";

definePageMeta({
  middleware: "auth",
  name: "service-accounts",
});

const svc = useServiceAccountsStore();

onMounted(() => {
  svc.fetchAll();
});
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Сервисные аккаунты
        </h1>
      </header>

      <ServiceAccountsPanel />
    </div>
  </div>
</template>
