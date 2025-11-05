<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import type { Guest } from "@/stores/guest-lists";

import { useAgenciesStore } from "@/stores/agencies";
import { useGuestListsStore } from "@/stores/guest-lists";
import { useGuidesStore } from "@/stores/guides";
import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

definePageMeta({
  middleware: "auth",
});

const route = useRoute();
const auth = useAuthStore();

const bookingId = route.params.id as string;
const role = (auth.role || "agency") as "admin" | "agency";

const s = useScheduleStore();
const gl = useGuestListsStore();
const guides = useGuidesStore();
const agencies = useAgenciesStore();

const pending = ref(false);
const saveSuccess = ref(false);
const glPending = ref(false);
const glError = ref("");
const glSuccess = ref("");
const glFile = ref<File | null>(null);
const glPreview: Ref<{ preview_id?: string; guests: Guest[]; errors: string[]; _validating?: boolean; booking_id?: string; guest_list?: any } | null> = ref(null);
const manualGuests = ref<Guest[]>([]);

const booking = computed(() => {
  return s.allBookings.find(b => String(b.id) === bookingId);
});

const hasGuestList = computed(() => {
  return booking.value?.id ? gl.hasGuestList(booking.value.id) : false;
});

const isAssigned = computed(() => {
  if (!booking.value?.id)
    return false;
  return booking.value?.status === "assigned";
});

const assignedGuide = computed(() => {
  if (!booking.value?.id || !hasGuestList.value)
    return null;

  const guestList = gl.byBookingId[String(booking.value.id)]?.list;
  if (!guestList?.guide_id)
    return null;

  const guide = guides.items.find(guide => guide.id === guestList.guide_id);
  return guide;
});

const selectedGuideId = ref<string>("");
const guideAssignmentPending = ref(false);
const guideAssignmentError = ref("");
const guideAssignmentSuccess = ref("");

const formDate = ref<string>("");
const formTime = ref<string>("");
const formGuests = ref<number>(1);
const formPreciseTime = ref<string>("");

watch(booking, (newBooking) => {
  if (!newBooking && s.allBookings.length > 0) {
    navigateTo("/404");
  }
  if (newBooking) {
    formDate.value = newBooking.date;
    formTime.value = newBooking.time;
    formGuests.value = newBooking.guests;
    formPreciseTime.value = newBooking.preciseTime || newBooking.time;
  }
});

onMounted(async () => {
  if (!booking.value) {
    await s.fetchWeek();
  }

  if (!booking.value) {
    await navigateTo("/404");
    return;
  }

  if (booking.value) {
    formDate.value = booking.value.date;
    formTime.value = booking.value.time;
    formGuests.value = booking.value.guests;
    formPreciseTime.value = booking.value.preciseTime || booking.value.time;
  }

  if (role === "agency" && booking.value?.id) {
    if (booking.value.status === "filled" || booking.value.status === "assigned") {
      await gl.fetchByBooking(booking.value.id);
    }
    await guides.fetchGuides();
  }

  if (role === "admin" && booking.value?.id) {
    if (booking.value.status === "filled" || booking.value.status === "assigned") {
      await gl.fetchByBooking(booking.value.id);

      const existingList = gl.byBookingId[String(booking.value.id)]?.list;
      if (existingList && existingList.guests) {
        glPreview.value = {
          booking_id: String(booking.value.id),
          guests: existingList.guests.map(g => ({
            id: g.id,
            name: g.name,
            date_of_birth: g.date_of_birth,
            city: g.city,
            phone: g.phone,
            errors: [],
          })),
          errors: [],
        };
      }
    }
    await guides.fetchGuides();
    await agencies.fetchAgencies();
  }
});

onUnmounted(() => {
  glPreview.value = null;
  glFile.value = null;
  glError.value = "";
  glSuccess.value = "";
});

watch([formDate, formTime], async ([d, t]) => {
  if (role !== "admin") {
    return;
  }
  if (!d || !t) {
    return;
  }
  await s.fetchSlotData(d, t);
});

watch(() => gl.byBookingId[bookingId]?.list, (list) => {
  if (list && Array.isArray(list.guests)) {
    manualGuests.value = list.guests.map(g => ({
      id: g.id || "",
      name: g.name || "",
      date_of_birth: g.date_of_birth || "",
      city: g.city || "",
      phone: g.phone || "",
    })) as Guest[];
  }
});

watch(formTime, (v) => {
  if (!v)
    return;
  if (!isHalfHour(v))
    formTime.value = roundToHalfHour(v);

  if (formPreciseTime.value) {
    const slotValid = isPreciseTimeWithinSlot(formPreciseTime.value, v);
    if (!slotValid)
      formPreciseTime.value = v;
  }
});

function isPreciseTimeWithinSlot(preciseTime: string, slotTime: string): boolean {
  const [slotH, slotM] = slotTime.split(":").map(Number);
  const [preciseH, preciseM] = preciseTime.split(":").map(Number);

  const slotMinutes = slotH * 60 + slotM;
  const preciseMinutes = preciseH * 60 + preciseM;

  return preciseMinutes >= slotMinutes && preciseMinutes < slotMinutes + 30;
}

const preciseTimeRange = computed(() => {
  if (!formTime.value)
    return { minTime: { hours: 9, minutes: 0 }, maxTime: { hours: 19, minutes: 59 } };

  const [h, m] = formTime.value.split(":").map(Number);
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

const baseLeft = computed(() =>
  formDate.value && formTime.value ? s.remainingCapacity(formDate.value, formTime.value) : 0,
);

const maxLeft = computed(() => {
  if (!booking.value)
    return baseLeft.value;
  const same = booking.value && booking.value.date === formDate.value && booking.value.time === formTime.value;
  return same ? baseLeft.value + (booking.value?.guests || 0) : baseLeft.value;
});

const showGuestWarning = computed(() => {
  return role === "agency" && formGuests.value > maxLeft.value;
});

const filledManualGuests = computed(() => {
  return manualGuests.value.filter(g =>
    g.name?.trim()
    && g.date_of_birth?.trim()
    && g.city?.trim()
    && g.phone?.trim(),
  ).length;
});

const hasEnoughManualGuests = computed(() => {
  return filledManualGuests.value >= (booking.value?.guests || 0);
});

const agencyIdToName = computed(() => {
  const map: Record<string, string> = {};
  if (role === "admin" && agencies.items) {
    agencies.items.forEach((a) => {
      map[a.agency_id] = a.name;
    });
  }
  return map;
});

function getAgencyNameForGuide(guideAgencyId: string): string {
  return agencyIdToName.value[guideAgencyId] || "";
}

function validateExcelFile(file: File | null): string | null {
  if (!file)
    return "Файл не выбран";
  const maxBytes = 8 * 1024 * 1024;
  if (file.size > maxBytes)
    return "Файл слишком большой (макс. 8MB)";
  const name = file.name.toLowerCase();
  const ok = name.endsWith(".xlsx") || name.endsWith(".xls");
  if (!ok)
    return "Поддерживаются только Excel файлы (.xlsx, .xls)";
  return null;
}

async function onSave() {
  if (pending.value)
    return;
  if (!formDate.value || !formTime.value || formGuests.value < 1)
    return;
  if (formGuests.value > maxLeft.value)
    return;

  saveSuccess.value = false;
  pending.value = true;
  try {
    if (role === "admin") {
      await s.adminModifyBooking({
        bookingId,
        date: formDate.value,
        time: formTime.value,
        people: formGuests.value,
        preciseTime: formPreciseTime.value || formTime.value,
      });
      await s.fetchWeek();
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
    else {
      await s.modifyBooking(bookingId, formGuests.value, formPreciseTime.value || formTime.value);
      await s.fetchWeek();
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
  }
  finally {
    pending.value = false;
  }
}

async function onFileChange(e: any) {
  const file = e?.target?.files && e.target.files[0];
  if (!file) {
    glFile.value = null;
    glPreview.value = null;
    return;
  }

  glFile.value = file;
  await onUploadPreview();
}

async function onUploadPreview() {
  if (!booking.value?.id) {
    return;
  }

  glError.value = "";
  glSuccess.value = "";
  glPreview.value = null;

  glPending.value = true;

  try {
    const fileErr = validateExcelFile(glFile.value);
    if (fileErr) {
      glError.value = fileErr;
      return;
    }

    const file = glFile.value as File;

    try {
      const result = await gl.previewExcel(String(booking.value.id), file);

      if (result && (result.guests || result.errors)) {
        glPreview.value = result;
      }
      else {
        glError.value = "Не удалось загрузить файл";
      }
    }
    catch (e: any) {
      if (e?.response?.status === 400 && e?.data) {
        try {
          glPreview.value = e.data;

          if (!e.data.guests || !Array.isArray(e.data.guests) || e.data.guests.length === 0) {
            const errorMsg = e.data.errors || e.data.detail || "Не удалось загрузить файл";
            glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
          }
        }
        catch {
          glError.value = "Ошибка при обработке файла Excel";
        }
      }
      else {
        throw e;
      }
    }
  }
  catch (e: any) {
    const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось загрузить файл";
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onConfirmPreview() {
  if (!booking.value?.id || !glPreview.value) {
    return;
  }
  glError.value = "";
  glSuccess.value = "";
  glPending.value = true;
  try {
    const guests = (glPreview.value.guests || []).map(g => ({
      name: (g.name || "").trim(),
      date_of_birth: (g.date_of_birth || "").trim(),
      city: (g.city || "").trim(),
      phone: (g.phone || "").trim(),
    })) as Guest[];

    try {
      let result;

      if (role === "admin") {
        result = await gl.confirmAdmin(String(booking.value.id), guests);
      }
      else {
        if (!glPreview.value.preview_id) {
          throw new Error("Preview ID не найден");
        }
        result = await gl.confirmExcel(glPreview.value.preview_id, String(booking.value.id), guests);
      }

      if (result.errors && result.errors.length > 0) {
        glError.value = result.errors.join(", ");
        return;
      }

      glSuccess.value = role === "admin" ? "Список гостей обновлён администратором" : "Список гостей обновлён";
      await gl.fetchByBooking(String(booking.value.id));
      await s.fetchWeek();

      if (role === "admin") {
        const existingList = gl.byBookingId[String(booking.value.id)]?.list;
        if (existingList && existingList.guests) {
          glPreview.value = {
            booking_id: String(booking.value.id),
            guests: existingList.guests.map(g => ({
              id: g.id,
              name: g.name,
              date_of_birth: g.date_of_birth,
              city: g.city,
              phone: g.phone,
              errors: [],
            })),
            errors: [],
          };
        }
      }
      else {
        glPreview.value = null;
        glFile.value = null;
      }
    }
    catch (e: any) {
      if (e?.response?.status === 400 && e?.data) {
        if (e.data.preview_id) {
          glPreview.value = e.data;
        }
        else if (e.data.guests || e.data.errors) {
          glPreview.value = e.data;
        }
        glError.value = "Ошибки валидации. Пожалуйста, исправьте ошибки и попробуйте снова.";
      }
      else {
        throw e;
      }
    }
  }
  catch (e: any) {
    const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось подтвердить импорт";
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onPreviewManual() {
  if (!booking.value?.id) {
    return;
  }

  glError.value = "";
  glSuccess.value = "";
  glPreview.value = null;

  glPending.value = true;

  try {
    const guests = manualGuests.value.map(g => ({
      name: (g.name || "").trim(),
      date_of_birth: (g.date_of_birth || "").trim(),
      city: (g.city || "").trim(),
      phone: (g.phone || "").trim(),
    })) as Guest[];

    const result = await gl.previewManual(String(booking.value.id), guests);

    if (result && (result.guests || result.errors)) {
      glPreview.value = result;
    }
    else {
      glError.value = "Не удалось создать предварительный просмотр";
    }
  }
  catch (e: any) {
    if (e?.response?.status === 400 && e?.data) {
      if (e.data.guests || e.data.errors || e.data.preview_id) {
        glPreview.value = e.data;
      }
      const generalError = e.data.errors || e.data.detail;
      if (generalError) {
        glError.value = Array.isArray(generalError) ? generalError.join(", ") : generalError;
      }
      return;
    }

    if (e?.response?.status === 422 && Array.isArray(e?.data?.detail)) {
      const msgs = e.data.detail.map((d: any) => d?.msg || d?.message || JSON.stringify(d));
      glError.value = msgs.join(", ");
    }
    else {
      const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось создать предварительный просмотр";
      glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
    }
  }
  finally {
    glPending.value = false;
  }
}

async function onDeleteGuestList() {
  if (!booking.value?.id || glPending.value)
    return;

  // eslint-disable-next-line no-alert
  if (!confirm("Вы уверены, что хотите удалить список гостей? Это действие нельзя отменить."))
    return;

  glPending.value = true;
  glError.value = "";
  glSuccess.value = "";

  try {
    const result = await gl.deleteAdminGuestList(String(booking.value.id));
    glSuccess.value = result.detail || "Список гостей удалён";
    glPreview.value = null;

    gl.setListForBooking(String(booking.value.id), null);

    await s.fetchWeek();
  }
  catch (e: any) {
    const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось удалить список гостей";
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onDelete() {
  if (pending.value)
    return;

  // eslint-disable-next-line no-alert
  if (!confirm("Вы уверены, что хотите удалить бронирование? Это действие нельзя отменить."))
    return;

  pending.value = true;
  try {
    if (role === "admin" && hasGuestList.value && booking.value?.id) {
      try {
        await gl.deleteAdminGuestList(String(booking.value.id));
      }
      catch (e: any) {
        const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось удалить список гостей";
        glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
        return;
      }
    }

    if (role === "admin")
      await s.adminCancelBooking(bookingId);
    else
      await s.cancelBooking(bookingId);
    await navigateTo("/bookings");
  }
  finally {
    pending.value = false;
  }
}

async function onAssignGuide() {
  if (guideAssignmentPending.value || !selectedGuideId.value || !booking.value?.id)
    return;

  guideAssignmentPending.value = true;
  guideAssignmentError.value = "";
  guideAssignmentSuccess.value = "";

  try {
    const result = isAssigned.value
      ? await guides.reassignGuide(String(booking.value.id), selectedGuideId.value)
      : await guides.assignGuide(String(booking.value.id), selectedGuideId.value);
    guideAssignmentSuccess.value = result.detail;
    selectedGuideId.value = "";
    await s.fetchWeek();
  }
  catch (e: any) {
    const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось назначить гида";
    guideAssignmentError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    guideAssignmentPending.value = false;
  }
}
</script>

<template>
  <div v-if="!booking && s.loading" class="container mx-auto p-6 max-w-4xl">
    <div class="flex justify-center items-center min-h-64">
      <span class="loading loading-spinner loading-lg" />
    </div>
  </div>

  <div v-else-if="booking" class="container mx-auto p-6 max-w-4xl">
    <div class="mb-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold">
            Редактирование бронирования
          </h1>
          <p class="text-gray-600 mt-2">
            ID: {{ bookingId }}
          </p>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <span v-if="role === 'admin' && booking.agentName" class="badge badge-primary badge-lg">{{ booking.agentName }}</span>
            <span v-if="booking.immediate" class="badge border border-dashed border-amber-500 text-amber-700 bg-amber-50">
              Залётные
            </span>
          </div>
        </div>
        <button
          class="btn btn-ghost btn-sm md:btn-md self-start sm:self-auto mt-2 sm:mt-0"
          @click="navigateTo('/bookings')"
        >
          ← Назад к бронированиям
        </button>
      </div>
    </div>

    <div class="space-y-8">
      <div class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            Основная информация
          </h2>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-sm font-medium mb-2">Дата</label>
              <Datepicker
                v-model="formDate"
                locale="ru"
                model-type="yyyy-MM-dd"
                :auto-apply="true"
                :teleport="true"
                :ui="{ input: 'input' }"
                :disabled="(role !== 'admin') || pending"
                :enable-time-picker="false"
                :close-on-auto-apply="true"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">Время слота</label>
              <Datepicker
                v-model="formTime"
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
                :disabled="(role !== 'admin') || pending"
                :close-on-auto-apply="true"
                :class="{ 'input-disabled': (role !== 'admin') || pending }"
              />
            </div>

            <div>
              <label class="block text-sm font-medium mb-2">
                Количество гостей (макс. {{ maxLeft }})
              </label>
              <input
                v-model.number="formGuests"
                type="number"
                min="1"
                :max="maxLeft"
                class="input input-bordered w-full"
                :disabled="pending || (role === 'agency' && hasGuestList)"
                :class="{ 'input-disabled': role === 'agency' && hasGuestList }"
              >
            </div>
          </div>

          <div class="mt-4">
            <div v-if="booking?.preciseTime && booking.preciseTime !== booking.time" class="mb-3 p-3 bg-blue-50 border border-blue-200 rounded">
              <div class="text-sm text-blue-800">
                <strong>Текущее точное время:</strong> {{ booking.preciseTime }}
                <span class="text-blue-600 ml-2">(слот: {{ booking.time }})</span>
              </div>
            </div>
            <label class="block text-sm font-medium mb-2">
              Точное время (в пределах слота)
              <span class="text-gray-500 font-normal text-xs ml-1">
                (от {{ formTime }} до {{ formTime ? (() => { const [h, m] = formTime.split(':').map(Number); const newM = m + 29; return newM >= 60 ? `${h + 1}:${String(newM - 60).padStart(2, '0')}` : `${h}:${String(newM).padStart(2, '0')}`; })() : '' }})
              </span>
            </label>
            <Datepicker
              v-model="formPreciseTime"
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
              :disabled="pending || (role === 'agency' && hasGuestList)"
              :close-on-auto-apply="true"
              :class="{ 'input-disabled': pending }"
            />
            <p class="text-xs text-gray-500 mt-1">
              Укажите точное время в пределах 30-минутного слота. Если не указано, используется время слота.
            </p>
          </div>

          <div v-if="showGuestWarning" class="alert alert-warning mt-4">
            <span>⚠️ Количество гостей превышает максимально доступное для данного слота</span>
          </div>

          <div v-if="saveSuccess" class="alert alert-success mt-4">
            <span>✓ Изменения успешно сохранены</span>
          </div>

          <div v-if="!(role === 'agency' && hasGuestList)" class="card-actions justify-end mt-6">
            <button
              class="btn btn-primary"
              :disabled="pending"
              :class="{ 'btn-disabled': pending }"
              @click="onSave"
            >
              <span v-if="pending" class="loading loading-dots loading-sm" />
              <span v-else>Сохранить изменения</span>
            </button>
          </div>

          <div v-if="role === 'agency' && hasGuestList" class="alert alert-info mt-6">
            <span>ℹ️ Изменения заблокированы после подачи списка гостей. Обратитесь к администратору для внесения изменений.</span>
          </div>
        </div>
      </div>

      <div v-if="role === 'admin'" class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            Список гостей (Админ)
          </h2>

          <div v-if="glPreview" class="space-y-4">
            <div class="alert alert-info">
              <span>Редактирование списка гостей. После сохранения агентство получит уведомление на email.</span>
            </div>

            <div class="flex gap-2">
              <button
                class="btn btn-sm btn-warning"
                :disabled="glPending"
                @click="onConfirmPreview"
              >
                <span v-if="glPending" class="loading loading-dots loading-sm" />
                <span v-else>Сохранить изменения</span>
              </button>
              <button
                class="btn btn-sm btn-error"
                :disabled="glPending"
                @click="onDeleteGuestList"
              >
                Удалить список гостей
              </button>
              <button
                class="btn btn-sm btn-ghost"
                @click="glPreview = null"
              >
                Отменить
              </button>
            </div>

            <div class="max-h-96 overflow-auto border rounded">
              <div class="p-3 bg-blue-50 border-b">
                <div class="text-sm text-blue-800">
                  <strong>Редактирование:</strong> Измените данные и нажмите "Сохранить изменения"
                </div>
              </div>
              <div class="space-y-2 p-3">
                <div
                  v-for="(g, i) in glPreview.guests"
                  :key="i"
                  class="border rounded p-3"
                  :class="g.errors && g.errors.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'"
                >
                  <div class="flex items-center justify-between mb-2">
                    <span class="font-medium text-sm">Гость #{{ i + 1 }}</span>
                    <div v-if="g.errors && g.errors.length > 0" class="text-red-600 text-xs">
                      {{ g.errors.length }} ошибок
                    </div>
                  </div>
                  <div v-if="g.errors && g.errors.length > 0" class="mb-2">
                    <div class="text-red-600 text-xs space-y-1">
                      <div
                        v-for="error in g.errors"
                        :key="error"
                        class="flex items-start"
                      >
                        <span class="mr-1">•</span>
                        <span>{{ error }}</span>
                      </div>
                    </div>
                  </div>
                  <div class="grid grid-cols-1 gap-2">
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">Имя</label>
                      <input
                        v-model="g.name"
                        class="input input-bordered input-sm w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('имя')) ? 'input-error' : ''"
                      >
                    </div>
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">Дата рождения (ДД.ММ.ГГГГ)</label>
                      <input
                        v-model="g.date_of_birth"
                        class="input input-bordered input-sm w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('дата') || e.includes('возраст')) ? 'input-error' : ''"
                      >
                    </div>
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">Город</label>
                      <input
                        v-model="g.city"
                        class="input input-bordered input-sm w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('город')) ? 'input-error' : ''"
                      >
                    </div>
                    <div>
                      <label class="block text-xs text-gray-600 mb-1">Телефон</label>
                      <input
                        v-model="g.phone"
                        class="input input-bordered input-sm w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('телефон')) ? 'input-error' : ''"
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-2">
              <span v-if="glSuccess" class="text-green-600 text-sm">
                ✓ {{ glSuccess }}
              </span>
              <span v-else-if="glError" class="text-red-600 text-sm">
                ⚠ {{ glError }}
              </span>
            </div>
          </div>

          <div v-else-if="hasGuestList" class="space-y-2">
            <div class="alert alert-info">
              <span>Список гостей существует. Вы можете его отредактировать или удалить.</span>
            </div>
            <div class="flex gap-2">
              <button
                class="btn btn-sm btn-warning"
                @click="() => {
                  if (!booking) return;
                  const existingList = gl.byBookingId[String(booking.id)]?.list;
                  if (existingList && existingList.guests) {
                    glPreview = {
                      booking_id: String(booking.id),
                      guests: existingList.guests.map(g => ({
                        id: g.id,
                        name: g.name,
                        date_of_birth: g.date_of_birth,
                        city: g.city,
                        phone: g.phone,
                        errors: [],
                      })),
                      errors: [],
                    };
                  }
                }"
              >
                Редактировать список
              </button>
              <button
                class="btn btn-sm btn-error"
                :disabled="glPending"
                @click="onDeleteGuestList"
              >
                Удалить список гостей
              </button>
            </div>
          </div>

          <div v-else class="alert alert-warning">
            <span>Список гостей пока не загружен агентством.</span>
          </div>
        </div>
      </div>

      <div v-if="role === 'agency'" class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            Список гостей
          </h2>

          <template v-if="hasGuestList">
            <div class="space-y-2">
              <div class="max-h-64 overflow-auto border rounded p-3 md:p-0">
                <div class="md:hidden space-y-2">
                  <div
                    v-for="(g, i) in manualGuests"
                    :key="i"
                    class="border rounded p-3 bg-white"
                  >
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm text-gray-500">#{{ i + 1 }}</span>
                    </div>
                    <div class="grid grid-cols-1 gap-2 text-sm">
                      <div>
                        <div class="text-gray-500">
                          Имя
                        </div>
                        <div class="text-gray-900 break-words">
                          {{ g.name }}
                        </div>
                      </div>
                      <div>
                        <div class="text-gray-500">
                          ДР
                        </div>
                        <div class="text-gray-900 break-words">
                          {{ g.date_of_birth }}
                        </div>
                      </div>
                      <div>
                        <div class="text-gray-500">
                          Город
                        </div>
                        <div class="text-gray-900 break-words">
                          {{ g.city }}
                        </div>
                      </div>
                      <div>
                        <div class="text-gray-500">
                          Телефон
                        </div>
                        <div class="text-gray-900 break-words">
                          {{ g.phone }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <table class="hidden md:table md:table-zebra md:table-sm w-full">
                  <thead>
                    <tr>
                      <th>#</th><th>Имя</th><th>ДР</th><th>Город</th><th>Телефон</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(g, i) in manualGuests" :key="i">
                      <td>{{ i + 1 }}</td>
                      <td>{{ g.name }}</td>
                      <td>{{ g.date_of_birth }}</td>
                      <td>{{ g.city }}</td>
                      <td>{{ g.phone }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="space-y-4">
              <div v-if="!hasGuestList && !glPreview">
                <label class="block mb-1">Загрузка Excel</label>
                <input
                  type="file"
                  class="file-input file-input-bordered w-full"
                  @change="onFileChange"
                >
              </div>
              <div v-if="glPreview" class="space-y-4">
                <div class="flex gap-2">
                  <button
                    class="btn btn-sm btn-warning"
                    :disabled="glPending"
                    @click="onConfirmPreview"
                  >
                    Подтвердить импорт
                  </button>
                  <button
                    class="btn btn-sm btn-ghost"
                    @click="glPreview = null; glFile = null"
                  >
                    Отменить
                  </button>
                </div>
                <div v-if="glPreview" class="mt-3">
                  <div
                    v-if="glPreview.errors && glPreview.errors.length > 0"
                    class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
                  >
                    <div class="font-semibold mb-1">
                      Общие ошибки:
                    </div>
                    <ul class="list-disc list-inside space-y-1">
                      <li
                        v-for="error in glPreview.errors"
                        :key="error"
                      >
                        {{ error }}
                      </li>
                    </ul>
                  </div>
                  <div class="max-h-64 overflow-auto border rounded">
                    <div class="p-3 bg-blue-50 border-b">
                      <div class="text-sm text-blue-800">
                        <strong>Предварительный просмотр:</strong> Вы можете редактировать данные перед подтверждением
                      </div>
                    </div>
                    <div class="space-y-2 p-3">
                      <div
                        v-for="(g, i) in glPreview.guests"
                        :key="i"
                        class="border rounded p-3"
                        :class="g.errors && g.errors.length > 0 ? 'border-red-300 bg-red-50' : 'border-gray-200'"
                      >
                        <div class="flex items-center justify-between mb-2">
                          <span class="font-medium text-sm">Гость #{{ i + 1 }}</span>
                          <div v-if="g.errors && g.errors.length > 0" class="text-red-600 text-xs">
                            {{ g.errors.length }} ошибок
                          </div>
                        </div>
                        <div v-if="g.errors && g.errors.length > 0" class="mb-2">
                          <div class="text-red-600 text-xs space-y-1">
                            <div
                              v-for="error in g.errors"
                              :key="error"
                              class="flex items-start"
                            >
                              <span class="mr-1">•</span>
                              <span>{{ error }}</span>
                            </div>
                          </div>
                        </div>
                        <div class="grid grid-cols-1 gap-2">
                          <div>
                            <label class="block text-xs text-gray-600 mb-1">Имя</label>
                            <input
                              v-model="g.name"
                              class="input input-bordered input-sm w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('имя')) ? 'input-error' : ''"
                            >
                          </div>
                          <div>
                            <label class="block text-xs text-gray-600 mb-1">Дата рождения (ДД.ММ.ГГГГ)</label>
                            <input
                              v-model="g.date_of_birth"
                              class="input input-bordered input-sm w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('дата') || e.includes('возраст')) ? 'input-error' : ''"
                            >
                          </div>
                          <div>
                            <label class="block text-xs text-gray-600 mb-1">Город</label>
                            <input
                              v-model="g.city"
                              class="input input-bordered input-sm w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('город')) ? 'input-error' : ''"
                            >
                          </div>
                          <div>
                            <label class="block text-xs text-gray-600 mb-1">Телефон</label>
                            <input
                              v-model="g.phone"
                              class="input input-bordered input-sm w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('телефон')) ? 'input-error' : ''"
                            >
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!glPreview">
                <label class="block mb-1">Ручной ввод</label>
                <div class="text-sm text-gray-600 mb-2">
                  Гостей: {{ filledManualGuests }} / {{ booking?.guests || 0 }} (заполнено)
                  <span v-if="hasEnoughManualGuests" class="text-green-600 ml-2">
                    ✓ готово к предварительному просмотру
                  </span>
                  <span v-else class="text-orange-600 ml-2">
                    (недостаточно заполненных записей)
                  </span>
                </div>
                <div class="space-y-2 max-h-56 overflow-auto pr-1">
                  <div
                    v-for="(g, i) in manualGuests"
                    :key="i"
                    class="grid grid-cols-5 gap-1"
                  >
                    <input
                      v-model="g.name"
                      class="input input-bordered input-sm"
                      placeholder="Имя"
                    >
                    <input
                      v-model="g.date_of_birth"
                      class="input input-bordered input-sm"
                      placeholder="ДД.ММ.ГГГГ"
                    >
                    <input
                      v-model="g.city"
                      class="input input-bordered input-sm"
                      placeholder="Город"
                    >
                    <input
                      v-model="g.phone"
                      class="input input-bordered input-sm"
                      placeholder="Телефон"
                    >
                    <button
                      class="btn btn-error btn-sm"
                      @click="manualGuests.splice(i, 1)"
                    >
                      -
                    </button>
                  </div>
                </div>
                <div class="mt-2 flex gap-2">
                  <button
                    class="btn btn-sm"
                    :disabled="manualGuests.length >= (booking?.guests || 0)"
                    @click="manualGuests.push({ id: '', name: '', date_of_birth: '', city: '', phone: '' })"
                  >
                    Добавить
                  </button>
                  <button
                    v-if="hasEnoughManualGuests"
                    class="btn btn-sm btn-warning"
                    :disabled="glPending"
                    @click="onPreviewManual"
                  >
                    Предварительный просмотр
                  </button>
                </div>
              </div>
            </div>
            <div class="mt-2">
              <span v-if="glSuccess" class="text-green-600 text-sm">
                ✓ {{ glSuccess }}
              </span>
              <span v-else-if="glError" class="text-red-600 text-sm">
                ⚠ {{ glError }}
              </span>
            </div>
          </template>
        </div>
      </div>

      <div v-if="hasGuestList" class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4">
            {{ isAssigned ? 'Гид назначен' : 'Назначение гида' }}
          </h2>

          <div class="space-y-3">
            <div v-if="isAssigned" class="p-3 bg-green-50 border border-green-200 rounded">
              <div class="text-green-800 text-sm flex items-center gap-2">
                <template v-if="assignedGuide">
                  <span>✓ Гид назначен: <strong>{{ assignedGuide.lastname }} {{ assignedGuide.name }}</strong> (№{{ assignedGuide.badge_number }})</span>
                  <span v-if="role === 'admin' && getAgencyNameForGuide(assignedGuide.agency_id)" class="badge badge-sm badge-primary">
                    {{ getAgencyNameForGuide(assignedGuide.agency_id) }}
                  </span>
                </template>
                <template v-else>
                  <span>✓ Гид назначен на это бронирование</span>
                </template>
              </div>
            </div>

            <div v-else class="p-3 bg-gray-50 border border-gray-200 rounded">
              <div class="text-gray-600 text-sm">
                ⚠ Гид не назначен
              </div>
            </div>

            <template v-if="role === 'agency'">
              <div>
                <label class="block mb-1">
                  {{ isAssigned ? 'Изменить гида' : 'Выберите гида' }}
                </label>
                <select
                  v-model="selectedGuideId"
                  class="select select-bordered w-full"
                  :disabled="guideAssignmentPending"
                >
                  <option value="">
                    {{ isAssigned ? '-- Выберите нового гида --' : '-- Выберите гида --' }}
                  </option>
                  <option
                    v-for="guide in guides.items"
                    :key="guide.id"
                    :value="guide.id"
                  >
                    {{ guide.lastname }} {{ guide.name }} (№{{ guide.badge_number }})
                  </option>
                </select>
              </div>

              <div class="flex gap-2">
                <button
                  class="btn btn-sm"
                  :class="isAssigned ? 'btn-warning' : 'btn-primary'"
                  :disabled="!selectedGuideId || guideAssignmentPending"
                  @click="onAssignGuide"
                >
                  <span v-if="guideAssignmentPending" class="loading loading-dots loading-sm" />
                  <span v-else>{{ isAssigned ? 'Изменить гида' : 'Назначить гида' }}</span>
                </button>
              </div>

              <div v-if="guideAssignmentSuccess" class="text-green-600 text-sm">
                ✓ {{ guideAssignmentSuccess }}
              </div>
              <div v-else-if="guideAssignmentError" class="text-red-600 text-sm">
                ⚠ {{ guideAssignmentError }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <div v-if="role === 'admin' || !hasGuestList" class="card bg-base-100 shadow-xl">
        <div class="card-body">
          <h2 class="card-title text-xl mb-4 text-red-600">
            Опасная зона
          </h2>
          <p class="text-gray-600 mb-4">
            Удаление бронирования нельзя отменить. Все связанные данные будут потеряны.
          </p>
          <button
            class="btn btn-error"
            :disabled="pending"
            :class="{ 'btn-disabled': pending }"
            @click="onDelete"
          >
            <span v-if="pending" class="loading loading-dots loading-sm" />
            <span v-else>Удалить бронирование</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
