<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import type { GuestListNewConfirmResponse } from "@/types/api";
import type { Guest, GuestList, Guide } from "@/types/domain";

import { asApiError, extractErrorMessage, isRecord, toErrorString } from "@/types/errors";
import { startOfWeek } from "@/utils/date";
import { formatDateInput, formatPhoneInput } from "@/utils/input-format";
import { normalizeGeneralErrors, normalizePreviewGuests, normalizeSheetErrors } from "@/utils/normalize-preview";
import { isHalfHour, roundToHalfHour } from "@/utils/time";

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

type FileUploadSelectEvent = { files?: File[]; originalEvent?: Event };

type GuestListPreviewPayload = {
  preview_id?: string;
  guests: Array<Guest & { errors?: string[] }>;
  errors: (string | { message: string })[];
  _validating?: boolean;
  booking_id?: string;
  guest_list?: GuestList;
};

const glPreview: Ref<GuestListPreviewPayload | null> = ref(null);

const booking = computed(() => {
  return s.allBookings.find(b => String(b.id) === bookingId);
});

const hasGuestList = computed(() => {
  return booking.value?.id ? gl.hasGuestList(booking.value.id) : false;
});

const globalErrors = computed(() => normalizeGeneralErrors(glPreview.value?.errors ?? []));

const sheetErrors = computed(() => normalizeSheetErrors(glPreview.value?.errors ?? []));

const assignedGuideIds = computed(() => {
  if (!booking.value?.id || !hasGuestList.value)
    return [] as string[];
  const guestList = gl.byBookingId[String(booking.value.id)]?.list;
  return Array.isArray(guestList?.guide_ids) ? guestList!.guide_ids : [];
});

const assignedGuides = computed(() => {
  if (!booking.value?.id || !hasGuestList.value)
    return [] as Guide[];
  return assignedGuideIds.value
    .map(id => guides.items.find(g => g.id === id))
    .filter((g): g is Guide => Boolean(g));
});
const isAssigned = computed(() => assignedGuides.value.length > 0 || booking.value?.status === "assigned");
const requiredGuides = computed(() => Math.max(1, Math.ceil((booking.value?.guests || 0) / 17)));
const guideSelects = ref<string[]>([]);

function bookingDateTime(dateStr: string, timeStr: string) {
  const d = dateStr?.trim();
  const t = timeStr?.trim();
  if (!d || !t)
    return null;
  const dt = new Date(`${d}T${t}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

const isPastBooking = computed(() => {
  if (!booking.value)
    return false;
  const t = booking.value.preciseTime || booking.value.time;
  const dt = bookingDateTime(booking.value.date, t);
  if (!dt)
    return false;
  return dt.getTime() < Date.now();
});

const isAdminPastReadOnly = computed(() => false);

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

watch(assignedGuideIds, async (ids) => {
  if (role !== "agency" && role !== "admin")
    return;
  await Promise.all(ids.filter(Boolean).map(id => guides.fetchGuideInfo(id)));
}, { immediate: true });

function availableGuidesFor(index: number) {
  const chosen = new Set(guideSelects.value.filter(Boolean));
  if (guideSelects.value[index])
    chosen.delete(guideSelects.value[index]);
  return guides.items.filter(g => !chosen.has(g.id));
}

const guideAssignmentPending = ref(false);
const guideAssignmentError = ref("");
const guideAssignmentSuccess = ref("");

type ApiErrorData = {
  guests?: unknown;
  errors?: unknown;
  detail?: unknown;
  preview_id?: unknown;
};

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

function asApiErrorData(v: unknown): ApiErrorData | null {
  return isRecord(v) ? (v as ApiErrorData) : null;
}

function normalizePreviewData(data: unknown): GuestListPreviewPayload {
  const base = (data || {}) as Partial<GuestListPreviewPayload>;
  return {
    ...(base as GuestListPreviewPayload),
    guests: normalizePreviewGuests(Array.isArray(base.guests) ? base.guests : []) as GuestListPreviewPayload["guests"],
  };
}

type GuestCellEditCompleteEvent = { data: GuestRow; field?: string; newValue?: unknown };

function onGuestCellEditComplete(event: GuestCellEditCompleteEvent) {
  const data = event?.data;
  const field = event?.field as string | undefined;
  if (!data)
    return;

  if (field === "date_of_birth") {
    data.date_of_birth = formatDateInput(data.date_of_birth || "");
  }
  if (field === "phone") {
    data.phone = formatPhoneInput(data.phone || "");
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
}

const formDate = ref<string>("");
const formTime = ref<string>("");
const formGuests = ref<number>(1);
const formPreciseTime = ref<string>("");
const formIsRadio = ref<boolean>(false);
const formCuratorName = ref<string>("");
const formDriverName = ref<string>("");

watch(booking, (newBooking) => {
  if (!newBooking && s.allBookings.length > 0) {
    navigateTo("/404");
  }
  if (newBooking) {
    formDate.value = newBooking.date;
    formTime.value = newBooking.time;
    formGuests.value = newBooking.guests;
    formPreciseTime.value = newBooking.preciseTime || newBooking.time;
    formIsRadio.value = newBooking.isRadio || false;
    formCuratorName.value = newBooking.curatorName || "";
    formDriverName.value = newBooking.driverName || "";
  }
});

onMounted(async () => {
  if (!booking.value) {
    try {
      const bookingInfo = await s.fetchBookingInfo(bookingId);

      const bookingDate = new Date(bookingInfo.date);
      const bookingWeekStart = startOfWeek(bookingDate);
      await s.setWeekStart(bookingWeekStart);
    }
    catch {
      await s.fetchWeek();
    }
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
    formIsRadio.value = booking.value.isRadio || false;
    formCuratorName.value = booking.value.curatorName || "";
    formDriverName.value = booking.value.driverName || "";
  }

  if (role === "agency" && booking.value?.id) {
    if (booking.value.status === "filled" || booking.value.status === "assigned") {
      await gl.fetchByBooking(booking.value.id);
    }
    if (!isPastBooking.value) {
      await guides.fetchGuides();
    }
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
  const ok = name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".txt");
  if (!ok)
    return "Поддерживаются только текстовые и Excel файлы (.xlsx, .xls, .txt)";
  return null;
}

async function onSave() {
  if (pending.value || isAdminPastReadOnly.value)
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
        isRadio: formIsRadio.value,
        curatorName: formCuratorName.value || undefined,
        driverName: formDriverName.value || undefined,
      });
      await s.fetchWeek();
      saveSuccess.value = true;
      setTimeout(() => {
        saveSuccess.value = false;
      }, 3000);
    }
    else {
      await s.modifyBooking(bookingId, formGuests.value, formPreciseTime.value || formTime.value, formIsRadio.value, formCuratorName.value || undefined, formDriverName.value || undefined);
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

async function onFileChange(event: FileUploadSelectEvent | Event | null | undefined) {
  if (isAdminPastReadOnly.value)
    return;
  const maybe = event as FileUploadSelectEvent | undefined;
  const inputEvent = event as Event | undefined;
  const targetFiles = (inputEvent?.target as HTMLInputElement | null)?.files;
  const file = maybe?.files?.[0] || targetFiles?.[0];
  if (!file) {
    glFile.value = null;
    glPreview.value = null;
    return;
  }

  glFile.value = file;
  await onUploadPreview();
}

async function onUploadPreview() {
  if (isAdminPastReadOnly.value)
    return;
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
    catch (e: unknown) {
      const apiErr = asApiError(e);
      const data = asApiErrorData(apiErr?.data);
      if (apiErr?.response?.status === 400 && data) {
        let normalized: GuestListPreviewPayload | null = null;
        try {
          normalized = normalizePreviewData(data);
        }
        catch {
          normalized = null;
        }

        if (normalized) {
          glPreview.value = normalized;
        }
        else {
          const errorMsg = data.errors || data.detail || "Не удалось загрузить файл";
          glPreview.value = {
            booking_id: String(booking.value.id),
            preview_id: typeof data.preview_id === "string" ? data.preview_id : undefined,
            guests: [],
            errors: Array.isArray(data.errors)
              ? data.errors.map(e => String(e))
              : [toErrorString(errorMsg, "Не удалось загрузить файл")],
          };
        }

        if (!Array.isArray(glPreview.value?.guests) || glPreview.value.guests.length === 0) {
          const errorMsg = data.errors || data.detail || "Не удалось загрузить файл";
          glError.value = toErrorString(errorMsg, "Не удалось загрузить файл");
        }
      }
      else {
        throw e;
      }
    }
  }
  catch (e: unknown) {
    const errorMsg = extractErrorMessage(e, "Не удалось загрузить файл");
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onConfirmPreview() {
  if (isAdminPastReadOnly.value)
    return;
  if (!booking.value?.id || !glPreview.value) {
    return;
  }

  await nextTick();
  (document.activeElement as HTMLElement | null)?.blur?.();
  await nextTick();

  glError.value = "";
  glSuccess.value = "";
  glPending.value = true;

  if (glPreview.value) {
    glPreview.value.errors = [];
    glPreview.value.guests?.forEach((guest) => {
      guest.errors = [];
    });
  }

  try {
    const guests = (glPreview.value.guests || []).map(g => ({
      name: (g.name || "").trim(),
      date_of_birth: (g.date_of_birth || "").trim(),
      city: (g.city || "").trim(),
      phone: (g.phone || "").trim(),
      email: (g.email || "").trim(),
    })) as Guest[];

    const form = new FormData();
    form.append("booking_id", String(booking.value.id));
    form.append("guests", JSON.stringify(guests));

    const result = await useApi<GuestListNewConfirmResponse>("/guest-lists-new/confirm", {
      method: "POST",
      body: form,
      headers: {},
    });

    if (result.errors && result.errors.length > 0) {
      if (result.guests && result.guests.length > 0) {
        glPreview.value = normalizePreviewData(result);
      }
      else {
        glError.value = result.errors.join(", ");
      }
      return;
    }

    glSuccess.value = role === "admin" ? "Список гостей обновлён администратором" : "Список гостей обновлён";
    await gl.fetchByBooking(String(booking.value.id));
    await s.fetchWeek();

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
            email: g.email || "",
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
  catch (e: unknown) {
    const apiErr = asApiError(e);
    const data = asApiErrorData(apiErr?.data);
    if (apiErr?.response?.status === 400 && data) {
      let normalized: GuestListPreviewPayload | null = null;
      try {
        normalized = normalizePreviewData(data);
      }
      catch {
        normalized = null;
      }

      if (normalized) {
        glPreview.value = normalized;
      }
      else {
        const errorMsg = data.errors || data.detail || "Не удалось подтвердить импорт";
        glPreview.value = {
          booking_id: String(booking.value.id),
          preview_id: typeof data.preview_id === "string" ? data.preview_id : undefined,
          guests: [],
          errors: Array.isArray(data.errors)
            ? data.errors.map(e => String(e))
            : [toErrorString(errorMsg, "Не удалось подтвердить импорт")],
        };
      }
    }
    else {
      const errorMsg = extractErrorMessage(e, "Не удалось подтвердить импорт");
      glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
    }
  }
  finally {
    glPending.value = false;
  }
}

async function onDeleteGuestList() {
  if (!booking.value?.id || glPending.value || isAdminPastReadOnly.value)
    return;

  // eslint-disable-next-line no-alert
  if (!confirm("Вы уверены, что хотите удалить список гостей? Это действие нельзя отменить."))
    return;

  glPending.value = true;
  glError.value = "";
  glSuccess.value = "";

  try {
    await gl.deleteAdminGuestList(String(booking.value.id));
    glSuccess.value = "Список гостей удалён";
    glPreview.value = null;
    gl.setListForBooking(String(booking.value.id), null);

    await s.fetchWeek();
  }
  catch (e: unknown) {
    const errorMsg = extractErrorMessage(e, "Не удалось удалить список гостей");
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onDeleteGuest(guestId: string | number) {
  if (!booking.value?.id || glPending.value || isAdminPastReadOnly.value)
    return;

  const guestIdStr = String(guestId);
  console.warn("Deleting guest with ID:", guestIdStr);

  // eslint-disable-next-line no-alert
  if (!confirm("Вы уверены, что хотите удалить этого гостя? Это действие нельзя отменить."))
    return;

  glPending.value = true;
  glError.value = "";
  glSuccess.value = "";

  try {
    await gl.deleteAdminGuest(guestIdStr);
    glSuccess.value = "Гость удалён";

    await gl.fetchByBooking(String(booking.value.id));
    await s.fetchWeek();

    if (glPreview.value) {
      glPreview.value.guests = glPreview.value.guests.filter(g => String(g.id) !== guestIdStr);
    }
  }
  catch (e: unknown) {
    const errorMsg = extractErrorMessage(e, "Не удалось удалить гостя");
    glError.value = Array.isArray(errorMsg) ? errorMsg.join(", ") : errorMsg;
  }
  finally {
    glPending.value = false;
  }
}

async function onDelete() {
  if (pending.value || isAdminPastReadOnly.value)
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
      catch (e: unknown) {
        const errorMsg = extractErrorMessage(e, "Не удалось удалить список гостей");
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

async function goBackToBookings() {
  if (booking.value?.date) {
    const bookingDate = new Date(booking.value.date);
    const bookingWeekStart = startOfWeek(bookingDate);
    await s.setWeekStart(bookingWeekStart);
  }
  await navigateTo("/bookings");
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
    await s.fetchWeek();
  }
  catch (e: unknown) {
    const errorMsg = extractErrorMessage(e, "Не удалось изменить список гидов");
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
              severity="secondary"
              value="Залётные"
            />
            <Tag
              v-if="booking.joint"
              severity="secondary"
              value="Сборная"
            />
            <Tag
              v-if="booking.isRadio"
              severity="secondary"
              value="Радиогиды"
            />
            <Tag
              v-if="booking.curatorName"
              severity="info"
              :value="`Сопровождающий: ${booking.curatorName}`"
            />
            <Tag
              v-if="booking.driverName"
              severity="info"
              :value="`Водитель: ${booking.driverName}`"
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
          @click="goBackToBookings()"
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
                format="dd.MM.yyyy"
                :auto-apply="true"
                :teleport="true"
                :ui="{ input: 'p-inputtext w-full' }"
                :disabled="(role !== 'admin') || pending || isAdminPastReadOnly"
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
                :disabled="(role !== 'admin') || pending || isAdminPastReadOnly"
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
                :disabled="pending || isAdminPastReadOnly || (role === 'agency' && hasGuestList)"
              />
            </div>
          </div>

          <div class="mt-4">
            <div class="flex items-center gap-2 mb-4">
              <Checkbox
                v-model="formIsRadio"
                input-id="is_radio"
                :disabled="pending || isAdminPastReadOnly || (role === 'agency' && hasGuestList)"
                :binary="true"
              />
              <label for="is_radio" class="text-sm font-medium text-surface-700 cursor-pointer">
                Радиогиды
              </label>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Имя сопровождающего</label>
                <InputText
                  v-model="formCuratorName"
                  :disabled="pending || isAdminPastReadOnly || (role === 'agency' && hasGuestList)"
                  placeholder="Необязательно"
                  class="w-full"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Имя водителя</label>
                <InputText
                  v-model="formDriverName"
                  :disabled="pending || isAdminPastReadOnly || (role === 'agency' && hasGuestList)"
                  placeholder="Необязательно"
                  class="w-full"
                />
              </div>
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
                :disabled="pending || isAdminPastReadOnly || (role === 'agency' && hasGuestList)"
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
              :disabled="pending || isAdminPastReadOnly"
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
          <div v-if="hasGuestList && (gl.byBookingId[String(booking.id)]?.list?.guests?.length || 0) > 0" class="space-y-4">
            <div class="flex gap-2 flex-wrap">
              <Button
                v-if="!booking?.immediate"
                label="Удалить список гостей"
                icon="pi pi-trash"
                severity="danger"
                size="small"
                :disabled="glPending || isAdminPastReadOnly"
                @click="onDeleteGuestList"
              />
            </div>

            <div class="max-h-96 overflow-auto border rounded">
              <div class="p-3 bg-blue-50 border-b">
                <div class="text-sm text-blue-800">
                  <strong>Редактирование:</strong>
                </div>
              </div>
              <div class="p-3">
                <BookingGuestPreviewTable
                  :guests="gl.byBookingId[String(booking.id)]?.list?.guests || []"
                  :disabled="glPending || isAdminPastReadOnly"
                  :sheet-errors="sheetErrors"
                  :show-age-column="true"
                  :is-admin="role === 'admin'"
                  @delete-guest="onDeleteGuest"
                  @cell-edit-complete="onGuestCellEditComplete"
                />
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
            <BookingGuestPreviewTable
              :guests="gl.byBookingId[String(booking.id)]?.list?.guests || []"
              :disabled="true"
              :show-age-column="true"
              @delete-guest="onDeleteGuest"
            />
          </template>
          <template v-else>
            <div class="space-y-4">
              <div v-if="!hasGuestList && (!glPreview || !glPreview.guests || glPreview.guests.length === 0)" class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Загрузка файла</label>
                <FileUpload
                  mode="basic"
                  accept=".xlsx,.xls,.txt"
                  :max-file-size="8388608"
                  choose-label="Выбрать файл"
                  class="w-full"
                  :disabled="isAdminPastReadOnly"
                  @select="onFileChange"
                />
              </div>
              <div v-if="glPreview" class="space-y-4">
                <div class="flex gap-2 flex-wrap">
                  <Button
                    v-if="glPreview.guests && glPreview.guests.length > 0"
                    label="Подтвердить импорт"
                    icon="pi pi-check"
                    severity="warning"
                    size="small"
                    :disabled="glPending || isAdminPastReadOnly"
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
                    v-if="globalErrors.length > 0"
                    class="mb-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm"
                  >
                    <div class="font-semibold mb-1">
                      Общие ошибки:
                    </div>
                    <ul class="list-disc list-inside space-y-1">
                      <li
                        v-for="(error, index) in globalErrors"
                        :key="index"
                      >
                        {{ error }}
                      </li>
                    </ul>
                  </div>
                  <div v-if="glPreview.guests && glPreview.guests.length > 0" class="border rounded">
                    <div
                      class="p-3 border-b"
                      :class="(glPreview.errors?.length > 0 || sheetErrors.length > 0) ? 'bg-red-50' : 'bg-blue-50'"
                    >
                      <div
                        class="text-sm"
                        :class="(glPreview.errors?.length > 0 || sheetErrors.length > 0) ? 'text-red-800' : 'text-blue-800'"
                      >
                        <strong>Предварительный просмотр:</strong> Вы можете редактировать данные перед подтверждением
                        <div v-if="(glPreview.errors?.length > 0 || sheetErrors.length > 0)" class="mt-2 font-semibold">
                          Пожалуйста, исправьте ошибки в данных
                        </div>
                      </div>
                    </div>
                    <div class="p-3">
                      <BookingGuestPreviewTable
                        :guests="glPreview.guests"
                        :disabled="glPending || isAdminPastReadOnly"
                        :sheet-errors="sheetErrors"
                        @delete-guest="onDeleteGuest"
                        @cell-edit-complete="onPreviewTableCellEditComplete"
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
              v-else-if="glError && !glPreview"
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
            :disabled="pending || isAdminPastReadOnly"
            @click="onDelete"
          />
        </template>
      </Card>
    </div>
  </div>
</template>
