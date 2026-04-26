<script setup lang="ts">
import type { DailyListSheet, DailyListsPreviewResponse } from "@/stores/daily-lists";
import type { BackendError } from "@/utils/normalize-preview";

import { isMobile } from "@/utils/guest-errors";
import { formatDateInput, formatPhoneInput } from "@/utils/input-format";
import { normalizeSheetErrors } from "@/utils/normalize-preview";

type DailyPreviewGuest = {
  name?: string;
  date_of_birth?: string;
  city?: string;
  phone?: string;
  email?: string;
  row?: number;
  age?: number;
  errors?: string[];
  [key: string]: unknown;
};

const props = defineProps<{
  preview: DailyListsPreviewResponse | null;
  hasChangesAfterValidation: boolean;
  dailyTotalErrors: number;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "validate"): void;
  (e: "confirm"): void;
}>();

const backdropMousedown = ref(false);
const activeDailySheetIndex = ref(0);

watch(() => props.preview, () => {
  activeDailySheetIndex.value = 0;
});

const activeDailySheet = computed(() =>
  props.preview?.sheets?.[activeDailySheetIndex.value] ?? null,
);

const activeDailySheetErrors = computed(() =>
  normalizeSheetErrors(
    Array.isArray(activeDailySheet.value?.sheet_errors)
      ? activeDailySheet.value!.sheet_errors as BackendError[]
      : [],
  ),
);

function dailySheetErrorCount(sheet: DailyListSheet | null): number {
  const guestErrors = (sheet?.guests ?? []).reduce(
    (acc: number, g) => acc + (Array.isArray(g.errors) ? g.errors.length : 0),
    0,
  );
  const sheetErrors = Array.isArray(sheet?.sheet_errors) ? sheet.sheet_errors.length : 0;
  return guestErrors + sheetErrors;
}

function dailySheetLabel(sheet: DailyListSheet, idx: number): string {
  const name = (sheet?.sheet_name as string | undefined) || `Лист ${idx + 1}`;
  return `${name} (${dailySheetErrorCount(sheet)})`;
}

function dailySheetSeverity(sheet: DailyListSheet): string {
  return dailySheetErrorCount(sheet) > 0 ? "danger" : "success";
}

function onDailyGuestCellEditComplete(event: { data?: DailyPreviewGuest; field?: string; newValue?: unknown }) {
  const guest = event?.data;
  const field = event?.field as string | undefined;
  if (!guest || !field)
    return;

  guest[field] = event?.newValue;

  if (field === "date_of_birth")
    guest.date_of_birth = formatDateInput(String(guest.date_of_birth || ""));
  if (field === "phone")
    guest.phone = formatPhoneInput(String(guest.phone || ""));
}

function sheetErrorKey(error: unknown): string {
  const e = error as { row?: unknown; column?: unknown; col?: unknown; message?: unknown };
  const row = typeof e.row === "number" || typeof e.row === "string" ? String(e.row) : "";
  const col = typeof e.column === "string" || typeof e.column === "number"
    ? String(e.column)
    : (typeof e.col === "number" || typeof e.col === "string" ? String(e.col) : "");
  const msg = typeof e.message === "string" ? e.message : "";
  return `${row}|${col}|${msg}`;
}

function sheetErrorRow(error: unknown): string {
  const e = error as { row?: unknown };
  return typeof e.row === "number" || typeof e.row === "string" ? String(e.row) : "";
}

function sheetErrorColumn(error: unknown): string {
  const e = error as { column?: unknown; col?: unknown };
  if (typeof e.column === "string" || typeof e.column === "number")
    return String(e.column);
  if (typeof e.col === "number" || typeof e.col === "string")
    return String(e.col);
  return "";
}

function sheetErrorMessage(error: unknown): string {
  const e = error as { message?: unknown };
  return typeof e.message === "string" ? e.message : "";
}
</script>

<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[600] p-4"
    @mousedown="backdropMousedown = ($event.target === $event.currentTarget)"
    @click.self="backdropMousedown && emit('close')"
  >
    <Card
      class="w-full max-w-7xl overflow-hidden relative max-h-[95vh] flex flex-col"
      :class="{ 'max-h-[100vh]': isMobile() }"
      @click.stop
    >
      <template #header>
        <div class="flex items-center justify-between p-4 pb-2">
          <h3 class="text-lg font-semibold m-0">
            Предпросмотр: Единый список на день
          </h3>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="emit('close')"
          />
        </div>
      </template>
      <template #content>
        <div v-if="preview" class="flex flex-col min-h-0 p-4">
          <div class="space-y-4 overflow-y-auto max-h-[60vh] sm:max-h-[70vh]">
            <Card>
              <template #title>
                <div class="text-base font-semibold text-surface-900">
                  Сводка
                </div>
              </template>
              <template #content>
                <div class="rounded-lg border border-slate-200/60 bg-slate-50/40 p-3">
                  <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div class="rounded-md border border-slate-200/60 bg-white/60 px-2 py-1.5">
                      <div class="text-sm text-surface-600 leading-5">
                        Листов
                      </div>
                      <div class="text-lg font-semibold text-surface-900 leading-6">
                        {{ preview.summary?.total_sheets || 0 }}
                      </div>
                    </div>
                    <div class="rounded-md border border-slate-200/60 bg-white/60 px-2 py-1.5">
                      <div class="text-sm text-surface-600 leading-5">
                        Гостей
                      </div>
                      <div class="text-lg font-semibold text-surface-900 leading-6">
                        {{ preview.summary?.total_guests || 0 }}
                      </div>
                    </div>
                    <div class="rounded-md border border-slate-200/60 bg-white/60 px-2 py-1.5">
                      <div class="text-sm text-surface-600 leading-5">
                        Новых бронирований
                      </div>
                      <div class="text-lg font-semibold text-green-700 leading-6">
                        {{ preview.summary?.new_bookings || 0 }}
                      </div>
                    </div>
                    <div class="rounded-md border border-slate-200/60 bg-white/60 px-2 py-1.5">
                      <div class="text-sm text-surface-600 leading-5">
                        Обновится
                      </div>
                      <div class="text-lg font-semibold text-blue-700 leading-6">
                        {{ preview.summary?.updated_bookings || 0 }}
                      </div>
                    </div>
                  </div>

                  <div class="mt-3">
                    <span
                      class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                      :class="dailyTotalErrors > 0 ? 'border-red-200 bg-red-50/60 text-red-700' : 'border-green-200 bg-green-50/60 text-green-700'"
                    >
                      Ошибок: {{ dailyTotalErrors }}
                    </span>
                  </div>
                </div>
              </template>
            </Card>

            <div
              v-if="preview?.sheets?.length"
              class="flex gap-2 flex-wrap justify-start border-t border-slate-200/60 pt-3"
            >
              <Button
                v-for="(sheet, idx) in preview.sheets"
                :key="sheet.sheet_name || idx"
                :label="dailySheetLabel(sheet, Number(idx))"
                size="small"
                :outlined="idx !== activeDailySheetIndex"
                :severity="dailySheetSeverity(sheet)"
                @click="activeDailySheetIndex = Number(idx)"
              />
            </div>

            <Card v-if="activeDailySheet">
              <template #title>
                <div class="text-base font-semibold text-surface-900">
                  Лист: {{ activeDailySheet.sheet_name }}
                </div>
              </template>
              <template #content>
                <div class="mb-4">
                  <div class="text-sm font-medium text-surface-900 mb-2">
                    Информация о бронировании
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Дата:</label>
                      <InputText
                        v-model="activeDailySheet.booking_info.date"
                        class="w-full"
                        placeholder="ДД.ММ.ГГГГ"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Время таймслота:</label>
                      <InputText
                        v-model="activeDailySheet.booking_info.timeslot_time"
                        class="w-full"
                        placeholder="ЧЧ:ММ"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Точное время:</label>
                      <InputText
                        v-model="activeDailySheet.booking_info.precise_time"
                        class="w-full"
                        placeholder="ЧЧ:ММ"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Радиогиды:</label>
                      <Dropdown
                        v-model="activeDailySheet.booking_info.is_radio"
                        :options="[{ label: 'Да', value: true }, { label: 'Нет', value: false }]"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Сборная:</label>
                      <Dropdown
                        v-model="activeDailySheet.booking_info.is_joint"
                        :options="[{ label: 'Да', value: true }, { label: 'Нет', value: false }]"
                        option-label="label"
                        option-value="value"
                        class="w-full"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">Имя водителя:</label>
                      <InputText
                        v-model="activeDailySheet.booking_info.driver_name"
                        class="w-full"
                      />
                    </div>
                    <div class="lg:col-span-3">
                      <label class="block text-xs font-medium text-gray-700 mb-1">Имя сопровождающего:</label>
                      <InputText
                        v-model="activeDailySheet.booking_info.curator_name"
                        class="w-full"
                      />
                    </div>
                  </div>
                </div>

                <div v-if="activeDailySheet.guests && activeDailySheet.guests.length > 0" class="mb-3">
                  <div class="text-sm font-medium text-surface-900 mb-2">
                    Гости ({{ activeDailySheet.guests.length }})
                  </div>
                  <BookingGuestPreviewTable
                    :guests="activeDailySheet.guests"
                    :sheet-errors="activeDailySheetErrors"
                    :show-row-column="true"
                    :show-age-column="true"
                    @cell-edit-complete="onDailyGuestCellEditComplete"
                  />
                </div>

                <div v-if="activeDailySheet.sheet_errors && activeDailySheet.sheet_errors.length > 0" class="bg-red-50 border border-red-200 rounded p-3">
                  <h5 class="font-medium text-red-800 mb-2">
                    Ошибки в листе:
                  </h5>
                  <div class="text-sm text-red-700">
                    <div
                      v-for="error in activeDailySheet.sheet_errors"
                      :key="sheetErrorKey(error)"
                      class="mb-1"
                    >
                      Строка {{ sheetErrorRow(error) }}, колонка "{{ sheetErrorColumn(error) }}": {{ sheetErrorMessage(error) }}
                    </div>
                  </div>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </template>

      <template #footer>
        <div class="flex flex-col gap-3 pt-3 mb-3">
          <div class="text-sm text-gray-600 flex items-center">
            <span v-if="dailyTotalErrors > 0" class="text-red-600 font-medium">
              ⚠️ Есть ошибки ({{ dailyTotalErrors }}). Исправьте их перед подтверждением.
            </span>
            <span v-else-if="hasChangesAfterValidation" class="text-amber-600 font-medium">
              ⚠️ Есть несохраненные изменения. Проведите валидацию перед подтверждением.
            </span>
            <span v-else class="text-green-600 font-medium">
              ✅ Готово к подтверждению
            </span>
          </div>
          <div class="flex flex-col sm:flex-row gap-2 sm:justify-end">
            <Button
              label="Отмена"
              icon="pi pi-times"
              severity="secondary"
              class="w-full sm:w-auto"
              @click="emit('close')"
            />
            <Button
              label="Валидировать"
              icon="pi pi-refresh"
              severity="info"
              class="w-full sm:w-auto"
              @click="emit('validate')"
            />
            <Button
              label="Подтвердить"
              icon="pi pi-check"
              severity="success"
              :disabled="dailyTotalErrors > 0 || hasChangesAfterValidation"
              class="w-full sm:w-auto"
              @click="emit('confirm')"
            />
          </div>
        </div>
      </template>
    </Card>
  </div>
</template>

<style scoped>
.gl-cell {
  display: inline-block;
  min-height: 1.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.gl-cell--error {
  background: rgba(220, 38, 38, 0.08);
  outline: 1px solid rgba(220, 38, 38, 0.35);
}
</style>
