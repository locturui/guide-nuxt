<script setup>
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

const role = useAuthStore().role;

const editingSlot = ref(null);

const apiTimeSlots = ref([]);
const allBookings = ref([]);

const currentAgentId = ref(101);
const jumpToDate = ref("");
const showDateInput = ref(false);

const showMultiModal = ref(false);
const multiEditLimit = ref(0);
const multiEditError = ref("");

const showModal = ref(false);
const formDate = ref("");
const formTime = ref("");
const formGuests = ref(1);
const formAgentId = ref(currentAgentId.value);
const editingId = ref(null);

const selectedSlotsMap = reactive({});

const multiSelectedSlots = computed(() =>
  Object.entries(selectedSlotsMap)
    .filter(([_, sel]) => sel)
    .map(([key]) => {
      const [date, time] = key.split("|");
      return { date, time };
    }),
);

function toggleSelect(day, time) {
  const key = `${day.toISOString().slice(0, 10)}|${time}`;
  selectedSlotsMap[key] = !selectedSlotsMap[key];
}

const dayCategoryDropdown = ref(null);
const dayCategoryForm = reactive({
  category: "Open",
  limit: 0,
});

const errors = reactive({
  formDate: "",
  formTime: "",
  formGuests: "",
  editingSlotLimit: "",
});

function toggleDayCategoryDropdown(dateStr) {
  if (dayCategoryDropdown.value === dateStr) {
    dayCategoryDropdown.value = null;
  }
  else {
    dayCategoryForm.category = null;
    dayCategoryForm.limit = 0;
    dayCategoryDropdown.value = dateStr;
  }
}

async function confirmDayCategory(dateStr, { category, limit }) {
  try {
    await useApi("/days/set-day-category", {
      method: "POST",
      body: {
        date: dateStr,
        category,
        ...(category === "Limited" && { limit }),
      },
    });

    await fetchTimeSlots();
    dayCategoryDropdown.value = null;
  }
  catch (err) {
    console.error("Failed to set day category:", err);
  }
}

const weekStart = ref(new Date());
function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}
function nextWeek() {
  weekStart.value = new Date(weekStart.value.getTime() + 7 * 86400000);
}
function prevWeek() {
  weekStart.value = new Date(weekStart.value.getTime() - 7 * 86400000);
}

function jumpToSelectedDate() {
  if (!jumpToDate.value)
    return;
  weekStart.value = startOfWeek(new Date(jumpToDate.value));
  showDateInput.value = false;
}

const weekDays = computed(() => {
  const days = [];
  const start = startOfWeek(weekStart.value);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d);
  }
  return days;
});

function formatDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");

  const end = new Date(d);
  end.setDate(end.getDate() + 6);

  const endYyyy = end.getFullYear();
  const endMm = String(end.getMonth() + 1).padStart(2, "0");
  const endDd = String(end.getDate()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} - ${endDd}.${endMm}.${endYyyy}`;
}

async function fetchTimeSlots() {
  const dateStr = formattedDate(weekStart.value);
  try {
    const result = await useApi(
      role === "admin"
        ? `/week/admin?date=${dateStr}`
        : `/week/agency?date=${dateStr}`,
    );

    apiTimeSlots.value = result;

    allBookings.value = result.flatMap(day =>
      day.timeslots.flatMap(slot =>
        slot.bookings.map(b => ({
          id: b.id,
          date: day.date,
          time: slot.time,
          guests: b.people_count,
          agentId: b.agency_id,
          agentName: b.agency_name,
        })),
      ),
    );
  }
  catch (err) {
    console.error("Failed to fetch timeslots", err);
  }
}

const slotMap = computed(() => {
  const map = {};
  for (const day of apiTimeSlots.value) {
    map[day.date] = day.timeslots.reduce((acc, slot) => {
      acc[slot.time] = slot;
      return acc;
    }, {});
  }
  return map;
});

const allTimes = computed(() => {
  const times = new Set();
  for (const day of apiTimeSlots.value) {
    for (const slot of day.timeslots) {
      times.add(slot.time);
    }
  }
  return Array.from(times).sort();
});

function formatISODate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseSlotDate(date, time) {
  const [h, m] = time.split(":").map(Number);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), h, m);
}

function bookingsForSlot(date, time) {
  const dayKey = formattedDate(date);
  const slot = slotMap.value[dayKey]?.[time];

  if (!slot || !slot.bookings)
    return [];

  return slot.bookings.map(b => ({
    id: b.id,
    agentName: b.agency_name,
    guests: b.people_count,
  }));
}

const selectedRemaining = computed(() => {
  if (!formDate.value || !formTime.value)
    return 0;

  const base = remainingCapacity(new Date(formDate.value), formTime.value);

  if (editingId.value) {
    const editing = allBookings.value.find(b => b.id === editingId.value);
    if (
      editing
      && editing.date === formDate.value
      && editing.time === formTime.value
    ) {
      return base + editing.guests;
    }
  }

  return base;
});

function onSelectBooking(booking) {
  formDate.value = booking.date;
  formTime.value = booking.time;
  formGuests.value = booking.guests;
  formAgentId.value = booking.agentId;
  editingId.value = booking.id;
  clearErrors();
  showModal.value = true;
}

async function save() {
  if (!validateBooking())
    return;
  try {
    await useApi("/days/book", {
      method: "POST",
      body: {
        date: formDate.value,
        time: formTime.value,
        people_count:
        formGuests.value,
      },
    });
    fetchTimeSlots();
    closeModal();
  }
  catch (err) { console.error(err); }
}

onMounted(() => {
  weekStart.value = startOfWeek(new Date());
  fetchTimeSlots();
});

watch(weekStart, fetchTimeSlots);

function formattedDate(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function onSelectSlot(start) {
  const dateStr = formatISODate(start);
  const timeStr = start.toTimeString().slice(0, 5);

  if (role === "admin") {
    const slot = slotMap.value[formattedDate(start)]?.[timeStr];
    editingSlot.value = {
      date: dateStr,
      time_str: timeStr,
      limit: slot ? slot.limit : 0,
    };
    clearErrors();
    showModal.value = true;
  }
  else {
    formDate.value = dateStr;
    formTime.value = timeStr;
    formGuests.value = 1;
    formAgentId.value = currentAgentId.value;
    editingId.value = null;
    showModal.value = true;
  }
}

function remainingCapacity(date, time) {
  const dayKey = formattedDate(date);
  return slotMap.value[dayKey]?.[time]?.remaining || 0;
}

async function saveSlotLimit() {
  if (!editingSlot.value)
    return;

  const dayKey = formattedDate(new Date(editingSlot.value.date));
  const timeStr = editingSlot.value.time_str;
  const newLimit = editingSlot.value.limit;

  const dayIndex = apiTimeSlots.value.findIndex(d => d.date === dayKey);
  if (dayIndex !== -1) {
    const timeslots = apiTimeSlots.value[dayIndex].timeslots;
    const slotIndex = timeslots.findIndex(s => s.time === timeStr);

    if (slotIndex !== -1) {
      const slot = timeslots[slotIndex];
      slot.limit = newLimit;

      const totalBooked = slot.bookings?.reduce((sum, b) => sum + b.people_count, 0) || 0;
      slot.remaining = Math.max(0, newLimit - totalBooked);

      await useApi("/days/set-timeslot-limit", {
        method: "POST",
        body: {
          date: editingSlot.value.date,
          time_str: timeStr,
          limit: newLimit,
        },
      });
    }

    showModal.value = false;
    editingSlot.value = null;
  }
}

function validateBooking() {
  clearErrors();
  if (formGuests.value < 1)
    errors.formGuests = "Введите не меньше одного гостя";
  else if (formGuests.value > selectedRemaining.value)
    errors.formGuests = "Недостаточно мест для бронирования";
  return !errors.formDate && !errors.formTime && !errors.formGuests;
}

async function saveBooking() {
  if (!validateBooking())
    return;
  try {
    await useApi("/days/modify-booking", { method: "POST", body: { booking_id: editingId.value, people_count: formGuests.value } });
    fetchTimeSlots();
    closeModal();
  }
  catch (err) { console.error(err); }
}

async function saveBookingAdmin() {
  if (formGuests.value > selectedRemaining.value)
    return;

  try {
    await useApi("/days/admin/modify-booking", {
      method: "POST",
      body: {
        booking_id: editingId.value,
        date: formDate.value,
        time: formTime.value,
        people_count: formGuests.value,
      },
    });

    const i = allBookings.value.findIndex(b => b.id === editingId.value);
    if (i !== -1) {
      allBookings.value[i].guests = formGuests.value;
    }

    showModal.value = false;
    formDate.value = null;
    formTime.value = null;
    formGuests.value = null;
    formAgentId.value = null;
    editingId.value = null;
    editingId.value = null;
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Failed to modify booking:", err);
  }
}

async function deleteBooking() {
  try {
    const booking = {
      booking_id: editingId.value,
    };

    await useApi("/days/cancel-booking", {
      method: "POST",
      body: booking,
    });

    showModal.value = false;
    editingId.value = null;
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Failed to cancel booking:", err);
  }
}

async function deleteBookingAdmin() {
  try {
    const booking = {
      booking_id: editingId.value,
    };

    await useApi("/days/admin/cancel-booking", {
      method: "POST",
      body: booking,
    });

    showModal.value = false;
    editingId.value = null;
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Failed to cancel booking:", err);
  }
}

function closeModal() {
  showModal.value = false;
  formDate.value = null;
  formTime.value = null;
  formGuests.value = null;
  formAgentId.value = null;
  editingId.value = null;
  editingSlot.value = null;
}

function clearErrors() {
  errors.formDate = "";
  errors.formTime = "";
  errors.formGuests = "";
  errors.editingSlotLimit = "";
}

function cancelMulti() {
  showMultiModal.value = false;
  for (const key in selectedSlotsMap) {
    selectedSlotsMap[key] = false;
  }
}

async function submitMultiLimit() {
  multiEditError.value = "";

  const selected = multiSelectedSlots.value;
  const limit = multiEditLimit.value;

  if (limit < 0) {
    multiEditError.value = "Лимит не может быть меньше нуля";
    return;
  }

  if (selected.length < 2) {
    multiEditError.value = "Не выбрано достаточно слотов для редактирования";
    return;
  }

  const timeslots = selected.map(({ date, time }) => [date, time]);

  try {
    await useApi("/days/admin/update-timeslot-limits", {
      method: "POST",
      body: { limit, timeslots },
    });

    showMultiModal.value = false;
    multiEditLimit.value = 0;
    cancelMulti();
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Ошибка при обновлении слотов:", err);
    multiEditError.value = "Не удалось сохранить изменения. Попробуйте снова.";
  }
}
</script>

<template>
  <div class="p-4 w-full overflow-x-auto px-15 pt-5">
    <div class="flex justify-between mb-10">
      <button class="btn btn-sm" @click="prevWeek">
        Предыдущая
      </button>

      <div class="relative">
        <h2
          class="font-bold cursor-pointer px-2 py-1 rounded-md shadow-[2px_2px_6px_#00000025] hover:shadow-[3px_3px_8px_#00000035] transition-shadow bg-white"
          @click="showDateInput = true"
        >
          {{ formatDate(weekStart) }}
        </h2>

        <div
          v-if="showDateInput"
          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-base-200 p-4 rounded shadow z-10 w-50"
        >
          <Datepicker
            v-model="jumpToDate"
            locale="ru"
            :calendar-only="true"
            calendar-class="bg-white rounded shadow-lg p-2"
            input-class="hidden"
            format="dd.MM.yyyy"
            :auto-apply="true"
          />
          <div class="flex justify-end mt-2 gap-2">
            <button class="btn btn-sm btn-primary" @click="jumpToSelectedDate">
              Перейти
            </button>
            <button class="btn btn-sm" @click="showDateInput = false">
              Отмена
            </button>
          </div>
        </div>
      </div>

      <button class="btn btn-sm" @click="nextWeek">
        Следующая
      </button>
    </div>
    <div class="grid w-full gap-0" style="grid-template-columns:40px repeat(7, minmax(0, 1fr));">
      <div />
      <div
        v-for="d in weekDays"
        :key="d"
        class="text-center font-medium relative group"
      >
        <div
          v-if="role === 'admin'"
          class="inline-block mb-2 cursor-pointer px-2 py-1 rounded-md shadow-[2px_2px_6px_#00000025] hover:shadow-[3px_3px_8px_#00000035] transition-shadow bg-white"
          @click="toggleDayCategoryDropdown(formattedDate(d))"
        >
          {{
            d.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short' })
              .replace(/^./, c => c.toUpperCase())
          }}
        </div>
        <div v-else>
          {{
            d.toLocaleDateString('ru', { weekday: 'short', day: 'numeric', month: 'short' })
              .replace(/^./, c => c.toUpperCase())
          }}
        </div>
        <transition name="modal-fade">
          <DayCategoryDropdown
            v-if="dayCategoryDropdown === formattedDate(d)"
            :date-str="formattedDate(d)"
            :model-value="dayCategoryDropdown"
            @confirm="payload => confirmDayCategory(formattedDate(d), payload)"
            @cancel="dayCategoryDropdown = null"
          />
        </transition>
      </div>

      <template v-for="time in allTimes" :key="time">
        <div class="text-right pr-2 text-xs text-gray-500">
          {{ time }}
        </div>
        <div
          v-for="day in weekDays"
          :key="formattedDate(day) + time"
          class="transition-colors duration-200 relative"
        >
          <label
            v-if="role === 'admin'"
            class="absolute top-1 right-1 z-50"
            style="pointer-events: auto"
          >
            <input
              type="checkbox"
              class="checkbox checkbox-primary checkbox-sm"
              :checked="selectedSlotsMap[`${day.toISOString().slice(0, 10)}|${time}`]"
              @change="toggleSelect(day, time)"
            >
          </label>
          <BookingSlot
            :start="parseSlotDate(day, time)"
            :end="new Date(parseSlotDate(day, time).getTime() + 30 * 60000)"
            :left="slotMap[formattedDate(day)]?.[time]?.remaining || 0"
            :limit="slotMap[formattedDate(day)]?.[time]?.limit || 0"
            :bookings="bookingsForSlot(day, time)"
            @select-slot="onSelectSlot"
            @select-booking="onSelectBooking"
          />
        </div>
      </template>
    </div>
  </div>

  <div
    v-if="multiSelectedSlots.length"
    class="fixed bottom-4 right-4 z-50 flex justify-center items-center gap-2 p-3 bg-white shadow-lg rounded-lg"
  >
    <span class="badge badge-primary">{{ multiSelectedSlots.length }} выбрано</span>
    <button class="btn btn-sm btn-primary" @click="showMultiModal = true">
      Редактировать выбранные
    </button>
    <button class="btn btn-sm" @click="cancelMulti">
      Отмена
    </button>
  </div>

  <transition name="fade">
    <div
      v-if="showModal || showMultiModal"
      class="fixed inset-0 bg-black bg-opacity-50 z-50"
      style="background-color: rgba(0,0,0,0.5);"
    />
  </transition>
  <transition name="modal-fade">
    <div v-if="showModal" class="fixed inset-0 flex items-center justify-center z-60">
      <div class="bg-white p-6 rounded-lg w-80">
        <template v-if="role === 'admin' && !editingId">
          <h3 class="font-bold mb-2">
            Задать лимит гостей для слота
          </h3>
          <label>Дата</label>
          <input
            type="date"
            lang="ru"
            :value="editingSlot.date"
            disabled
            class="input"
          >
          <label>Время</label>
          <input
            type="time"
            lang="ru"
            :value="editingSlot.time_str"
            disabled
            class="input"
          >
          <label>Лимит гостей</label>
          <input
            v-model.number="editingSlot.limit"
            type="number"
            class="input"
          >
          <div v-if="errors.editingSlotLimit" class="text-red-600 text-sm mb-2">
            {{ errors.editingSlotLimit }}
          </div>
          <div class="flex justify-end space-x-2 mt-4">
            <button class="btn btn-sm btn-primary" @click="saveSlotLimit">
              Сохранить
            </button>
            <button class="btn btn-sm" @click="closeModal">
              Отмена
            </button>
          </div>
        </template>

        <template v-else>
          <h3 class="font-bold mb-2">
            {{ editingId ? 'Изменить бронирование' : 'Новое бронирование' }}
          </h3>

          <label>Дата</label>
          <input
            v-model="formDate"
            type="date"
            lang="ru"
            class="input mb-1"
            :disabled="!editingId"
          >
          <div v-if="errors.formDate" class="text-red-600 text-sm mb-2">
            {{ errors.formDate }}
          </div>

          <label>Время</label>
          <input
            v-model="formTime"
            type="time"
            lang="ru"
            class="input mb-1"
            :disabled="editingId"
          >
          <div v-if="errors.formTime" class="text-red-600 text-sm mb-2">
            {{ errors.formTime }}
          </div>

          <label>Количество гостей (макс. {{ selectedRemaining }})</label>
          <input
            v-model.number="formGuests"
            type="number"
            min="1"
            :max="selectedRemaining"
            class="input mb-1"
          >
          <div v-if="errors.formGuests" class="text-red-600 text-sm mb-2">
            {{ errors.formGuests }}
          </div>

          <div class="flex justify-end space-x-2 mt-4">
            <button
              v-if="!editingId"
              class="btn btn-sm btn-error"
              @click="role === 'admin' ? deleteBookingAdmin() : deleteBooking()"
            >
              Удалить
            </button>
            <button class="btn btn-sm btn-primary" @click="role === 'admin' && editingId ? saveBookingAdmin() : editingId ? saveBooking() : save()">
              Сохранить
            </button>
            <button class="btn btn-sm" @click="closeModal">
              Отменить
            </button>
          </div>
        </template>
      </div>
    </div>
  </transition>
  <transition name="modal-fade">
    <div
      v-if="showMultiModal"
      class="fixed inset-0 bg-opacity-50 z-60 flex items-center justify-center"
    >
      <div class="bg-white p-6 rounded-lg w-96">
        <h3 class="font-bold mb-4">
          Редактировать несколько слотов
        </h3>

        <ul class="mb-4 list-disc pl-5 text-sm">
          <li
            v-for="slot in multiSelectedSlots"
            :key="`${slot.date}_${slot.time}`"
          >
            {{ slot.date }} {{ slot.time }}
          </li>
        </ul>

        <label class="block mb-1 font-medium">Новый лимит гостей</label>
        <input
          v-model.number="multiEditLimit"
          type="number"
          class="input w-full mb-1"
          min="0"
        >
        <div v-if="multiEditError" class="text-sm text-red-600 mb-2">
          {{ multiEditError }}
        </div>

        <div class="flex justify-end space-x-2 mt-4">
          <button class="btn btn-sm btn-primary" @click="submitMultiLimit">
            Сохранить
          </button>
          <button class="btn btn-sm" @click="cancelMulti">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.fade-enter-to,
.fade-leave-from {
  opacity: 1;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: all 0.3s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  transform: scale(0.95);
  opacity: 0;
}

.modal-fade-enter-to,
.modal-fade-leave-from {
  transform: scale(1);
  opacity: 1;
}
</style>
