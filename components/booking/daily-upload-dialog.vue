<script setup lang="ts">
import type { DailyListSheet, DailyListsPreviewResponse } from "@/stores/daily-lists";

import { useDailyListsStore } from "@/stores/daily-lists";
import { serializeDailySheets } from "@/utils/daily-lists";

const props = defineProps<{
  onGlobalError?: (message: string) => void;
}>();

const s = useScheduleStore();
const dailyLists = useDailyListsStore();

const showDailyUploadHelp = ref<boolean>(false);
const dailyUploadFile = ref<File | null>(null);
const dailyUploadPending = ref<boolean>(false);
const dailyUploadResult = ref<{ success?: boolean; message?: string; errors?: unknown[] } | null>(null);
const dailyUploadPreview = ref<DailyListsPreviewResponse | null>(null);
const showDailyUploadPreview = ref<boolean>(false);
const editablePreview = ref<DailyListsPreviewResponse | null>(null);
const hasChangesAfterValidation = ref<boolean>(false);
const originalPreview = ref<DailyListsPreviewResponse | null>(null);
function openHelp(): void {
  showDailyUploadHelp.value = true;
}

function openFilePicker(): void {
  dailyUploadResult.value = null;
  dailyUploadFile.value = null;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".xlsx,.xls";
  input.onchange = (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
      dailyUploadFile.value = file;
      uploadDailyList();
    }
  };
  input.click();
}

async function uploadDailyList() {
  if (!dailyUploadFile.value)
    return;

  dailyUploadPending.value = true;
  dailyUploadResult.value = null;
  dailyUploadPreview.value = null;

  try {
    const formData = new FormData();
    formData.append("file", dailyUploadFile.value);

    const response = await dailyLists.uploadDailyList(dailyUploadFile.value);

    if (response?.preview_mode) {
      const hasSheets = Array.isArray(response.sheets) && response.sheets.length > 0;

      if (!hasSheets) {
        const msg = response?.global_errors?.length
          ? response.global_errors.map(err => err.message).filter(Boolean).join("; ")
          : "Файл не содержит пригодных для обработки листов";
        props.onGlobalError?.(msg);
        return;
      }

      dailyUploadPreview.value = response;
      initializeEditablePreview();
      showDailyUploadPreview.value = true;

      dailyUploadResult.value = {
        success: true,
        message: `Предпросмотр готов. Листов: ${response.summary?.total_sheets || 0}, Гостей: ${response.summary?.total_guests || 0}`,
        errors: [],
      };
    }
    else {
      dailyUploadResult.value = {
        success: true,
        message: response?.message || "Файл успешно обработан",
        errors: response?.errors || [],
      };

      await s.fetchWeek();
    }
  }
  catch (error: unknown) {
    const e = error as { data?: { detail?: string; errors?: unknown[]; sheets?: unknown; preview_mode?: boolean } };
    const errorMessage = e?.data?.detail || "Ошибка при загрузке файла";
    const errors = e?.data?.errors || [];
    if (!e?.data?.sheets && !e?.data?.preview_mode) {
      props.onGlobalError?.(String(errorMessage));
    }

    dailyUploadResult.value = {
      success: false,
      message: errorMessage,
      errors,
    };
  }
  finally {
    dailyUploadPending.value = false;
  }
}

async function validateDailyData() {
  if (!editablePreview.value)
    return;

  await nextTick();
  (document.activeElement as HTMLElement | null)?.blur?.();
  await nextTick();

  try {
    const validationData = serializeDailySheets(editablePreview.value.sheets ?? []);

    const response = await dailyLists.validateDailyLists(validationData);

    editablePreview.value = response;
    originalPreview.value = JSON.parse(JSON.stringify(response));
    updateSummaryErrors();
    hasChangesAfterValidation.value = false;

    dailyUploadResult.value = {
      success: true,
      message: `Валидация завершена. Ошибок: ${calcDailyTotalErrors(response)}`,
      errors: [],
    };
  }
  catch (error: unknown) {
    const e = error as { data?: { detail?: string; errors?: unknown[] } };
    dailyUploadResult.value = {
      success: false,
      message: e?.data?.detail || "Ошибка при валидации данных",
      errors: e?.data?.errors || [],
    };
  }
}

async function confirmDailyUpload() {
  if (!editablePreview.value)
    return;

  await nextTick();
  (document.activeElement as HTMLElement | null)?.blur?.();
  await nextTick();

  try {
    const confirmData = serializeDailySheets(editablePreview.value.sheets ?? []);

    const response = await dailyLists.confirmDailyUpload(confirmData);

    dailyUploadResult.value = {
      success: true,
      message: response?.message || "Данные успешно сохранены",
      errors: response?.errors || [],
    };

    showDailyUploadPreview.value = false;
    dailyUploadPreview.value = null;

    await s.fetchWeek();
  }
  catch (error: unknown) {
    const e = error as { data?: { detail?: string; errors?: unknown[] } };
    dailyUploadResult.value = {
      success: false,
      message: e?.data?.detail || "Ошибка при сохранении данных",
      errors: e?.data?.errors || [],
    };
  }
}

function initializeEditablePreview() {
  if (!dailyUploadPreview.value)
    return;

  editablePreview.value = JSON.parse(JSON.stringify(dailyUploadPreview.value));
  originalPreview.value = JSON.parse(JSON.stringify(dailyUploadPreview.value));
  hasChangesAfterValidation.value = false;
}

function dailySheetErrorCount(sheet: DailyListSheet): number {
  let count = 0;
  count += Array.isArray(sheet?.sheet_errors) ? sheet.sheet_errors.length : 0;
  if (Array.isArray(sheet?.guests)) {
    for (const g of sheet.guests) {
      count += Array.isArray(g?.errors) ? g.errors.length : 0;
    }
  }
  return count;
}

function calcDailyTotalErrors(preview: DailyListsPreviewResponse | null): number {
  const sheets = preview?.sheets;
  if (!Array.isArray(sheets) || sheets.length === 0)
    return 0;
  return sheets.reduce((acc: number, sheet: DailyListSheet) => acc + dailySheetErrorCount(sheet), 0);
}

const dailyTotalErrors = computed(() => calcDailyTotalErrors(editablePreview.value));

function updateSummaryErrors() {
  if (!editablePreview.value)
    return;

  if (!editablePreview.value.summary) {
    editablePreview.value.summary = {};
  }

  let totalErrors = 0;
  (editablePreview.value.sheets ?? []).forEach((sheet) => {
    totalErrors += (sheet.sheet_errors || []).length;
    if (sheet.guests) {
      sheet.guests.forEach((guest) => {
        totalErrors += (guest.errors || []).length;
      });
    }
  });

  editablePreview.value.summary.errors_count = totalErrors;
}

function checkForChanges() {
  if (!originalPreview.value || !editablePreview.value) {
    hasChangesAfterValidation.value = false;
    return;
  }
  hasChangesAfterValidation.value = JSON.stringify(editablePreview.value) !== JSON.stringify(originalPreview.value);
}

watch(editablePreview, () => {
  checkForChanges();
}, { deep: true });

defineExpose({
  openHelp,
  openFilePicker,
});
</script>

<template>
  <BookingDailyUploadHelpDialog
    :visible="showDailyUploadHelp"
    @close="showDailyUploadHelp = false"
  />

  <BookingDailyUploadPreviewDialog
    v-if="showDailyUploadPreview && editablePreview"
    :preview="editablePreview"
    :has-changes-after-validation="hasChangesAfterValidation"
    :daily-total-errors="dailyTotalErrors"
    @close="showDailyUploadPreview = false"
    @validate="validateDailyData"
    @confirm="confirmDailyUpload"
  />
</template>
