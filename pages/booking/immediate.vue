<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

const route = useRoute();
const s = useScheduleStore();

const date = ref<string>((route.query.date as string) || "");
const time = ref<string>((route.query.time as string) || "");
const people = ref<number>(1);
const preciseTime = ref<string>("");
const activeTab = ref<"manual" | "excel">("manual");

const manualPreview = ref(false);
const excelPreview = ref(false);
const manualReady = ref(false);
const excelReady = ref(false);

const preciseTimeRange = computed(() => {
  if (!time.value)
    return { minTime: { hours: 9, minutes: 0 }, maxTime: { hours: 19, minutes: 59 } };
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

watch(time, (v) => {
  if (!v)
    return;
  if (preciseTime.value) {
    const [slotH, slotM] = v.split(":").map(Number);
    const [pH, pM] = preciseTime.value.split(":").map(Number);
    const slotMin = slotH * 60 + slotM;
    const pMin = pH * 60 + pM;
    if (pMin < slotMin || pMin > slotMin + 29)
      preciseTime.value = v;
  }
  else {
    preciseTime.value = v;
  }
});

type Guest = { name: string; date_of_birth: string; city: string; phone: string };
type ExcelGuest = Guest & { errors?: string[] };
const guests = ref<Guest[]>([]);
const excelGuests = ref<ExcelGuest[]>([]);

const uploading = ref(false);
const excelFile = ref<File | null>(null);

function onExcelChange(e: Event) {
  const input = e.target as HTMLInputElement | null;
  const f = input && input.files && input.files[0] ? input.files[0] : null;
  excelFile.value = f;
  excelReady.value = false;
}

const error = ref("");
const success = ref("");

function addGuest() {
  guests.value.push({ name: "", date_of_birth: "", city: "", phone: "" });
}
function removeGuest(i: number) {
  guests.value.splice(i, 1);
}

function validateDateStr(v: string): boolean {
  if (!v)
    return false;
  return /^\d{2}\.\d{2}\.\d{4}$/.test(v);
}

function validateGuestRow(g: Guest): string[] {
  const errs: string[] = [];
  if (!g.name?.trim())
    errs.push("Имя обязательно");
  if (!g.date_of_birth?.trim())
    errs.push("Дата рождения обязательна");
  else if (!validateDateStr(g.date_of_birth))
    errs.push(`Неверный формат даты '${g.date_of_birth}'`);
  if (!g.city?.trim())
    errs.push("Город обязателен");
  if (!g.phone?.trim())
    errs.push("Номер телефона обязателен");
  else if (!validatePhoneStr(g.phone))
    errs.push("Неверный телефон");
  return errs;
}

function validatePhoneStr(v: string): boolean {
  if (!v)
    return false;
  const digits = (v.match(/\d/g) || []).join("");
  return digits.length >= 10 && digits.length <= 15;
}

async function submitManual() {
  error.value = "";
  success.value = "";
  if (!date.value || !time.value || people.value < 1) {
    error.value = "Заполните дату, слот и количество гостей";
    return;
  }
  if (guests.value.length !== people.value) {
    error.value = `Гостей: ${guests.value.length} / ${people.value}`;
    return;
  }
  if (guests.value.some(g => validateGuestRow(g).length > 0)) {
    error.value = "Исправьте ошибки в данных гостей";
    return;
  }
  try {
    const body = {
      date: date.value,
      time: time.value,
      people_count: people.value,
      precise_time: preciseTime.value || time.value,
      guests: guests.value,
    };
    const res = await useApi("/guest-lists/immediate/manual", { method: "POST", body });
    const bookingId = (res as any)?.booking?.id;
    if (bookingId) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    success.value = (res as any)?.detail || "Создано";
  }
  catch (e: any) {
    error.value = e?.data?.detail || e?.message || "Не удалось создать";
  }
}

function validateManualForPreview() {
  error.value = "";
  success.value = "";
  if (!date.value || !time.value || people.value < 1) {
    error.value = "Заполните дату, слот и количество гостей";
    manualReady.value = false;
    return;
  }
  if (guests.value.length !== people.value) {
    error.value = `Гостей: ${guests.value.length} / ${people.value}`;
    manualReady.value = false;
    return;
  }
  const bad = guests.value.some(g => validateGuestRow(g).length > 0);
  manualReady.value = !bad;
}

function openManualPreview() {
  validateManualForPreview();
  if (!manualReady.value)
    return;
  manualPreview.value = true;
}

async function _submitExcel() {
  error.value = "";
  success.value = "";
  if (!excelFile.value) {
    error.value = "Выберите Excel файл";
    return;
  }
  uploading.value = true;
  try {
    const form = new FormData();
    form.append("date", date.value);
    form.append("time", time.value);
    if (preciseTime.value)
      form.append("precise_time", preciseTime.value);
    form.append("file", excelFile.value as Blob);
    const res = await useApi("/guest-lists/immediate/excel-upload", { method: "POST", body: form, headers: {} });
    const bookingId = (res as any)?.booking?.id;
    if (bookingId) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    success.value = (res as any)?.detail || "Создано";
  }
  finally {
    uploading.value = false;
  }
}

async function previewExcel() {
  error.value = "";
  success.value = "";
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
    form.append("file", excelFile.value as Blob);
    const res = await useApi("/guest-lists/immediate/preview", { method: "POST", body: form, headers: {} }) as any;
    excelGuests.value = Array.isArray(res?.guests) ? res.guests as Guest[] : [];
    excelPreview.value = true;
    const errs = Array.isArray(res?.errors) ? res.errors : [];
    excelReady.value = errs.length === 0 && excelGuests.value.length > 0;
    if (excelReady.value)
      people.value = excelGuests.value.length;
  }
  catch (e: any) {
    error.value = e?.data?.detail || e?.message || "Не удалось получить предпросмотр";
  }
}

async function submitExcelEdited() {
  error.value = "";
  success.value = "";
  const cleaned = (excelGuests.value || []).map(g => ({
    name: (g.name || "").trim(),
    date_of_birth: (g.date_of_birth || "").trim(),
    city: (g.city || "").trim(),
    phone: (g.phone || "").trim(),
  }));
  if (!date.value || !time.value || cleaned.length < 1) {
    error.value = "Заполните поля и предварительный просмотр";
    return;
  }
  try {
    const body = {
      date: date.value,
      time: time.value,
      people_count: cleaned.length,
      precise_time: preciseTime.value || time.value,
      guests: cleaned,
    };
    const res = await useApi("/guest-lists/immediate/excel", { method: "POST", body });
    const bookingId = (res as any)?.booking?.id;
    if (bookingId) {
      await s.fetchWeek();
      await navigateTo(`/booking/${bookingId}/edit`);
      return;
    }
    success.value = (res as any)?.detail || "Создано";
  }
  catch (e: any) {
    error.value = e?.data?.detail || e?.message || "Не удалось создать";
  }
}
</script>

<template>
  <div class="container mx-auto p-4 max-w-3xl">
    <div class="mb-6">
      <h1 class="text-2xl md:text-3xl font-bold text-amber-700">
        Срочное бронирование
      </h1>
      <p class="text-sm text-amber-700/80 mt-1">
        Список гостей обязателен на момент создания
      </p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div>
        <label class="block text-sm mb-1">Дата</label>
        <Datepicker
          v-model="date"
          locale="ru"
          model-type="yyyy-MM-dd"
          :auto-apply="true"
          :teleport="true"
          :ui="{ input: 'input' }"
          :enable-time-picker="false"
          :close-on-auto-apply="true"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">Слот</label>
        <Datepicker
          v-model="time"
          locale="ru"
          time-picker
          is-24
          model-type="HH:mm"
          :minutes-increment="30"
          :minutes-grid-increment="30"
          :min-time="{ hours: 9, minutes: 0 }"
          :max-time="{ hours: 19, minutes: 30 }"
          :auto-apply="true"
          :teleport="true"
          :ui="{ input: 'input' }"
          :close-on-auto-apply="true"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">Точное время</label>
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
          :ui="{ input: 'input' }"
          :close-on-auto-apply="true"
        />
      </div>
      <div>
        <label class="block text-sm mb-1">Количество гостей</label>
        <input
          v-model.number="people"
          type="number"
          min="1"
          class="input w-full"
        >
      </div>
    </div>

    <div v-if="!manualPreview && !excelPreview" class="tabs tabs-boxed w-full mb-4 bg-amber-50/60">
      <button
        class="tab"
        :class="activeTab === 'manual' ? 'tab-active' : ''"
        @click="activeTab = 'manual'"
      >
        Ручной ввод
      </button>
      <button
        class="tab"
        :class="activeTab === 'excel' ? 'tab-active' : ''"
        @click="activeTab = 'excel'"
      >
        Excel
      </button>
    </div>

    <div v-if="!manualPreview && !excelPreview && activeTab === 'manual'" class="grid md:grid-cols-2 gap-6">
      <div class="card bg-amber-50 border border-amber-200">
        <div class="card-body">
          <h2 class="card-title text-base">
            Ручной ввод
          </h2>

          <div class="grid grid-cols-1 gap-3" />

          <div class="mt-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-sm text-gray-600">
                Гостей: {{ guests.length }} / {{ people }}
              </div>
              <button
                class="btn btn-xs"
                :disabled="guests.length >= people"
                @click="addGuest"
              >
                Добавить гостя
              </button>
            </div>
            <div class="space-y-2 max-h-56 overflow-auto pr-1">
              <div
                v-for="(g, i) in guests"
                :key="i"
                class="grid grid-cols-1 gap-2"
              >
                <input
                  v-model="g.name"
                  class="input input-sm input-bordered"
                  placeholder="Имя"
                >
                <input
                  v-model="g.date_of_birth"
                  class="input input-sm input-bordered"
                  placeholder="ДД.ММ.ГГГГ"
                >
                <input
                  v-model="g.city"
                  class="input input-sm input-bordered"
                  placeholder="Город"
                >
                <input
                  v-model="g.phone"
                  class="input input-sm input-bordered"
                  placeholder="Телефон"
                >
                <div v-if="validateGuestRow(g).length" class="text-red-600 text-xs">
                  <span v-for="(e, j) in validateGuestRow(g)" :key="j">• {{ e }} </span>
                </div>
                <div class="flex justify-end">
                  <button class="btn btn-error btn-xs" @click="removeGuest(i)">
                    Удалить
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between">
            <div class="text-xs text-gray-500">
              Проверьте данные перед созданием
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-primary"
                @click="openManualPreview"
              >
                Предпросмотр
              </button>
            </div>
          </div>

          <div class="mt-2">
            <span v-if="success" class="text-green-600 text-sm">✓ {{ success }}</span>
            <span v-else-if="error" class="text-red-600 text-sm">⚠ {{ error }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="!manualPreview && !excelPreview && activeTab === 'excel'" class="grid grid-cols-1 gap-6">
      <div class="card">
        <div class="card-body">
          <h2 class="card-title text-base">
            Импорт из Excel
          </h2>

          <div class="space-y-3">
            <div>
              <label class="block text-sm mb-1">Файл Excel</label>
              <input
                type="file"
                class="file-input file-input-bordered w-full"
                @change="onExcelChange"
              >
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-primary"
                @click="previewExcel"
              >
                Предпросмотр
              </button>
            </div>
            <p v-if="error && !success" class="text-red-600 text-sm">
              {{ error }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="manualPreview || excelPreview" class="mt-6 border rounded p-4 bg-white">
      <h3 class="font-semibold mb-2">
        Предпросмотр
      </h3>
      <div class="text-sm text-gray-700 space-y-1">
        <div><strong>Дата:</strong> {{ date }}</div>
        <div><strong>Слот:</strong> {{ time }}</div>
        <div><strong>Точное время:</strong> {{ preciseTime || time }}</div>
        <div v-if="activeTab === 'manual'">
          <strong>Гостей:</strong> {{ guests.length }} / {{ people }}
        </div>
        <div v-else>
          <strong>Файл выбран:</strong> {{ excelFile?.name || '—' }}
        </div>
      </div>
      <div
        v-if="activeTab === 'manual'"
        class="mt-3 max-h-48 overflow-auto space-y-2"
      >
        <div
          v-for="(g, i) in guests"
          :key="i"
          class="text-xs text-gray-600"
        >
          {{ i + 1 }}. {{ g.name }} — {{ g.date_of_birth }} — {{ g.city }} — {{ g.phone }}
        </div>
      </div>
      <div
        v-else
        class="mt-3 max-h-48 overflow-auto space-y-2"
      >
        <div
          v-for="(g, i) in excelGuests"
          :key="i"
          class="text-xs text-gray-600 space-y-1"
        >
          <div class="grid grid-cols-1 md:grid-cols-4 gap-1">
            <input
              v-model="g.name"
              class="input input-sm input-bordered"
              placeholder="Имя"
              @input="() => { (g as any).errors = validateGuestRow(g) }"
            >
            <input
              v-model="g.date_of_birth"
              class="input input-sm input-bordered"
              placeholder="ДД.ММ.ГГГГ"
              @input="() => { (g as any).errors = validateGuestRow(g) }"
            >
            <input
              v-model="g.city"
              class="input input-sm input-bordered"
              placeholder="Город"
              @input="() => { (g as any).errors = validateGuestRow(g) }"
            >
            <input
              v-model="g.phone"
              class="input input-sm input-bordered"
              placeholder="Телефон"
              @input="() => { (g as any).errors = validateGuestRow(g) }"
            >
          </div>
          <div v-if="(g as any).errors && (g as any).errors.length" class="text-red-600">
            <span v-for="(e, j) in (g as any).errors" :key="j">• {{ e }} </span>
          </div>
        </div>
      </div>
      <div class="mt-3 flex gap-2 justify-end">
        <button
          class="btn"
          @click="() => { manualPreview = false; excelPreview = false }"
        >
          Закрыть
        </button>
        <button
          v-if="activeTab === 'manual'"
          class="btn btn-primary"
          :disabled="!manualReady"
          @click="() => { manualPreview = false; submitManual() }"
        >
          Подтвердить
        </button>
        <button
          v-else
          class="btn btn-primary"
          :disabled="uploading || !excelReady || excelGuests.some(g => (g as any).errors && (g as any).errors.length)"
          @click="() => { excelPreview = false; submitExcelEdited() }"
        >
          Подтвердить
        </button>
      </div>
    </div>
  </div>
</template>
