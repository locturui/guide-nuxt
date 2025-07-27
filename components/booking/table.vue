<script setup>
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

async function confirmDayCategory(dateStr) {
  try {
    await useApi("/days/set-day-category", {
      method: "POST",
      body: {
        date: dateStr.split(".").reverse().join("-"),
        category: dayCategoryForm.category,
        ...(dayCategoryForm.category === "Limited" && { limit: dayCategoryForm.limit }),
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
  const start = weekStart.value;
  const dd = String(start.getDate()).padStart(2, "0");
  const mm = String(start.getMonth() + 1).padStart(2, "0");
  const yyyy = start.getFullYear();
  const dateStr = `${dd}.${mm}.${yyyy}`;
  try {
    const result = await useApi(
      role === "admin"
        ? `/week/admin?date=${dateStr}`
        : `/week/agency?date=${dateStr}`,
    );

    apiTimeSlots.value = result.days;
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
    agentName: agents.find(a => a.id === Number(b.agency_id))?.name || b.agency_email || "",
    guests: b.people_count,
  }));
}

const selectedRemaining = computed(() => {
  if (!formDate.value || !formTime.value)
    return 0;
  const base = remainingCapacity(new Date(formDate.value), formTime.value);
  const prev = editingId.value ? allBookings.value.find(b => b.id === editingId.value)?.guests || 0 : 0;
  return base + prev;
});

function onSelectBooking(b) {
  formDate.value = b.date;
  formTime.value = b.time;
  formGuests.value = b.guests;
  formAgentId.value = agents.find(a => a.name === b.agentName)?.id || currentAgentId.value;
  editingId.value = b.id;
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
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
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
</script>

<template>
  <div class="p-4 w-full overflow-x-auto px-15">
    <div class="flex justify-between mb-4">
      <button class="btn btn-sm" @click="prevWeek">
        Previous
      </button>

      <div class="relative">
        <h2
          class="text-lg font-bold cursor-pointer underline"
          @click="showDateInput = true"
        >
          {{ formatDate(weekStart) }}
        </h2>

        <div
          v-if="showDateInput"
          class="absolute top-full left-1/2 -translate-x-1/2 mt-1 bg-base-200 p-2 rounded shadow z-10"
        >
          <input
            v-model="jumpToDate"
            type="date"
            class="input input-sm input-bordered"
          >
          <div class="flex justify-end mt-1 gap-2">
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
          class="cursor-pointer underline"
          @click="toggleDayCategoryDropdown(formattedDate(d))"
        >
          {{ d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}
        </div>
        <div v-else>
          {{ d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}
        </div>

        <div
          v-if="dayCategoryDropdown === formattedDate(d)"
          class="absolute left-1/2 -translate-x-1/2 mt-2 bg-base-200 p-2 rounded shadow z-20 w-40 space-y-2"
        >
          <div>
            <label>
              <input
                v-model="dayCategoryForm.category"
                type="radio"
                value="Open"
              >
              Open
            </label>
          </div>
          <div>
            <label>
              <input
                v-model="dayCategoryForm.category"
                type="radio"
                value="Closed"
              >
              Closed
            </label>
          </div>
          <div>
            <label>
              <input
                v-model="dayCategoryForm.category"
                type="radio"
                value="Limited"
              >
              Limited
            </label>
            <input
              v-if="dayCategoryForm.category === 'Limited'"
              v-model.number="dayCategoryForm.limit"
              type="number"
              class="input input-sm input-bordered ml-2 w-16"
              placeholder="Limit"
            >
          </div>
          <div class="flex justify-end gap-1 pt-1">
            <button class="btn btn-xs btn-primary" @click="confirmDayCategory(formattedDate(d))">
              Confirm
            </button>
            <button class="btn btn-xs" @click="dayCategoryDropdown = null">
              Cancel
            </button>
          </div>
        </div>
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

  <div
    v-if="showModal"
    class="fixed inset-0 flex items-center justify-center z-40"
    style="background-color: rgba(0,0,0,0.5);"
    @click.self="() => { showModal = false; editingSlot = null; }"
  >
    <div class="bg-gray-500 dark:bg-g p-6 rounded-lg w-80 z-50 opacity-100">
      <template v-if="role === 'admin'">
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
          <button class="btn btn-primary" @click="save">
            Save
          </button>
          <button class="btn" @click="showModal = false">
            Cancel
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
