<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { formatDateInput, formatPhoneInput } from "@/utils/input-format";

const route = useRoute();
const s = useScheduleStore();

type Guest = { name: string; date_of_birth: string; city: string; phone: string; errors?: string[] };

const date = ref<string>((route.query.date as string) || "");
const time = ref<string>((route.query.time as string) || "");
const people = ref<number>(1);
const preciseTime = ref<string>("");
const activeTab = ref<"manual" | "excel">("manual");

const manualPreview = ref(false);
const excelPreview = ref(false);
const manualReady = ref(false);
const excelReady = ref(false);
const pending = ref(false);
const capacityLoading = ref(false);
const excelErrors = ref<string[]>([]);

const manualGuests = ref<Guest[]>([]);
const excelGuests = ref<Guest[]>([]);
const excelFile = ref<File | null>(null);

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
const showPreview = computed(() => manualPreview.value || excelPreview.value);

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
  if (manualGuests.value.length > people.value)
    manualGuests.value.splice(people.value);
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

function onExcelChange(e: any) {
  const file = e?.files?.[0] || e?.target?.files?.[0];
  excelFile.value = file;
  excelErrors.value = [];
  excelReady.value = false;
}

function addGuest() {
  if (manualGuests.value.length >= people.value)
    return;
  if (maxGuests.value !== null && manualGuests.value.length >= maxGuests.value)
    return;
  manualGuests.value.push({ name: "", date_of_birth: "", city: "", phone: "+7" });
}

function removeGuest(index: number) {
  manualGuests.value.splice(index, 1);
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

function validateGuestRow(guest: Guest): string[] {
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

function validateManualForPreview() {
  error.value = "";
  success.value = "";
  for (const guest of manualGuests.value) {
    guest.errors = validateGuestRow(guest);
  }
  excelErrors.value = [];
  recomputeManualReady();
  if (!date.value || !time.value || people.value < 1) {
    error.value = "Заполните дату, слот и количество гостей";
  }
  else if (maxGuests.value !== null && maxGuests.value === 0) {
    error.value = "В выбранном слоте нет свободных мест";
  }
  else if (isOverCapacity.value) {
    error.value = `Доступно мест: ${maxGuests.value}`;
  }
  else if (manualGuests.value.length !== people.value) {
    error.value = `Гостей: ${manualGuests.value.length} / ${people.value}`;
  }
}

function openManualPreview() {
  manualPreview.value = false;
  excelPreview.value = false;
  for (const guest of manualGuests.value) {
    guest.errors = validateGuestRow(guest);
  }
  validateManualForPreview();
  if (!manualReady.value)
    return;
  manualPreview.value = true;
}

function closePreview() {
  manualPreview.value = false;
  excelPreview.value = false;
}

async function confirmManualPreview() {
  if (!manualReady.value || pending.value)
    return;
  closePreview();
  await submitManual();
}

async function confirmExcelPreview() {
  if (!excelReady.value || pending.value)
    return;
  closePreview();
  await submitExcelEdited();
}

async function submitManual() {
  error.value = "";
  success.value = "";
  if (!date.value || !time.value || people.value < 1) {
    error.value = "Заполните дату, слот и количество гостей";
    return;
  }
  if (maxGuests.value !== null && maxGuests.value === 0) {
    error.value = "В выбранном слоте нет свободных мест";
    return;
  }
  if (isOverCapacity.value) {
    error.value = `Доступно мест: ${maxGuests.value}`;
    return;
  }
  if (manualGuests.value.length !== people.value) {
    error.value = `Гостей: ${manualGuests.value.length} / ${people.value}`;
    return;
  }
  if (manualGuests.value.some(guest => validateGuestRow(guest).length > 0)) {
    error.value = "Исправьте ошибки в данных гостей";
    return;
  }
  pending.value = true;
  try {
    const body = {
      date: date.value,
      time: time.value,
      people_count: people.value,
      precise_time: preciseTime.value || time.value,
      guests: manualGuests.value,
    };
    const response = await useApi("/guest-lists/immediate/manual", { method: "POST", body });
    const bookingId = (response as any)?.booking?.id;
    if (bookingId) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    success.value = (response as any)?.detail || "Создано";
  }
  catch (err: any) {
    error.value = err?.data?.detail || err?.message || "Не удалось создать";
  }
  finally {
    pending.value = false;
  }
}

async function previewExcel() {
  error.value = "";
  success.value = "";
  excelErrors.value = [];
  excelReady.value = false;
  if (!excelFile.value) {
    error.value = "Выберите Excel файл";
    return;
  }
  try {
    const form = new FormData();
    form.append("date", date.value);
    form.append("time", time.value);
    if (preciseTime.value)
      form.append("precise_time", preciseTime.value);
    form.append("file", excelFile.value);
    const response = await useApi("/guest-lists/immediate/preview", { method: "POST", body: form, headers: {} }) as any;
    const rows = Array.isArray(response?.guests) ? response.guests as Guest[] : [];
    excelGuests.value = rows.map((guest) => {
      const formattedGuest = {
        ...guest,
        date_of_birth: formatDateInput(guest.date_of_birth || ""),
        phone: formatPhoneInput(guest.phone || ""),
      };

      return {
        ...formattedGuest,
        errors: Array.isArray((guest as any)?.errors)
          ? (guest as any).errors as string[]
          : validateGuestRow(formattedGuest),
      };
    });
    excelErrors.value = Array.isArray(response?.errors) ? response.errors : [];
    excelPreview.value = true;
    manualPreview.value = false;
    if (excelGuests.value.length > 0)
      people.value = excelGuests.value.length;
    recomputeExcelReady();
  }
  catch (err: any) {
    error.value = err?.data?.detail || err?.message || "Не удалось получить предпросмотр";
  }
}

function updateExcelRow(row: Guest) {
  row.date_of_birth = formatDateInput(row.date_of_birth || "");
  row.phone = formatPhoneInput(row.phone || "");
  row.errors = validateGuestRow(row);
  excelErrors.value = [];
  recomputeExcelReady();
}

function updateManualRow(row: Guest) {
  row.date_of_birth = formatDateInput(row.date_of_birth || "");
  row.phone = formatPhoneInput(row.phone || "");
  row.errors = validateGuestRow(row);
  excelErrors.value = [];
  recomputeManualReady();
}

function recomputeExcelReady() {
  const hasRowErrors = excelGuests.value.some(row => row.errors && row.errors.length > 0);
  const hasGeneralErrors = excelErrors.value.length > 0;
  const hasGuests = excelGuests.value.length > 0;
  const capacityOk = !(maxGuests.value !== null && excelGuests.value.length > maxGuests.value);
  excelReady.value = hasGuests && !hasRowErrors && !hasGeneralErrors && capacityOk;
}

function recomputeManualReady() {
  if (!date.value || !time.value || people.value < 1) {
    manualReady.value = false;
    return;
  }
  if (maxGuests.value !== null && maxGuests.value === 0) {
    manualReady.value = false;
    return;
  }
  if (isOverCapacity.value) {
    manualReady.value = false;
    return;
  }
  if (manualGuests.value.length !== people.value) {
    manualReady.value = false;
    return;
  }
  const hasRowErrors = manualGuests.value.some(row => row.errors && row.errors.length > 0);
  manualReady.value = !hasRowErrors;
}

async function submitExcelEdited() {
  error.value = "";
  success.value = "";
  const cleaned = excelGuests.value.map(guest => ({
    name: (guest.name || "").trim(),
    date_of_birth: (guest.date_of_birth || "").trim(),
    city: (guest.city || "").trim(),
    phone: (guest.phone || "").trim(),
  }));
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
    const body = {
      date: date.value,
      time: time.value,
      people_count: cleaned.length,
      precise_time: preciseTime.value || time.value,
      guests: cleaned,
    };
    const response = await useApi("/guest-lists/immediate/excel", { method: "POST", body });
    const bookingId = (response as any)?.booking?.id;
    if (bookingId) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    success.value = (response as any)?.detail || "Создано";
  }
  catch (err: any) {
    if (err?.response?.status === 400 && err?.data) {
      const responseData = err.data;
      if (Array.isArray(responseData.errors) && responseData.errors.length > 0) {
        excelErrors.value = responseData.errors;
        error.value = responseData.errors.join(", ");
      }
      else {
        error.value = responseData.detail || responseData.message || "Не удалось создать";
      }
      if (Array.isArray(responseData.guests)) {
        excelGuests.value = responseData.guests.map((guest: any) => {
          const formattedGuest = {
            ...guest,
            date_of_birth: formatDateInput(guest.date_of_birth || ""),
            phone: formatPhoneInput(guest.phone || ""),
          };
          return {
            ...formattedGuest,
            errors: Array.isArray(guest?.errors) ? guest.errors : validateGuestRow(formattedGuest),
          };
        });
        excelPreview.value = true;
        manualPreview.value = false;
        recomputeExcelReady();
      }
    }
    else {
      error.value = err?.data?.detail || err?.message || "Не удалось создать";
    }
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
      class="container mx-auto p-4 max-w-3xl transition-opacity"
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

      <div
        v-if="!showPreview"
        class="w-full mb-4"
      >
        <div class="flex gap-2 bg-surface-100 p-1 rounded-lg">
          <Button
            label="Ручной ввод"
            :outlined="activeTab !== 'manual'"
            size="small"
            class="flex-1"
            @click="activeTab = 'manual'"
          />
          <Button
            label="Excel"
            :outlined="activeTab !== 'excel'"
            size="small"
            class="flex-1"
            @click="activeTab = 'excel'"
          />
        </div>
      </div>

      <div
        v-if="!showPreview && activeTab === 'manual'"
        class="grid md:grid-cols-2 gap-6"
      >
        <Card>
          <template #title>
            <h2 class="text-base font-semibold m-0">
              Ручной ввод
            </h2>
          </template>
          <template #content>
            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <div class="text-sm text-surface-600">
                  Гостей: {{ manualGuests.length }} / {{ people }}
                </div>
                <Button
                  label="Добавить гостя"
                  icon="pi pi-plus"
                  size="small"
                  :disabled="manualGuests.length >= people || (maxGuests !== null && manualGuests.length >= maxGuests)"
                  @click="addGuest"
                />
              </div>
              <div class="space-y-2 max-h-56 overflow-auto pr-1">
                <div
                  v-for="(guest, index) in manualGuests"
                  :key="index"
                  class="grid grid-cols-1 gap-2"
                >
                  <InputText
                    v-model="guest.name"
                    placeholder="Имя"
                    size="small"
                  />
                  <InputText
                    v-model="guest.date_of_birth"
                    placeholder="ДД.ММ.ГГГГ"
                    size="small"
                    @input="guest.date_of_birth = formatDateInput(guest.date_of_birth)"
                  />
                  <InputText
                    v-model="guest.city"
                    placeholder="Город"
                    size="small"
                  />
                  <InputText
                    v-model="guest.phone"
                    placeholder="Телефон"
                    size="small"
                    @input="guest.phone = formatPhoneInput(guest.phone)"
                  />
                  <Message
                    v-if="validateGuestRow(guest).length"
                    severity="error"
                    class="text-xs"
                  >
                    <span v-for="(issue, idx) in validateGuestRow(guest)" :key="idx">• {{ issue }} </span>
                  </Message>
                  <div class="flex justify-end">
                    <Button
                      label="Удалить"
                      icon="pi pi-trash"
                      severity="danger"
                      size="small"
                      @click="removeGuest(index)"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center justify-between">
              <div class="text-xs text-surface-500">
                Проверьте данные перед созданием
              </div>
              <div class="flex gap-2">
                <Button
                  label="Предпросмотр"
                  icon="pi pi-eye"
                  @click="openManualPreview"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>

      <div v-if="!showPreview && activeTab === 'excel'" class="grid grid-cols-1 gap-6">
        <Card>
          <template #title>
            <h2 class="text-base font-semibold m-0">
              Импорт из Excel
            </h2>
          </template>
          <template #content>
            <div class="space-y-3">
              <div>
                <label class="block text-sm mb-1">Файл Excel</label>
                <FileUpload
                  mode="basic"
                  accept=".xlsx,.xls"
                  :max-file-size="8388608"
                  choose-label="Выбрать файл"
                  class="w-full"
                  @select="onExcelChange"
                />
              </div>
              <div class="flex gap-2">
                <Button
                  label="Предпросмотр"
                  icon="pi pi-eye"
                  @click="previewExcel"
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
                v-if="manualPreview"
                label="Подтвердить"
                icon="pi pi-check"
                size="small"
                :disabled="pending || !manualReady"
                @click="confirmManualPreview"
              />
              <Button
                v-else
                label="Подтвердить"
                icon="pi pi-check"
                size="small"
                :disabled="pending || !excelReady || excelOverCapacity"
                @click="confirmExcelPreview"
              />
            </div>
          </div>
        </template>
        <template #content>
          <div class="grid md:grid-cols-2 gap-4 text-sm text-surface-600 mb-4">
            <div><span class="font-semibold text-surface-900">Дата:</span> {{ date || '—' }}</div>
            <div><span class="font-semibold text-surface-900">Слот:</span> {{ time || '—' }}</div>
            <div><span class="font-semibold text-surface-900">Точное время:</span> {{ preciseTime || time || '—' }}</div>
            <div>
              <span class="font-semibold text-surface-900">Гостей:</span>
              <template v-if="manualPreview">
                {{ manualGuests.length }} / {{ people }}
              </template>
              <template v-else>
                {{ excelGuests.length }}
                <span v-if="maxGuests !== null"> из {{ maxGuests }}</span>
              </template>
            </div>
          </div>

          <Message
            v-if="showPreview && excelErrors.length"
            severity="error"
            class="mb-4"
          >
            <div class="font-semibold mb-2">
              Общие ошибки:
            </div>
            <ul class="list-disc list-inside space-y-1 m-0">
              <li v-for="issue in excelErrors" :key="issue">
                {{ issue }}
              </li>
            </ul>
          </Message>

          <Message
            v-if="excelPreview && excelOverCapacity"
            severity="warn"
            class="mb-4"
          >
            Запрошенное количество гостей превышает доступные места ({{ maxGuests }}).
          </Message>

          <div
            class="rounded-lg overflow-hidden flex flex-col"
            style="max-height: 24rem; border: 1px solid rgb(243 244 246);"
          >
            <div class="p-3 bg-blue-50 border-b flex-shrink-0" style="border-color: rgb(243 244 246);">
              <div class="text-sm text-blue-800">
                <strong>Предпросмотр:</strong> Вы можете редактировать данные перед подтверждением
              </div>
            </div>
            <div class="overflow-y-auto flex-1">
              <div class="space-y-2 p-3">
                <div
                  v-for="(guest, index) in (manualPreview ? manualGuests : excelGuests)"
                  :key="index"
                  class="border rounded p-3"
                  :class="guest.errors && guest.errors.length ? 'border-red-300 bg-red-50' : ''"
                  style="border-color: rgb(243 244 246);"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-sm">Гость #{{ index + 1 }}</span>
                    <div
                      v-if="guest.errors && guest.errors.length"
                      class="text-red-600 text-xs"
                    >
                      {{ guest.errors.length }} ошибок
                    </div>
                  </div>
                  <div
                    v-if="guest.errors && guest.errors.length"
                    class="mb-2 text-red-600 text-xs space-y-1"
                  >
                    <div
                      v-for="issue in guest.errors"
                      :key="issue"
                      class="flex items-start"
                    >
                      <span class="mr-1">•</span>
                      <span>{{ issue }}</span>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div>
                      <label class="block text-xs text-surface-600 mb-1">Имя</label>
                      <InputText
                        v-model="guest.name"
                        size="small"
                        placeholder="Имя"
                        class="w-full"
                        @input="manualPreview ? updateManualRow(guest) : updateExcelRow(guest)"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-surface-600 mb-1">ДД.ММ.ГГГГ</label>
                      <InputText
                        v-model="guest.date_of_birth"
                        size="small"
                        placeholder="ДД.ММ.ГГГГ"
                        class="w-full"
                        @input="manualPreview ? updateManualRow(guest) : updateExcelRow(guest)"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-surface-600 mb-1">Город</label>
                      <InputText
                        v-model="guest.city"
                        size="small"
                        placeholder="Город"
                        class="w-full"
                        @input="manualPreview ? updateManualRow(guest) : updateExcelRow(guest)"
                      />
                    </div>
                    <div>
                      <label class="block text-xs text-surface-600 mb-1">Телефон</label>
                      <InputText
                        v-model="guest.phone"
                        size="small"
                        placeholder="Телефон"
                        class="w-full"
                        @input="manualPreview ? updateManualRow(guest) : updateExcelRow(guest)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
