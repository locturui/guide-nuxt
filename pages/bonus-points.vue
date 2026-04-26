<script setup lang="ts">
import { extractErrorMessage } from "@/types/errors";

definePageMeta({
  middleware: "auth",
  name: "bonus-points",
});

const auth = useAuthStore();
const guidesStore = useGuidesStore();
const agenciesStore = useAgenciesStore();
const bonusPointsStore = useBonusPointsStore();

const isAdmin = computed(() => auth.role === "admin");

if (auth.role !== "admin" && auth.role !== "vendor") {
  throw createError({
    statusCode: 403,
    statusMessage: "Access denied. Admin and vendor only.",
  });
}

const selectedGuide = ref<string>("");
const selectedGuideSubtract = ref<string>("");
const purchaseAmount = ref<number>(0);
const addPoints = ref<number>(0);
const subtractPoints = ref<number>(0);
const operationLoading = ref(false);
const operationError = ref("");
const operationSuccess = ref("");

const guideTableSearch = ref("");

const BONUS_PERCENTAGE = 2;

type Guide = {
  id: string;
  name: string;
  lastname: string;
  agency_id: string;
  bonus_points: number;
};

type Agency = {
  agency_id: string;
  email: string;
  name: string;
};

const guides = computed<Guide[]>(() => guidesStore.items as Guide[]);

const agencies = computed<Agency[]>(() => agenciesStore.items as Agency[]);

onMounted(async () => {
  await Promise.all([
    guidesStore.fetchAll(),
    agenciesStore.fetchAgencies(),
  ]);
});

function resetMessages() {
  operationError.value = "";
  operationSuccess.value = "";
}

async function addBonusPoints() {
  if (!selectedGuide.value || purchaseAmount.value <= 0) {
    operationError.value = "Выберите гида и укажите стоимость покупки";
    return;
  }

  resetMessages();
  operationLoading.value = true;

  try {
    const bonusPoints = Math.round(purchaseAmount.value * BONUS_PERCENTAGE / 100);

    const response = await bonusPointsStore.add({
      guide_id: selectedGuide.value,
      points: bonusPoints,
      percentage: BONUS_PERCENTAGE,
    });

    operationSuccess.value = response.detail || `Начислено ${bonusPoints} баллов (стоимость покупки: ${purchaseAmount.value} руб.)`;

    selectedGuide.value = "";
    purchaseAmount.value = 0;

    await guidesStore.fetchAll();
  }
  catch (e: unknown) {
    operationError.value = extractErrorMessage(e, "Ошибка при добавлении баллов");
  }
  finally {
    operationLoading.value = false;
  }
}

async function addBonusPointsManual() {
  if (!selectedGuide.value || addPoints.value <= 0) {
    operationError.value = "Выберите гида и укажите количество баллов";
    return;
  }

  resetMessages();
  operationLoading.value = true;

  try {
    const response = await bonusPointsStore.addPoints({
      guide_id: selectedGuide.value,
      points: addPoints.value,
    });

    operationSuccess.value = `Начислено ${addPoints.value} баллов. Текущий баланс: ${response.current_points}`;

    selectedGuide.value = "";
    addPoints.value = 0;

    await guidesStore.fetchAll();
  }
  catch (e: unknown) {
    operationError.value = extractErrorMessage(e, "Ошибка при добавлении баллов");
  }
  finally {
    operationLoading.value = false;
  }
}

async function subtractBonusPoints() {
  if (!selectedGuideSubtract.value || subtractPoints.value <= 0) {
    operationError.value = "Выберите гида и укажите количество баллов";
    return;
  }

  resetMessages();
  operationLoading.value = true;

  try {
    const response = await bonusPointsStore.subtract({
      guide_id: selectedGuideSubtract.value,
      points: subtractPoints.value,
    });

    operationSuccess.value = response.detail || `Списано ${subtractPoints.value} баллов`;

    selectedGuideSubtract.value = "";
    subtractPoints.value = 0;

    await guidesStore.fetchAll();
  }
  catch (e: unknown) {
    operationError.value = extractErrorMessage(e, "Ошибка при вычитании баллов");
  }
  finally {
    operationLoading.value = false;
  }
}

function formatGuideName(guide: Guide) {
  return `${guide.name} ${guide.lastname} (${guide.bonus_points} баллов)`;
}

type GuideOption = { label: string; value: string };
const guideOptions = computed<GuideOption[]>(() => {
  return guides.value.map(guide => ({
    label: formatGuideName(guide),
    value: guide.id,
  }));
});

function getAgencyName(agencyId: string) {
  const agency = agencies.value.find(a => a.agency_id === agencyId);
  return agency?.name || `Агентство ${agencyId.substring(0, 8)}...`;
}

const filteredGuidesForTable = computed(() => {
  const q = guideTableSearch.value.trim().toLowerCase();
  if (!q)
    return guides.value;

  return guides.value.filter((g) => {
    const fullName = `${g.name} ${g.lastname}`.toLowerCase();
    const agencyName = getAgencyName(g.agency_id).toLowerCase();
    return fullName.includes(q) || agencyName.includes(q);
  });
});
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto space-y-6">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Управление бонусными баллами
        </h1>
        <p class="text-surface-600">
          Начисление и управление бонусными баллами гидов
        </p>
      </header>

      <Message
        v-if="operationError"
        severity="error"
        :closable="false"
        @close="operationError = ''"
      >
        {{ operationError }}
      </Message>

      <Message
        v-if="operationSuccess"
        severity="success"
        :closable="false"
        @close="operationSuccess = ''"
      >
        {{ operationSuccess }}
      </Message>

      <Card>
        <template #title>
          <span class="text-lg font-semibold">Начислить бонусные баллы</span>
        </template>
        <template #content>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Гид</label>
                <GuidesGuideSelect
                  v-model="selectedGuide"
                  :options="guideOptions"
                />
              </div>
              <div class="flex flex-col gap-2">
                <template v-if="!isAdmin">
                  <label class="text-sm font-medium text-surface-700">Стоимость покупки (руб.)</label>
                  <InputNumber
                    v-model="purchaseAmount"
                    :min="1"
                    placeholder="Стоимость покупки"
                    class="w-full"
                  />
                </template>
                <template v-else>
                  <label class="text-sm font-medium text-surface-700">Баллы</label>
                  <InputNumber
                    v-model="addPoints"
                    :min="1"
                    placeholder="Количество баллов"
                    class="w-full"
                  />
                </template>
              </div>
            </div>
            <div v-if="!isAdmin" class="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                :loading="operationLoading"
                label="Начислить"
                icon="pi pi-plus"
                class="p-button-primary w-full sm:w-auto"
                @click="addBonusPoints"
              />
              <span class="text-sm text-surface-600">
                Будет начислено: {{ Math.round(purchaseAmount * BONUS_PERCENTAGE / 100) }} баллов ({{ BONUS_PERCENTAGE }}% от стоимости)
              </span>
            </div>
            <div v-else class="flex flex-col sm:flex-row sm:items-center gap-2">
              <Button
                :loading="operationLoading"
                label="Начислить"
                icon="pi pi-plus"
                class="p-button-secondary w-full sm:w-auto"
                @click="addBonusPointsManual"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>
          <span class="text-lg font-semibold">Списать бонусные баллы</span>
        </template>
        <template #content>
          <div class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Гид</label>
                <GuidesGuideSelect
                  v-model="selectedGuideSubtract"
                  :options="guideOptions"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Баллы</label>
                <InputNumber
                  v-model="subtractPoints"
                  :min="1"
                  placeholder="Количество баллов"
                  class="w-full"
                />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Button
                :loading="operationLoading"
                label="Списать баллы"
                icon="pi pi-minus"
                severity="danger"
                @click="subtractBonusPoints"
              />
            </div>
          </div>
        </template>
      </Card>

      <Card>
        <template #title>
          <span class="text-lg font-semibold">Текущие баллы гидов</span>
        </template>
        <template #content>
          <div v-if="isAdmin" class="mb-4">
            <IconField icon-position="left" class="w-full">
              <InputIcon>
                <i class="pi pi-search" />
              </InputIcon>
              <InputText
                v-model="guideTableSearch"
                placeholder="Поиск по гиду или агентству"
                class="w-full"
              />
            </IconField>
          </div>
          <DataTable
            :value="filteredGuidesForTable"
            :paginator="filteredGuidesForTable.length > 10"
            :rows="10"
            data-key="id"
            class="p-datatable-sm"
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
            <Column
              field="agency_id"
              header="Агентство"
              sortable
            >
              <template #body="{ data }">
                <span class="text-surface-700">
                  {{ getAgencyName(data.agency_id) }}
                </span>
              </template>
            </Column>
          </DataTable>
        </template>
      </Card>
    </div>
  </div>
</template>
