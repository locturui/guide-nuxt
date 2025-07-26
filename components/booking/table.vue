<script setup>
const agents = [{ id: 101, name: "Agent A" }, { id: 102, name: "Agent B" }];
const allBookings = ref([
  { id: 1, date: "2025-07-14", time: "09:00", guests: 5, agentId: 101 },
  { id: 2, date: "2025-07-14", time: "09:00", guests: 10, agentId: 102 },
]);

const currentAgentId = ref(101);
const isAdmin = ref(false);
const jumpToDate = ref("");
const showDateInput = ref(false);

const showModal = ref(false);
const formDate = ref("");
const formTime = ref("");
const formGuests = ref(1);
const formAgentId = ref(currentAgentId.value);
const editingId = ref(null);

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

  const end = new Date();
  end.setDate(d.getDate() + 6);
  const endYyyy = end.getFullYear();
  const endMm = String(end.getMonth() + 1).padStart(2, "0");
  const endDd = String(end.getDate()).padStart(2, "0");

  return `${dd}.${mm}.${yyyy} - ${endDd}.${endMm}.${endYyyy}`;
}

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
  return allBookings.value
    .filter(b => b.date === formatISODate(date) && b.time === time)
    .map(b => ({
      id: b.id,
      agentName: agents.find(a => a.id === b.agentId)?.name || "",
      guests: b.guests,
    }));
}
function remainingCapacity(date, time) {
  const sum = allBookings.value
    .filter(b => b.date === formatISODate(date) && b.time === time)
    .reduce((s, b) => s + b.guests, 0);
  return 51 - sum;
}

const selectedRemaining = computed(() => {
  if (!formDate.value || !formTime.value)
    return 0;
  const base = remainingCapacity(new Date(formDate.value), formTime.value);
  const prev = editingId.value ? allBookings.value.find(b => b.id === editingId.value)?.guests || 0 : 0;
  return base + prev;
});

function onSelectSlot(start) {
  formDate.value = formatISODate(start);
  formTime.value = start.toTimeString().slice(0, 5);
  formGuests.value = 1;
  formAgentId.value = currentAgentId.value;
  editingId.value = null;
  showModal.value = true;
}
function onSelectBooking(b) {
  formDate.value = b.date;
  formTime.value = b.time;
  formGuests.value = b.guests;
  formAgentId.value = agents.find(a => a.name === b.agentName)?.id || currentAgentId.value;
  editingId.value = b.id;
  showModal.value = true;
}

function save() {
  if (formGuests.value > selectedRemaining.value)
    return;
  const booking = {
    id: editingId.value || Date.now(),
    date: formDate.value,
    time: formTime.value,
    guests: formGuests.value,
    agentId: formAgentId.value,
  };
  if (editingId.value) {
    const i = allBookings.value.findIndex(b => b.id === editingId.value);
    allBookings.value[i] = booking;
  }
  else {
    allBookings.value.push(booking);
  }
  showModal.value = false;
}

onMounted(() => {
  weekStart.value = startOfWeek(new Date());
});
const hours = Array.from({ length: 12 }, (_, i) => i + 9)
  .flatMap(h => [`${String(h).padStart(2, "0")}:00`, `${String(h).padStart(2, "0")}:30`]);
</script>

<template>
  <div class="p-4 w-full overflow-x-auto">
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
        class="text-center font-medium"
      >
        {{ d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }) }}
      </div>
      <template v-for="time in hours" :key="time">
        <div class="text-right pr-2 text-xs text-gray-500">
          {{ time }}
        </div>
        <div v-for="d in weekDays" :key="d + time">
          <BookingSlot
            :start="parseSlotDate(d, time)"
            :end="new Date(parseSlotDate(d, time).getTime() + 30 * 60000)"
            :left="remainingCapacity(d, time)"
            :bookings="bookingsForSlot(d, time)"
            @select-slot="onSelectSlot"
            @select-booking="onSelectBooking"
          />
        </div>
      </template>
    </div>
  </div>

  <div v-if="showModal" class="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-gray-500 p-6 rounded-lg w-80">
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
      <div v-if="isAdmin" class="form-control mb-2">
        <label class="label"><span class="label-text">Agent</span></label>
        <select v-model="formAgentId" class="select select-bordered">
          <option
            v-for="a in agents"
            :key="a.id"
            :value="a.id"
          >
            {{ a.name }}
          </option>
        </select>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button class="btn btn-primary" @click="save">
          Save
        </button>
        <button class="btn" @click="showModal = false">
          Cancel
        </button>
      </div>
    </div>
  </div>
</template>
