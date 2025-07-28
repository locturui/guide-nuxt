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

const showModal = ref(false);
const formDate = ref("");
const formTime = ref("");
const formGuests = ref(1);
const formAgentId = ref(currentAgentId.value);
const editingId = ref(null);

const dayCategoryDropdown = ref(null);
const dayCategoryForm = reactive({
  category: "Open",
  limit: 0,
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
    console.log("Fetched time slots:", apiTimeSlots.value);
    console.log("Fetched bookings:", allBookings.value);
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

  showModal.value = true;
}

async function save() {
  if (formGuests.value > selectedRemaining.value)
    return;

  const booking = {
    id: editingId.value || Date.now(),
    date: formDate.value,
    time: formTime.value,
    guests: formGuests.value,
    agentId: formAgentId.value,
  };

  try {
    await useApi("/days/book", {
      method: "POST",
      body: {
        date: formDate.value,
        time: formTime.value,
        people_count: formGuests.value,
      },
    });

    if (editingId.value) {
      const i = allBookings.value.findIndex(b => b.id === editingId.value);
      allBookings.value[i] = booking;
    }
    else {
      allBookings.value.push(booking);
    }

    showModal.value = false;
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Failed to save booking:", err);
  }
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
    const slotIndex = apiTimeSlots.value[dayIndex].timeslots.findIndex(s => s.time === timeStr);
    if (slotIndex !== -1) {
      apiTimeSlots.value[dayIndex].timeslots[slotIndex].limit = newLimit;
      apiTimeSlots.value[dayIndex].timeslots[slotIndex].remaining = newLimit;

      await useApi("/days/set-timeslot-limit", { method: "POST", body: { date: editingSlot.value.date, time_str: timeStr, limit: newLimit } });
    }
  }

  showModal.value = false;
  editingSlot.value = null;
}

async function saveBooking() {
  if (formGuests.value > selectedRemaining.value)
    return;

  try {
    const booking = {
      booking_id: editingId.value,
      people_count: formGuests.value,
    };

    await useApi("/days/modify-booking", {
      method: "POST",
      body: booking,
    });

    const i = allBookings.value.findIndex(b => b.id === editingId.value);
    if (i !== -1) {
      allBookings.value[i].guests = formGuests.value;
    }

    showModal.value = false;
    editingId.value = null;
    fetchTimeSlots();
  }
  catch (err) {
    console.error("Failed to modify booking:", err);
  }
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
  editingSlot.value = null;
}
</script>

<template>
  <div class="p-4 w-full overflow-x-auto px-15 pt-5">
    <div class="flex justify-between mb-10">
      <button class="btn btn-sm" @click="prevWeek">
        Previous
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
            :calendar-only="true"
            calendar-class="bg-white rounded shadow-lg p-2"
            input-class="hidden"
            format="yyyy-MM-dd"
            :auto-apply="true"
          />
          <div class="flex justify-end mt-2 gap-2">
            <button class="btn btn-sm btn-primary" @click="jumpToSelectedDate">
              Go
            </button>
            <button class="btn btn-sm" @click="showDateInput = false">
              Cancel
            </button>
          </div>
        </div>
      </div>

      <button class="btn btn-sm" @click="nextWeek">
        Next
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
          {{ d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}
        </div>
        <div v-else>
          {{ d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}
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
        >
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
  <transition name="fade">
    <div
      v-if="showModal"
      class="fixed inset-0 bg-black bg-opacity-50 z-40"
      style="background-color: rgba(0,0,0,0.5);"
    />
  </transition>
  <transition name="modal-fade">
    <div
      v-if="showModal"
      class="fixed inset-0 flex items-center justify-center z-50"
      @click.self="closeModal"
    >
      <div class="bg-gray-200 dark:bg-g p-6 rounded-lg w-80 opacity-100">
        <template v-if="role === 'admin' && !editingId">
          <div class="form-control mb-2">
            <label class="label"><span class="label-text text-gray-300">Date</span></label>
            <input
              type="date"
              :value="editingSlot?.date"
              disabled
              class="input input-bordered"
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text text-gray-300">Time</span></label>
            <input
              type="time"
              :value="editingSlot?.time_str"
              disabled
              class="input input-bordered"
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text text-gray-300">Limit</span></label>
            <input
              v-model.number="editingSlot.limit"
              type="number"
              min="0"
              class="input input-bordered"
            >
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-primary" @click="saveSlotLimit">
              Save
            </button>
            <button class="btn" @click="showModal = false">
              Cancel
            </button>
          </div>
        </template>

        <template v-else-if="role === 'admin' && editingId">
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Date</span></label>
            <input
              v-model="formDate"
              type="date"
              class="input input-bordered"
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Time</span></label>
            <input
              v-model="formTime"
              type="time"
              min="09:00"
              max="19:00"
              step="1800"
              class="input input-bordered"
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Guests (max {{ selectedRemaining }})</span></label>
            <input
              v-model.number="formGuests"
              type="number"
              :min="1"
              :max="selectedRemaining"
              class="input input-bordered"
            >
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-error" @click="deleteBookingAdmin">
              Delete
            </button>
            <button class="btn btn-primary" @click="saveBookingAdmin">
              Save
            </button>
            <button class="btn" @click="showModal = false">
              Cancel
            </button>
          </div>
        </template>

        <template v-else-if="!editingId">
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Date</span></label>
            <input
              v-model="formDate"
              type="date"
              class="input input-bordered"
              disabled
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Time</span></label>
            <input
              v-model="formTime"
              type="time"
              min="09:00"
              max="19:00"
              step="1800"
              class="input input-bordered"
              disabled
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Guests (max {{ selectedRemaining }})</span></label>
            <input
              v-model.number="formGuests"
              type="number"
              :min="1"
              :max="selectedRemaining"
              class="input input-bordered"
            >
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-primary" @click="save">
              Save
            </button>
            <button class="btn" @click="showModal = false">
              Cancel
            </button>
          </div>
        </template>

        <template v-else>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Date</span></label>
            <input
              v-model="formDate"
              type="date"
              class="input input-bordered"
              disabled
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Time</span></label>
            <input
              v-model="formTime"
              type="time"
              min="09:00"
              max="19:00"
              step="1800"
              class="input input-bordered"
              disabled
            >
          </div>
          <div class="form-control mb-2">
            <label class="label"><span class="label-text">Guests (max {{ selectedRemaining }})</span></label>
            <input
              v-model.number="formGuests"
              type="number"
              :min="1"
              :max="selectedRemaining"
              class="input input-bordered"
            >
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button class="btn btn-error" @click="deleteBooking">
              Delete
            </button>
            <button class="btn btn-primary" @click="saveBooking">
              Save
            </button>
            <button class="btn" @click="showModal = false">
              Cancel
            </button>
          </div>
        </template>
      </div>
    </div>
  </transition>
  <transition name="modal-fade" />
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
