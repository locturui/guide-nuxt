<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  name: "agency-bonus-program",
});

const auth = useAuthStore();
const guidesStore = useGuidesStore();

if (auth.role !== "agency" && auth.role !== "vendor") {
  throw createError({
    statusCode: 403,
    statusMessage: "Access denied. Agency and vendor only.",
  });
}

const guides = computed(() => guidesStore.items);

const searchQuery = ref("");

const filteredGuides = computed(() => {
  if (!searchQuery.value.trim()) {
    return guides.value;
  }
  const query = searchQuery.value.toLowerCase();
  return guides.value.filter(guide =>
    guide.name.toLowerCase().includes(query)
    || guide.lastname.toLowerCase().includes(query)
    || `${guide.name} ${guide.lastname}`.toLowerCase().includes(query),
  );
});

onMounted(async () => {
  await guidesStore.fetchAll();
});
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Бонусная программа
        </h1>
        <p class="text-surface-600">
          Бонусные баллы ваших гидов
        </p>
      </header>

      <!-- Guides List Card -->
      <Card>
        <template #title>
          <div class="flex items-center justify-between">
            <span class="text-lg font-semibold">Текущие баллы гидов</span>
            <div class="flex items-center gap-2">
              <IconField icon-position="left">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model="searchQuery"
                  placeholder="Поиск по имени"
                  class="w-full"
                />
              </IconField>
            </div>
          </div>
        </template>
        <template #content>
          <DataTable
            :value="filteredGuides"
            :paginator="filteredGuides.length > 10"
            :rows="10"
            data-key="id"
            class="p-datatable-sm"
            :loading="guidesStore.loading"
          >
            <Column
              field="name"
              header="Имя"
              sortable
            >
              <template #body="{ data }">
                {{ data.name }} {{ data.lastname }}
              </template>
            </Column>
            <Column
              field="bonus_points"
              header="Бонусные баллы"
              sortable
            >
              <template #body="{ data }">
                <span
                  :class="{
                    'text-green-600 font-semibold': data.bonus_points > 0,
                    'text-red-600': data.bonus_points < 0,
                    'text-surface-600': data.bonus_points === 0,
                  }"
                >
                  {{ data.bonus_points }}
                </span>
              </template>
            </Column>
          </DataTable>

          <div v-if="!guidesStore.loading && filteredGuides.length === 0" class="text-center py-8">
            <p class="text-surface-600">
              {{ searchQuery ? 'Гиды не найдены' : 'У вас пока нет гидов' }}
            </p>
          </div>

          <div v-if="guidesStore.error" class="mt-4">
            <Message severity="error" :closable="false">
              {{ guidesStore.error }}
            </Message>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
