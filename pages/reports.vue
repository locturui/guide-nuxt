<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import type { Agency } from "@/types/domain";

import { extractErrorMessage } from "@/types/errors";
import { downloadFromApi } from "@/utils/download-file";

definePageMeta({
  middleware: "auth",
  name: "reports",
});

const auth = useAuthStore();
const agenciesStore = useAgenciesStore();

const exportStartDate = ref<Date | null>(null);
const exportEndDate = ref<Date | null>(null);
const exportLoading = ref(false);
const exportError = ref("");
const exportSuccess = ref(false);

const uniqueGuestsLoading = ref(false);
const uniqueGuestsError = ref("");
const uniqueGuestsSuccess = ref(false);
const uniqueGuestsMonth = ref("");
type MonthPickerValue = { year: number; month: number } | Date | string | number;
const uniqueGuestsMonthPickerValue = ref<MonthPickerValue | null>(null);

const monthlyFinancialAgencyId = ref("");
const monthlyFinancialMonth = ref("");
const monthlyFinancialMonthPickerValue = ref<MonthPickerValue | null>(null);
const monthlyFinancialLoading = ref(false);
const monthlyFinancialError = ref("");
const monthlyFinancialSuccess = ref(false);

const agencies = computed(() => agenciesStore.items);
const agencyOptions = computed(() => {
  return agencies.value.map((a: Agency) => ({
    label: a.name || a.email,
    value: a.agency_id,
  }));
});

onMounted(async () => {
  await agenciesStore.fetchAgencies();
});

const today = new Date();

function formatDateForApi(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function isMonthObject(v: unknown): v is { year: number; month: number } {
  return !!v
    && typeof v === "object"
    && "year" in v
    && "month" in v
    && typeof (v as { year?: unknown }).year === "number"
    && typeof (v as { month?: unknown }).month === "number";
}

function onMonthlyMonthSelect(v: MonthPickerValue | null) {
  if (!v) {
    monthlyFinancialMonth.value = "";
    monthlyFinancialMonthPickerValue.value = null;
    return;
  }

  if (isMonthObject(v)) {
    const year = v.year;
    const month = String(v.month + 1).padStart(2, "0");
    monthlyFinancialMonth.value = `${year}-${month}`;
    monthlyFinancialMonthPickerValue.value = v;
  }
  else {
    const d = new Date(v as string | number | Date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    monthlyFinancialMonth.value = `${year}-${month}`;
    monthlyFinancialMonthPickerValue.value = v;
  }
}

function onUniqueGuestsMonthSelect(v: MonthPickerValue | null) {
  if (!v) {
    uniqueGuestsMonth.value = "";
    uniqueGuestsMonthPickerValue.value = null;
    return;
  }

  if (isMonthObject(v)) {
    const year = v.year;
    const month = String(v.month + 1).padStart(2, "0");
    uniqueGuestsMonth.value = `${year}-${month}`;
    uniqueGuestsMonthPickerValue.value = v;
  }
  else {
    const d = new Date(v as string | number | Date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    uniqueGuestsMonth.value = `${year}-${month}`;
    uniqueGuestsMonthPickerValue.value = v;
  }
}

async function exportReports() {
  exportSuccess.value = false;
  exportError.value = "";
  if (!exportStartDate.value || !exportEndDate.value) {
    exportError.value = "Пожалуйста, выберите начальную и конечную даты";
    return;
  }
  const startStr = formatDateForApi(exportStartDate.value);
  const endStr = formatDateForApi(exportEndDate.value);
  exportLoading.value = true;
  try {
    await downloadFromApi(
      `/api/reports/export/excel?start_date=${encodeURIComponent(startStr)}&end_date=${encodeURIComponent(endStr)}`,
      auth.token ?? "",
      "agency_report.xlsx",
    );
    exportSuccess.value = true;
    setTimeout(() => {
      exportSuccess.value = false;
    }, 3000);
  }
  catch (err: unknown) {
    exportError.value = extractErrorMessage(err, "Не удалось выполнить экспорт");
  }
  finally {
    exportLoading.value = false;
  }
}

async function exportUniqueGuests() {
  uniqueGuestsSuccess.value = false;
  uniqueGuestsError.value = "";

  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(uniqueGuestsMonth.value)) {
    uniqueGuestsError.value = "Укажите месяц в формате ГГГГ-ММ";
    return;
  }

  uniqueGuestsLoading.value = true;
  try {
    await downloadFromApi(
      `/api/reports/export/unique-guests?month=${encodeURIComponent(uniqueGuestsMonth.value)}`,
      auth.token ?? "",
      "unique_guests.xlsx",
    );
    uniqueGuestsSuccess.value = true;
    setTimeout(() => {
      uniqueGuestsSuccess.value = false;
    }, 3000);
  }
  catch (err: unknown) {
    uniqueGuestsError.value = extractErrorMessage(err, "Не удалось выполнить экспорт уникальных гостей");
  }
  finally {
    uniqueGuestsLoading.value = false;
  }
}

async function exportMonthlyFinancialReport() {
  monthlyFinancialSuccess.value = false;
  monthlyFinancialError.value = "";

  if (!monthlyFinancialAgencyId.value) {
    monthlyFinancialError.value = "Выберите агентство";
    return;
  }

  const monthRegex = /^\d{4}-\d{2}$/;
  if (!monthRegex.test(monthlyFinancialMonth.value)) {
    monthlyFinancialError.value = "Укажите месяц в формате ГГГГ-ММ";
    return;
  }

  monthlyFinancialLoading.value = true;
  try {
    await downloadFromApi(
      `/api/reports/export/monthly-financial?agency_id=${encodeURIComponent(monthlyFinancialAgencyId.value)}&month=${encodeURIComponent(monthlyFinancialMonth.value)}`,
      auth.token ?? "",
      "financial_report.xlsx",
    );
    monthlyFinancialSuccess.value = true;
    setTimeout(() => {
      monthlyFinancialSuccess.value = false;
    }, 3000);
  }
  catch (err: unknown) {
    monthlyFinancialError.value = extractErrorMessage(err, "Не удалось выполнить экспорт финансового отчета");
  }
  finally {
    monthlyFinancialLoading.value = false;
  }
}
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Отчеты
        </h1>
      </header>

      <ReportsReportExportCard
        title="Экспорт подробного отчета"
        description="Выгрузите подробный Excel отчет по всем агентствам и их группам за выбранный период."
        button-label="Экспортировать"
        button-icon="pi pi-download"
        :loading="exportLoading"
        :disabled="exportLoading || !exportStartDate || !exportEndDate"
        :error="exportError"
        :success="exportSuccess"
        success-message="Отчет успешно загружен"
        @export="exportReports"
      >
        <div class="grid md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Начальная дата</label>
            <Datepicker
              v-model="exportStartDate"
              locale="ru"
              :enable-time-picker="false"
              :auto-apply="true"
              :close-on-auto-apply="true"
              format="dd.MM.yyyy"
              :teleport="false"
              :text-input="false"
              :max-date="today"
              :ui="{ input: 'p-inputtext w-full' }"
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Конечная дата</label>
            <Datepicker
              v-model="exportEndDate"
              locale="ru"
              :enable-time-picker="false"
              :auto-apply="true"
              :close-on-auto-apply="true"
              format="dd.MM.yyyy"
              :teleport="false"
              :text-input="false"
              :max-date="today"
              :ui="{ input: 'p-inputtext w-full' }"
            />
          </div>
        </div>
      </ReportsReportExportCard>

      <ReportsReportExportCard
        class="mt-6"
        title="Экспорт уникальных гостей"
        description="Выгрузите Excel отчет со всеми уникальными гостями (уникальность по ФИО + номер телефона)."
        button-label="Экспортировать уникальных гостей"
        button-icon="pi pi-users"
        :loading="uniqueGuestsLoading"
        :disabled="uniqueGuestsLoading || !uniqueGuestsMonth"
        :error="uniqueGuestsError"
        :success="uniqueGuestsSuccess"
        success-message="Отчет по уникальным гостям успешно загружен"
        @export="exportUniqueGuests"
      >
        <div class="flex flex-col gap-2 max-w-sm">
          <label class="text-sm font-medium text-surface-700">Месяц</label>
          <Datepicker
            v-model="uniqueGuestsMonthPickerValue"
            locale="ru"
            :month-picker="true"
            :year-picker="true"
            :auto-apply="true"
            :close-on-auto-apply="true"
            :enable-time-picker="false"
            :teleport="false"
            :text-input="false"
            :ui="{ input: 'p-inputtext w-full' }"
            @update:model-value="onUniqueGuestsMonthSelect"
          />
        </div>
      </ReportsReportExportCard>

      <ReportsReportExportCard
        class="mt-6"
        title="Ежемесячный финансовый отчет"
        description="Выгрузите финансовый отчет по выбранному агентству за месяц."
        button-label="Экспортировать финансовый отчет"
        button-icon="pi pi-file-excel"
        :loading="monthlyFinancialLoading"
        :disabled="monthlyFinancialLoading || !monthlyFinancialAgencyId || !monthlyFinancialMonth"
        :error="monthlyFinancialError"
        :success="monthlyFinancialSuccess"
        success-message="Финансовый отчет успешно загружен"
        @export="exportMonthlyFinancialReport"
      >
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Агентство</label>
            <Select
              v-model="monthlyFinancialAgencyId"
              :options="agencyOptions"
              option-label="label"
              option-value="value"
              placeholder="Выберите агентство"
              class="w-full"
              filter
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-surface-700">Месяц</label>
            <Datepicker
              v-model="monthlyFinancialMonthPickerValue"
              locale="ru"
              :month-picker="true"
              :year-picker="true"
              :auto-apply="true"
              :close-on-auto-apply="true"
              :enable-time-picker="false"
              :teleport="false"
              :text-input="false"
              :ui="{ input: 'p-inputtext w-full' }"
              @update:model-value="onMonthlyMonthSelect"
            />
          </div>
        </div>
      </ReportsReportExportCard>
    </div>
  </div>
</template>
