<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import type { BackendError } from "@/utils/normalize-preview";

import { asApiError, extractErrorMessage, isRecord } from "@/types/errors";
import { formatDateInput, formatPhoneInput } from "@/utils/input-format";
import { normalizeGeneralErrors, normalizePreviewGuests, normalizeSheetErrors } from "@/utils/normalize-preview";

const route = useRoute();
const s = useScheduleStore();
const ib = useImmediateBookingStore();

type Guest = { name: string; date_of_birth: string; city: string; phone: string; email?: string };
type ExcelGuest = Guest & { errors?: string[] };

type GuestRow = {
  id?: string | number;
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

type FileUploadSelectEvent = { files?: File[]; originalEvent?: Event };

type ApiErrorData = {
  errors?: (string | { row: number })[];
  guests?: Array<Guest & { errors?: string[] }>;
  [key: string]: unknown;
};

function asApiErrorData(v: unknown): ApiErrorData | null {
  return isRecord(v) ? (v as ApiErrorData) : null;
}

const date = ref<string>((route.query.date as string) || "");
const time = ref<string>((route.query.time as string) || "");
const people = ref<number>(1);
const preciseTime = ref<string>("");
const isRadio = ref<boolean>(false);
const curatorName = ref<string>("");
const driverName = ref<string>("");
const excelPreview = ref(false);
const excelReady = ref(false);
const pending = ref(false);
const capacityLoading = ref(false);
const excelErrors = ref<BackendError[]>([]);
const excelGuests = ref<ExcelGuest[]>([]);
const excelFile = ref<File | null>(null);
const tableKey = ref(0);
const cellEdited = ref(false);
const sheetErrors = ref<Array<{ row: number; col: number; message: string }>>([]);

const generalErrors = computed(() => normalizeGeneralErrors(excelErrors.value));

const error = ref("");
const success = ref("");

const preciseTimeRange = computed(() => {
  if (!time.value)
    return { minTime: { hours: 8, minutes: 0 }, maxTime: { hours: 19, minutes: 59 } };
  const [h, m] = time.value.split(":").map(Number);
  const minTime = { hours: h, minutes: m };
  let maxH = h;
  let maxM = m + 29;
  if (maxM >= 60) {
    maxH += 1;
    maxM -= 60;
  }
  const maxTime = { hours: maxH, minutes: maxM };
  return { minTime, maxTime };
});

const maxGuests = computed(() => {
  if (!date.value || !time.value)
    return null;
  const remaining = s.remainingCapacity(date.value, time.value);
  if (Number.isNaN(remaining) || !Number.isFinite(remaining))
    return 0;
  return Math.max(0, Number(remaining));
});

const isOverCapacity = computed(() => maxGuests.value !== null && people.value > maxGuests.value);
const excelOverCapacity = computed(() => maxGuests.value !== null && excelGuests.value.length > maxGuests.value);
const showPreview = computed(() => excelPreview.value);

watch(time, (v) => {
  if (!v)
    return;
  if (preciseTime.value) {
    const [slotH, slotM] = v.split(":").map(Number);
    const [pH, pM] = preciseTime.value.split(":").map(Number);
    const slotMinutes = slotH * 60 + slotM;
    const preciseMinutes = pH * 60 + pM;
    if (preciseMinutes < slotMinutes || preciseMinutes > slotMinutes + 29)
      preciseTime.value = v;
  }
  else {
    preciseTime.value = v;
  }
});

onMounted(async () => {
  if (time.value && !preciseTime.value)
    preciseTime.value = time.value;
  if (!s.timeSlots.length)
    await s.fetchWeek();
  if (date.value && time.value)
    await ensureSlotCapacity(date.value, time.value);
});

watch([date, time], async ([currentDate, currentTime]) => {
  if (!currentDate || !currentTime)
    return;
  await ensureSlotCapacity(currentDate, currentTime);
});

watch(maxGuests, (max) => {
  if (max === null)
    return;
  if (max === 0 && people.value > 0)
    people.value = 0;
  if (max > 0 && people.value > max)
    people.value = max;
  if (excelPreview.value)
    recomputeExcelReady();
});

watch(people, (val) => {
  if (!Number.isFinite(val) || val < 0)
    people.value = 0;
  if (maxGuests.value !== null && val > maxGuests.value)
    people.value = maxGuests.value;
});

async function ensureSlotCapacity(currentDate: string, currentTime: string) {
  capacityLoading.value = true;
  try {
    await s.fetchSlotData(currentDate, currentTime);
  }
  catch {}
  finally {
    capacityLoading.value = false;
  }
}

function onExcelChange(e: FileUploadSelectEvent | Event | null | undefined) {
  const maybe = e as FileUploadSelectEvent | undefined;
  const inputEvent = e as Event | undefined;
  const targetFiles = (inputEvent?.target as HTMLInputElement | null)?.files;
  const file = maybe?.files?.[0] || targetFiles?.[0];
  excelFile.value = file ?? null;
  excelErrors.value = [];
  excelReady.value = false;

  if (excelFile.value)
    void previewExcel();
}

function validateDateStr(value: string): boolean {
  if (!value)
    return false;
  return /^\d{2}\.\d{2}\.\d{4}$/.test(value);
}

function validatePhoneStr(value: string): boolean {
  if (!value)
    return false;
  const digits = (value.match(/\d/g) || []).join("");
  return digits.length >= 10 && digits.length <= 15;
}

function validateGuestRow(guest: GuestRow): string[] {
  const issues: string[] = [];
  if (!guest.name?.trim())
    issues.push("Имя обязательно");
  if (!guest.date_of_birth?.trim())
    issues.push("Дата рождения обязательна");
  else if (!validateDateStr(guest.date_of_birth))
    issues.push(`Неверный формат даты '${guest.date_of_birth}'`);
  if (!guest.city?.trim())
    issues.push("Город обязателен");
  if (!guest.phone?.trim())
    issues.push("Номер телефона обязателен");
  else if (!validatePhoneStr(guest.phone))
    issues.push("Неверный телефон");
  return issues;
}

function closePreview() {
  excelPreview.value = false;
}

async function confirmExcelPreview() {
  if ((!excelReady.value && !cellEdited.value) || pending.value)
    return;

  await nextTick();
  (document.activeElement as HTMLElement | null)?.blur?.();
  await nextTick();

  closePreview();
  await submitExcelEdited();
}

function applyPreviewResponse(data: { guests?: unknown; errors?: unknown }) {
  const rawGuests = Array.isArray(data.guests) ? data.guests : [];
  excelGuests.value = normalizePreviewGuests(rawGuests) as ExcelGuest[];
  const rawErrors: BackendError[] = Array.isArray(data.errors) ? data.errors : [];
  excelErrors.value = rawErrors;
  sheetErrors.value = normalizeSheetErrors(rawErrors);
  excelPreview.value = true;
  if (excelGuests.value.length > 0)
    people.value = excelGuests.value.length;
  recomputeExcelReady();
}

async function previewExcel() {
  error.value = "";
  success.value = "";
  excelErrors.value = [];
  sheetErrors.value = [];
  excelReady.value = false;
  if (!excelFile.value) {
    error.value = "Выберите Excel файл";
    return;
  }
  try {
    const response = await ib.previewFromFile({
      date: date.value,
      time: time.value,
      precise_time: preciseTime.value || undefined,
      file: excelFile.value,
    });
    applyPreviewResponse(response);
  }
  catch (err: unknown) {
    const apiErr = asApiError(err);
    const data = asApiErrorData(apiErr?.data);
    if (data?.guests || data?.errors) {
      applyPreviewResponse(data);
    }
    else {
      error.value = extractErrorMessage(err, "Не удалось получить предпросмотр");
    }
  }
}

function onPreviewTableCellEditComplete(payload: { data: GuestRow; field?: string; newValue?: unknown }) {
  const row = payload?.data;
  const field = payload?.field;
  if (!row)
    return;

  if (field === "date_of_birth")
    row.date_of_birth = formatDateInput(String(row.date_of_birth || ""));
  if (field === "phone")
    row.phone = formatPhoneInput(String(row.phone || ""));

  row.errors = validateGuestRow(row);
  tableKey.value++;
  cellEdited.value = true;
  recomputeExcelReady();
}

function recomputeExcelReady() {
  const hasRowErrors = excelGuests.value.some(row => row.errors && row.errors.length > 0);
  const hasGeneralErrors = excelErrors.value.some(error =>
    typeof error === "string" || (error && !error.row),
  );
  const hasGuests = excelGuests.value.length > 0;
  const capacityOk = !(maxGuests.value !== null && excelGuests.value.length > maxGuests.value);
  excelReady.value = hasGuests && !hasRowErrors && !hasGeneralErrors && capacityOk;
}

async function submitExcelEdited() {
  error.value = "";
  success.value = "";
  cellEdited.value = false;
  const cleaned = excelGuests.value.map(guest => ({
    name: (guest.name || "").trim(),
    date_of_birth: (guest.date_of_birth || "").trim(),
    city: (guest.city || "").trim(),
    phone: (guest.phone || "").trim(),
    email: (guest.email || "").trim(),
  })).filter(guest => guest.name);
  if (!date.value || !time.value || cleaned.length < 1) {
    error.value = "Заполните поля и предварительный просмотр";
    return;
  }
  if (maxGuests.value !== null && maxGuests.value === 0) {
    error.value = "В выбранном слоте нет свободных мест";
    return;
  }
  if (excelOverCapacity.value) {
    error.value = `Доступно мест: ${maxGuests.value}`;
    return;
  }
  pending.value = true;
  try {
    const guestCount = Math.max(1, cleaned.length);
    const body = {
      date: date.value,
      time: time.value,
      people_count: guestCount,
      precise_time: preciseTime.value || time.value,
      is_radio: isRadio.value,
      curator_name: curatorName.value || undefined,
      driver_name: driverName.value || undefined,
      guests: cleaned,
    };
    const response = await ib.confirmExcel(body);
    const bookingId = response?.booking_id;
    if (response?.preview_mode) {
      applyPreviewResponse(response);
      tableKey.value++;
      return;
    }
    if (bookingId && response?.success) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    if (response?.success) {
      success.value = response?.message || "Создано";
    }
    else {
      const firstError = response?.errors?.[0];
      error.value = (typeof firstError === "string" ? firstError : firstError?.detail || firstError?.message) || "Не удалось создать";
    }
  }
  catch (err: unknown) {
    error.value = extractErrorMessage(err, "Не удалось создать");
  }
  finally {
    pending.value = false;
  }
}
</script>

<template>
  <div class="relative">
    <div
      v-if="pending"
      class="absolute inset-0 z-20 flex items-center justify-center bg-white/70"
    >
      <ProgressSpinner />
    </div>

    <div
      class="container mx-auto p-4 max-w-6xl transition-opacity"
      :class="{ 'pointer-events-none opacity-60': pending }"
    >
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-amber-700">
          Срочное бронирование
        </h1>
        <p class="text-sm text-amber-700/80 mt-1">
          Список гостей обязателен на момент создания
        </p>
      </div>

      <div class="space-y-2 mb-4">
        <Message
          v-if="success"
          severity="success"
        >
          {{ success }}
        </Message>
        <Message
          v-else-if="error"
          severity="error"
        >
          {{ error }}
        </Message>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Дата</label>
          <Datepicker
            v-model="date"
            locale="ru"
            model-type="yyyy-MM-dd"
            format="dd.MM.yyyy"
            :auto-apply="true"
            :teleport="true"
            :ui="{ input: 'p-inputtext w-full' }"
            :enable-time-picker="false"
            :close-on-auto-apply="true"
            :disabled="true"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Слот</label>
          <Datepicker
            v-model="time"
            locale="ru"
            time-picker
            is-24
            model-type="HH:mm"
            :minutes-increment="30"
            :minutes-grid-increment="30"
            :min-time="{ hours: 8, minutes: 0 }"
            :max-time="{ hours: 19, minutes: 30 }"
            :auto-apply="true"
            :teleport="true"
            :ui="{ input: 'p-inputtext w-full' }"
            :close-on-auto-apply="true"
            :disabled="true"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Точное время</label>
          <Datepicker
            v-model="preciseTime"
            locale="ru"
            time-picker
            is-24
            model-type="HH:mm"
            :minutes-increment="1"
            :min-time="preciseTimeRange.minTime"
            :max-time="preciseTimeRange.maxTime"
            :auto-apply="true"
            :teleport="true"
            :ui="{ input: 'p-inputtext w-full' }"
            :close-on-auto-apply="true"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Количество гостей</label>
          <InputNumber
            v-model="people"
            :min="0"
            :max="maxGuests ?? undefined"
            show-buttons
            class="w-full"
          />
          <p class="text-xs mt-1" :class="isOverCapacity ? 'text-red-600' : 'text-surface-500'">
            <span v-if="capacityLoading" class="inline-flex items-center gap-2">
              <ProgressSpinner style="width: 1rem; height: 1rem;" /> Проверка доступности…
            </span>
            <span v-else-if="maxGuests !== null">
              Свободно мест: {{ maxGuests }}
            </span>
            <span v-else>
              Выберите дату и слот, чтобы увидеть доступные места
            </span>
          </p>
          <Message
            v-if="!capacityLoading && maxGuests === 0"
            severity="error"
            class="mt-1 text-xs"
          >
            В выбранном слоте нет свободных мест
          </Message>
        </div>
      </div>

      <div class="mb-4">
        <div class="flex items-center gap-2">
          <Checkbox
            v-model="isRadio"
            input-id="is_radio"
            :disabled="pending"
            :binary="true"
          />
          <label for="is_radio" class="text-sm font-medium text-surface-700 cursor-pointer">
            Радиогиды
          </label>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Имя сопровождающего</label>
          <InputText
            v-model="curatorName"
            :disabled="pending"
            placeholder="Необязательно"
            class="w-full"
          />
        </div>
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-surface-700">Имя водителя</label>
          <InputText
            v-model="driverName"
            :disabled="pending"
            placeholder="Необязательно"
            class="w-full"
          />
        </div>
      </div>

      <div v-if="!showPreview" class="grid grid-cols-1 gap-6">
        <Card>
          <template #title>
            <h2 class="text-base font-semibold m-0">
              Импорт из файла
            </h2>
          </template>
          <template #content>
            <div class="space-y-3">
              <div>
                <label class="block text-sm mb-1">Файл</label>
                <FileUpload
                  mode="basic"
                  accept=".xlsx,.xls,.txt"
                  :max-file-size="8388608"
                  choose-label="Выбрать файл"
                  class="w-full"
                  @select="onExcelChange"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card
        v-if="showPreview"
        class="mt-8"
      >
        <template #title>
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 w-full">
            <div>
              <h2 class="text-xl font-semibold m-0">
                Предварительный список гостей
              </h2>
              <p class="text-sm text-surface-500 mt-1 mb-0">
                Проверьте данные перед подтверждением
              </p>
            </div>
            <div class="flex gap-2">
              <Button
                label="Закрыть"
                icon="pi pi-times"
                text
                severity="secondary"
                size="small"
                @click="closePreview"
              />
              <Button
                label="Подтвердить"
                icon="pi pi-check"
                size="small"
                :disabled="pending || (!excelReady && !cellEdited) || excelOverCapacity"
                @click="confirmExcelPreview"
              />
            </div>
          </div>
        </template>
        <template #content>
          <Message
            v-if="excelPreview && excelOverCapacity"
            severity="warn"
            class="mb-4"
          >
            Запрошенное количество гостей превышает доступные места ({{ maxGuests }}).
          </Message>
          <Message
            v-if="generalErrors.length > 0 && excelPreview"
            severity="error"
            class="mb-3"
          >
            <ul class="text-sm text-red-700 space-y-1 list-disc list-inside">
              <li
                v-for="(msg, i) in generalErrors"
                :key="i"
              >
                {{ msg }}
              </li>
            </ul>
          </Message>

          <div
            class="rounded-lg border"
            style="border-color: rgb(243 244 246);"
          >
            <div
              class="p-3 border-b"
              style="border-color: rgb(243 244 246);"
              :class="(excelErrors.length > 0 || sheetErrors.length > 0) && excelPreview ? 'bg-red-50' : 'bg-blue-50'"
            >
              <div
                class="text-sm"
                :class="(excelErrors.length > 0 || sheetErrors.length > 0) && excelPreview ? 'text-red-800' : 'text-blue-800'"
              >
                <strong>Предпросмотр:</strong> Вы можете редактировать данные перед подтверждением
                <div v-if="(excelErrors.length > 0 || sheetErrors.length > 0) && excelPreview" class="mt-2 font-semibold">
                  Пожалуйста, исправьте ошибки в данных
                </div>
              </div>
            </div>
            <div class="p-3">
              <BookingGuestPreviewTable
                :key="tableKey"
                :guests="excelGuests"
                :sheet-errors="sheetErrors"
                :show-age-column="true"
                @cell-edit-complete="onPreviewTableCellEditComplete"
              />
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
