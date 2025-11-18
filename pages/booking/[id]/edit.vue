<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import type { Guest } from "@/stores/guest-lists";

import { useAgenciesStore } from "@/stores/agencies";
import { useGuestListsStore } from "@/stores/guest-lists";
import { useGuidesStore } from "@/stores/guides";
import { useScheduleStore } from "@/stores/schedule";
import { formatDateInput, formatPhoneInput } from "@/utils/input-format";
import { startOfWeek } from "~/utils/date";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const route = useRoute();
const auth = useAuthStore();

const bookingId = route.params.id as string;
const role = auth.role as "admin" | "agency";

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

const assignedGuides = computed(() => {
  if (!booking.value?.id || !hasGuestList.value)
    return [] as any[];
  const guestList = gl.byBookingId[String(booking.value.id)]?.list;
  const ids = Array.isArray(guestList?.guide_ids) ? guestList!.guide_ids : [];
  return ids.map(id => guides.items.find(g => g.id === id)).filter(Boolean);
});
const isAssigned = computed(() => assignedGuides.value.length > 0 || booking.value?.status === "assigned");
const requiredGuides = computed(() => Math.max(1, Math.ceil((booking.value?.guests || 0) / 17)));
const guideSelects = ref<string[]>([]);

function initGuideSelects() {
  const req = requiredGuides.value;
  const current = assignedGuides.value.map(g => g.id);
  const arr: string[] = Array.from({ length: req }, () => "");
  for (let i = 0; i < Math.min(req, current.length); i++) {
    arr[i] = current[i] || "";
  }
  guideSelects.value = arr;
}

watch([requiredGuides, assignedGuides], initGuideSelects, { immediate: true });

function availableGuidesFor(index: number) {
  const chosen = new Set(guideSelects.value.filter(Boolean));
  if (guideSelects.value[index])
    chosen.delete(guideSelects.value[index]);
  return guides.items.filter(g => !chosen.has(g.id));
}

const guideAssignmentPending = ref(false);
const guideAssignmentError = ref("");
const guideAssignmentSuccess = ref("");

function normalizePreviewData(data: any) {
  if (!data)
    return data;

  const guests = Array.isArray(data.guests)
    ? data.guests.map((g: any) => ({
        ...g,
        date_of_birth: formatDateInput(g.date_of_birth || ""),
        phone: formatPhoneInput(g.phone || ""),
      }))
    : [];

  return {
    ...data,
    guests,
  };
}

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
            date_of_birth: formatDateInput(g.date_of_birth || ""),
            city: g.city,
            phone: formatPhoneInput(g.phone || ""),
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
      date_of_birth: formatDateInput(g.date_of_birth || ""),
      city: g.city || "",
      phone: formatPhoneInput(g.phone || ""),
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
    return { minTime: { hours: 8, minutes: 0 }, maxTime: { hours: 19, minutes: 59 } };

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

      // Fetch the week containing the booking's date to update the booking
      const bookingDate = new Date(formDate.value);
      const weekStartDate = startOfWeek(bookingDate);
      await s.setWeekStart(weekStartDate);

      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
    else {
      await s.modifyBooking(bookingId, formGuests.value, formPreciseTime.value || formTime.value);

      // Fetch the week containing the booking's date to update the booking
      if (booking.value?.date) {
        const bookingDate = new Date(booking.value.date);
        const weekStartDate = startOfWeek(bookingDate);
        await s.setWeekStart(weekStartDate);
      }
      else {
        await s.fetchWeek();
      }

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

async function onFileChange(event: any) {
  const file = event?.files && event.files[0] ? event.files[0] : (event?.target?.files && event.target.files[0]);
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
        glPreview.value = normalizePreviewData(result);
      }
      else {
        glError.value = "Не удалось загрузить файл";
      }
    }
    catch (e: any) {
      if (e?.response?.status === 400 && e?.data) {
        try {
          glPreview.value = normalizePreviewData(e.data);

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

      // Fetch the week containing the booking's date to update the booking status
      if (booking.value?.date) {
        const bookingDate = new Date(booking.value.date);
        const weekStartDate = startOfWeek(bookingDate);
        await s.setWeekStart(weekStartDate);
      }
      else {
        await s.fetchWeek();
      }

      if (role === "admin") {
        const existingList = gl.byBookingId[String(booking.value.id)]?.list;
        if (existingList && existingList.guests) {
          glPreview.value = normalizePreviewData({
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
          });
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
          glPreview.value = normalizePreviewData(e.data);
        }
        else if (e.data.guests || e.data.errors) {
          glPreview.value = normalizePreviewData(e.data);
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
        glPreview.value = normalizePreviewData(e.data);
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

    // Fetch the week containing the booking's date to update the booking status
    if (booking.value?.date) {
      const bookingDate = new Date(booking.value.date);
      const weekStartDate = startOfWeek(bookingDate);
      await s.setWeekStart(weekStartDate);
    }
    else {
      await s.fetchWeek();
    }
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

async function onChangeGuideSelect(index: number) {
  if (guideAssignmentPending.value || !booking.value?.id)
    return;

  const newId = guideSelects.value[index] || "";
  if (!newId)
    return;

  const ids = guideSelects.value.filter(Boolean);
  if (ids.length !== new Set(ids).size) {
    guideAssignmentError.value = "Этот гид уже выбран в другом списке";
    initGuideSelects();
    return;
  }

  guideAssignmentPending.value = true;
  guideAssignmentError.value = "";
  guideAssignmentSuccess.value = "";
  try {
    if (index < assignedGuides.value.length) {
      const oldId = assignedGuides.value[index]?.id;
      if (oldId && oldId !== newId) {
        await guides.reassignGuide(String(booking.value.id), oldId, newId);
        guideAssignmentSuccess.value = "Гид заменён";
      }
    }
    else {
      await guides.assignGuide(String(booking.value.id), newId);
      guideAssignmentSuccess.value = "Гид добавлен";
    }
    // Refresh guest list to get updated guide assignments
    if (booking.value?.id && hasGuestList.value) {
      await gl.fetchByBooking(booking.value.id);
    }

    // Fetch the week containing the booking's date to update the booking status
    if (booking.value?.date) {
      const bookingDate = new Date(booking.value.date);
      const weekStartDate = startOfWeek(bookingDate);
      await s.setWeekStart(weekStartDate);
    }
    else {
      await s.fetchWeek();
    }
  }
  catch (e: any) {
    const errorMsg = e?.data?.detail || e?.data?.message || e?.message || "Не удалось изменить список гидов";
    guideAssignmentError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
    initGuideSelects();
  }
  finally {
    guideAssignmentPending.value = false;
  }
}
</script>

<template>
  <div v-if="!booking && s.loading" class="container mx-auto p-6 max-w-6xl">
    <div class="flex justify-center items-center min-h-64">
      <ProgressSpinner />
    </div>
  </div>

  <div v-else-if="booking" class="container mx-auto p-6 max-w-6xl">
    <div class="mb-6">
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl md:text-3xl font-bold mb-2">
            Редактирование бронирования
          </h1>
          <p class="text-surface-600 mt-2">
            ID: {{ bookingId }}
          </p>
          <div class="mt-2 flex items-center gap-2 flex-wrap">
            <Tag
              v-if="role === 'admin' && booking.agentName"
              severity="info"
              :value="booking.agentName"
            />
            <Tag
              v-if="booking.immediate"
              severity="warning"
              value="Залётные"
            />
          </div>
        </div>
        <Button
          label="Назад к бронированиям"
          icon="pi pi-arrow-left"
          text
          severity="secondary"
          size="small"
          class="self-start sm:self-auto mt-2 sm:mt-0"
          @click="navigateTo('/bookings')"
        />
      </div>
    </div>

    <div class="space-y-6">
      <Card>
        <template #title>
          <span class="text-xl font-semibold">Основная информация</span>
        </template>
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">Дата</label>
              <Datepicker
                v-model="formDate"
                locale="ru"
                model-type="yyyy-MM-dd"
                :auto-apply="true"
                :teleport="true"
                :ui="{ input: 'p-inputtext w-full' }"
                :disabled="(role !== 'admin') || pending"
                :enable-time-picker="false"
                :close-on-auto-apply="true"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">Время слота</label>
              <Datepicker
                v-model="formTime"
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
                :disabled="(role !== 'admin') || pending"
                :close-on-auto-apply="true"
              />
            </div>

            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">
                Количество гостей (макс. {{ maxLeft }})
              </label>
              <InputNumber
                v-model="formGuests"
                :min="0"
                :max="maxLeft"
                show-buttons
                class="w-full"
                :disabled="pending || (role === 'agency' && hasGuestList)"
              />
            </div>
          </div>

          <div class="mt-4">
            <Message
              v-if="booking?.preciseTime && booking.preciseTime !== booking.time"
              severity="info"
              class="mb-3"
            >
              <strong>Текущее точное время:</strong> {{ booking.preciseTime }}
              <span class="ml-2">(слот: {{ booking.time }})</span>
            </Message>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">
                Точное время (в пределах слота)
                <span class="text-surface-500 font-normal text-xs ml-1">
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
                :ui="{ input: 'p-inputtext w-full' }"
                :disabled="pending || (role === 'agency' && hasGuestList)"
                :close-on-auto-apply="true"
              />
              <p class="text-xs text-surface-500 mt-1">
                Укажите точное время в пределах 30-минутного слота. Если не указано, используется время слота.
              </p>
            </div>
          </div>

          <Message
            v-if="showGuestWarning"
            severity="warn"
            class="mt-4"
          >
            Количество гостей превышает максимально доступное для данного слота
          </Message>

          <Message
            v-if="saveSuccess"
            severity="success"
            class="mt-4"
          >
            Изменения успешно сохранены
          </Message>

          <div v-if="!(role === 'agency' && hasGuestList)" class="flex justify-end mt-6">
            <Button
              label="Сохранить изменения"
              icon="pi pi-save"
              :loading="pending"
              :disabled="pending"
              @click="onSave"
            />
          </div>

          <Message
            v-if="role === 'agency' && hasGuestList"
            severity="info"
            class="mt-6"
          >
            Изменения заблокированы после подачи списка гостей. Обратитесь к администратору для внесения изменений.
          </Message>
        </template>
      </Card>

      <Card v-if="role === 'admin'">
        <template #title>
          <span class="text-xl font-semibold">Список гостей (Админ)</span>
        </template>
        <template #content>
          <div v-if="glPreview" class="space-y-4">
            <Message severity="info">
              Редактирование списка гостей. После сохранения агентство получит уведомление на email.
            </Message>

            <div class="flex gap-2 flex-wrap">
              <Button
                label="Сохранить изменения"
                icon="pi pi-save"
                severity="warning"
                size="small"
                :loading="glPending"
                :disabled="glPending"
                @click="onConfirmPreview"
              />
              <Button
                v-if="!booking?.immediate"
                label="Удалить список гостей"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                :disabled="glPending"
                @click="onDeleteGuestList"
              />
              <Button
                label="Отменить"
                icon="pi pi-times"
                text
                severity="secondary"
                size="small"
                @click="glPreview = null"
              />
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
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-surface-600">Имя</label>
                      <InputText
                        v-model="g.name"
                        size="small"
                        class="w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('имя')) ? 'p-invalid' : ''"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-surface-600">Дата рождения (ДД.ММ.ГГГГ)</label>
                      <InputText
                        v-model="g.date_of_birth"
                        size="small"
                        class="w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('дата') || e.includes('возраст')) ? 'p-invalid' : ''"
                        :disabled="glPending"
                        @input="g.date_of_birth = formatDateInput(g.date_of_birth)"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-surface-600">Город</label>
                      <InputText
                        v-model="g.city"
                        size="small"
                        class="w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('город')) ? 'p-invalid' : ''"
                      />
                    </div>
                    <div class="flex flex-col gap-1">
                      <label class="text-xs text-surface-600">Телефон</label>
                      <InputText
                        v-model="g.phone"
                        size="small"
                        class="w-full"
                        :class="g.errors && g.errors.some((e: string) => e.includes('телефон')) ? 'p-invalid' : ''"
                        :disabled="glPending"
                        @input="g.phone = formatPhoneInput(g.phone)"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Message
              v-if="glSuccess"
              severity="success"
              class="mt-2"
            >
              {{ glSuccess }}
            </Message>
            <Message
              v-else-if="glError"
              severity="error"
              class="mt-2"
            >
              {{ glError }}
            </Message>
          </div>

          <div v-else-if="hasGuestList" class="space-y-2">
            <Message severity="info">
              Список гостей существует. Вы можете его отредактировать или удалить.
            </Message>
            <div class="flex gap-2 flex-wrap">
              <Button
                label="Редактировать список"
                icon="pi pi-pencil"
                severity="warning"
                size="small"
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
              />
              <Button
                v-if="!booking?.immediate"
                label="Удалить список гостей"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                :disabled="glPending"
                @click="onDeleteGuestList"
              />
            </div>
          </div>

          <Message
            v-else
            severity="warn"
          >
            Список гостей пока не загружен агентством.
          </Message>
        </template>
      </Card>

      <Card v-if="role === 'agency'">
        <template #title>
          <span class="text-xl font-semibold">Список гостей</span>
        </template>
        <template #content>
          <template v-if="hasGuestList">
            <div class="space-y-2">
              <div class="max-h-64 overflow-auto">
                <DataTable
                  :value="manualGuests"
                  :paginator="false"
                  scrollable
                  scroll-height="16rem"
                >
                  <Column header="#" :style="{ width: '3rem' }">
                    <template #body="{ index }">
                      {{ index + 1 }}
                    </template>
                  </Column>
                  <Column field="name" header="Имя" />
                  <Column field="date_of_birth" header="ДР" />
                  <Column field="city" header="Город" />
                  <Column field="phone" header="Телефон" />
                </DataTable>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="space-y-4">
              <div v-if="!hasGuestList && !glPreview" class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Загрузка Excel</label>
                <FileUpload
                  mode="basic"
                  accept=".xlsx,.xls"
                  :max-file-size="8388608"
                  choose-label="Выбрать файл"
                  class="w-full"
                  @select="onFileChange"
                />
              </div>
              <div v-if="glPreview" class="space-y-4">
                <div class="flex gap-2 flex-wrap">
                  <Button
                    label="Подтвердить импорт"
                    icon="pi pi-check"
                    severity="warning"
                    size="small"
                    :disabled="glPending"
                    @click="onConfirmPreview"
                  />
                  <Button
                    label="Отменить"
                    icon="pi pi-times"
                    text
                    severity="secondary"
                    size="small"
                    @click="glPreview = null; glFile = null"
                  />
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
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-surface-600">Имя</label>
                            <InputText
                              v-model="g.name"
                              size="small"
                              class="w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('имя')) ? 'p-invalid' : ''"
                            />
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-surface-600">Дата рождения (ДД.ММ.ГГГГ)</label>
                            <InputText
                              v-model="g.date_of_birth"
                              size="small"
                              class="w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('дата') || e.includes('возраст')) ? 'p-invalid' : ''"
                              @input="g.date_of_birth = formatDateInput(g.date_of_birth)"
                            />
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-surface-600">Город</label>
                            <InputText
                              v-model="g.city"
                              size="small"
                              class="w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('город')) ? 'p-invalid' : ''"
                            />
                          </div>
                          <div class="flex flex-col gap-1">
                            <label class="text-xs text-surface-600">Телефон</label>
                            <InputText
                              v-model="g.phone"
                              size="small"
                              class="w-full"
                              :class="g.errors && g.errors.some((e: string) => e.includes('телефон')) ? 'p-invalid' : ''"
                              :disabled="glPending"
                              @input="g.phone = formatPhoneInput(g.phone)"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div v-if="!glPreview" class="flex flex-col gap-3">
                <div>
                  <label class="text-sm font-medium text-surface-700 mb-2 block">Ручной ввод</label>
                  <div class="text-sm text-surface-600 mb-2">
                    Гостей: {{ filledManualGuests }} / {{ booking?.guests || 0 }} (заполнено)
                    <Tag
                      v-if="hasEnoughManualGuests"
                      severity="success"
                      value="✓ готово к предварительному просмотру"
                      class="ml-2"
                    />
                    <Tag
                      v-else
                      severity="warning"
                      value="(недостаточно заполненных записей)"
                      class="ml-2"
                    />
                  </div>
                </div>
                <div class="space-y-2 max-h-56 overflow-auto pr-1">
                  <div
                    v-for="(g, i) in manualGuests"
                    :key="i"
                    class="grid grid-cols-5 gap-2"
                  >
                    <InputText
                      v-model="g.name"
                      size="small"
                      placeholder="Имя"
                    />
                    <InputText
                      v-model="g.date_of_birth"
                      size="small"
                      placeholder="ДД.ММ.ГГГГ"
                      :disabled="glPending"
                      @input="g.date_of_birth = formatDateInput(g.date_of_birth)"
                    />
                    <InputText
                      v-model="g.city"
                      size="small"
                      placeholder="Город"
                    />
                    <InputText
                      v-model="g.phone"
                      size="small"
                      placeholder="Телефон"
                      :disabled="glPending"
                      @input="g.phone = formatPhoneInput(g.phone)"
                    />
                    <Button
                      icon="pi pi-trash"
                      severity="danger"
                      size="small"
                      @click="manualGuests.splice(i, 1)"
                    />
                  </div>
                </div>
                <div class="flex gap-2 flex-wrap">
                  <Button
                    label="Добавить"
                    icon="pi pi-plus"
                    size="small"
                    :disabled="manualGuests.length >= (booking?.guests || 0)"
                    @click="manualGuests.push({ id: '', name: '', date_of_birth: '', city: '', phone: '+7' })"
                  />
                  <Button
                    v-if="hasEnoughManualGuests"
                    label="Предварительный просмотр"
                    icon="pi pi-eye"
                    severity="warning"
                    size="small"
                    :disabled="glPending"
                    @click="onPreviewManual"
                  />
                </div>
              </div>
            </div>
            <Message
              v-if="glSuccess"
              severity="success"
              class="mt-2"
            >
              {{ glSuccess }}
            </Message>
            <Message
              v-else-if="glError"
              severity="error"
              class="mt-2"
            >
              {{ glError }}
            </Message>
          </template>
        </template>
      </Card>

      <Card v-if="hasGuestList">
        <template #title>
          <span class="text-xl font-semibold">{{ isAssigned ? 'Гид назначен' : 'Назначение гида' }}</span>
        </template>
        <template #content>
          <div class="space-y-3">
            <Message
              v-if="assignedGuides.length"
              severity="success"
            >
              <div class="flex flex-col gap-2">
                <span class="font-semibold">✓ Назначенные гиды:</span>
                <div
                  v-for="g in assignedGuides"
                  :key="g.id"
                  class="flex items-center gap-2"
                >
                  <span><strong>{{ g.lastname }} {{ g.name }}</strong></span>
                  <Tag
                    v-if="role === 'admin' && getAgencyNameForGuide(g.agency_id)"
                    severity="info"
                    :value="getAgencyNameForGuide(g.agency_id)"
                    size="small"
                  />
                </div>
              </div>
            </Message>

            <Message
              v-else
              severity="warn"
            >
              <div class="flex flex-col gap-2">
                <span>⚠ Гид не назначен</span>
                <div v-if="booking" class="text-xs">
                  Для {{ booking.guests }} гостей требуется минимум {{ Math.ceil((booking.guests || 0) / 17) }} гид(а).
                </div>
              </div>
            </Message>

            <template v-if="role === 'agency'">
              <div
                class="mt-4 grid gap-3"
                :class="requiredGuides > 1 ? 'md:grid-cols-2' : 'grid-cols-1'"
              >
                <div
                  v-for="n in requiredGuides"
                  :key="n"
                  class="flex flex-col gap-2"
                >
                  <label class="text-sm font-medium text-surface-700">Гид №{{ n }}</label>
                  <Select
                    v-model="guideSelects[n - 1]"
                    :options="availableGuidesFor(n - 1).map(g => ({ label: `${g.lastname} ${g.name}`, value: g.id }))"
                    option-label="label"
                    option-value="value"
                    placeholder="-- Выберите гида --"
                    class="w-full"
                    :disabled="guideAssignmentPending"
                    @update:model-value="(val) => { guideSelects[n - 1] = val; onChangeGuideSelect(n - 1); }"
                  />
                </div>
              </div>
              <Message
                v-if="booking && assignedGuides.length < requiredGuides"
                severity="warn"
                class="mt-3"
              >
                Внимание: назначено гидов {{ assignedGuides.length }} из {{ requiredGuides }} требуемых.
              </Message>

              <Message
                v-if="guideAssignmentSuccess"
                severity="success"
                class="mt-2"
              >
                {{ guideAssignmentSuccess }}
              </Message>
              <Message
                v-else-if="guideAssignmentError"
                severity="error"
                class="mt-2"
              >
                {{ guideAssignmentError }}
              </Message>
            </template>
          </div>
        </template>
      </Card>

      <Card v-if="role === 'admin' || !hasGuestList">
        <template #title>
          <span class="text-xl font-semibold text-red-600">Опасная зона</span>
        </template>
        <template #content>
          <p class="text-surface-600 mb-4">
            Удаление бронирования нельзя отменить. Все связанные данные будут потеряны.
          </p>
          <Button
            label="Удалить бронирование"
            icon="pi pi-trash"
            severity="danger"
            :loading="pending"
            :disabled="pending"
            @click="onDelete"
          />
        </template>
      </Card>
    </div>
  </div>
</template>
