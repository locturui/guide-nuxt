<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { extractErrorMessage } from "@/types/errors";
import { downloadFromApi } from "@/utils/download-file";

definePageMeta({
  middleware: "auth",
  name: "agency-reports",
});

const auth = useAuthStore();

const exportStartDate = ref<Date | null>(null);
const exportEndDate = ref<Date | null>(null);
const exportLoading = ref(false);
const exportError = ref("");
const exportSuccess = ref(false);

const today = new Date();

function formatDateForApi(d: Date): string {
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
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
      `/api/reports/export/excel/agency?start_date=${encodeURIComponent(startStr)}&end_date=${encodeURIComponent(endStr)}`,
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
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Отчеты
        </h1>
      </header>

      <Card>
        <template #title>
          <span class="text-xl font-semibold">Экспорт подробного отчета</span>
        </template>
        <template #content>
          <div class="space-y-4">
            <p class="text-sm text-surface-600">
              Выгрузите подробный Excel отчет по вашему агентству и группам за выбранный период.
            </p>
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
            <div class="flex items-center gap-3">
              <Button
                label="Экспортировать"
                icon="pi pi-download"
                :loading="exportLoading"
                :disabled="exportLoading || !exportStartDate || !exportEndDate"
                @click="exportReports"
              />
              <Message
                v-if="exportSuccess"
                severity="success"
                class="m-0"
              >
                Отчет успешно загружен
              </Message>
              <Message
                v-if="exportError"
                severity="error"
                class="m-0"
              >
                {{ exportError }}
              </Message>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
