<script setup lang="ts">
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { useGuestListsStore } from "@/stores/guest-lists";
import { useScheduleStore } from "@/stores/schedule";
import { isHalfHour, roundToHalfHour } from "~/utils/time";

const props = defineProps<{
  role: "admin" | "agency";
  booking?: { id: number; date: string; time: string; guests: number; agentId?: string | number } | null;
  initialDate?: string;
  initialTime?: string;
}>();
const emit = defineEmits<{
  (e: "close"): void;
  (e: "update", data: { date: string; time: string; guests: number }): void;
}>();

const router = useRouter();

const s = useScheduleStore();
const gl = useGuestListsStore();

const editing = computed(() => !!props.booking);
const pending = ref(false);
const hasGuestList = computed(() => props.booking?.id ? gl.hasGuestList(props.booking.id) : false);

const isAssigned = computed(() => {
  if (!props.booking?.id)
    return false;
  const booking = s.allBookings.find(b => b.id === props.booking?.id);
  return booking?.status === "assigned";
});

onMounted(() => {
  document.body.style.overflow = "hidden";
});

onUnmounted(() => {
  document.body.style.overflow = "";
});

const formDate = ref<string>(props.booking?.date ?? props.initialDate ?? "");
const formTime = ref<string>(props.booking?.time ?? props.initialTime ?? "");
const formGuests = ref<number>(props.booking?.guests ?? 1);

watch([formDate, formTime], async ([d, t]) => {
  if (props.role !== "admin")
    return;
  if (!d || !t)
    return;
  await s.fetchSlotData(d, t);
});

watch(formTime, (v) => {
  if (!v)
    return;
  if (!isHalfHour(v))
    formTime.value = roundToHalfHour(v);
});

const baseLeft = computed(() =>
  formDate.value && formTime.value ? s.remainingCapacity(formDate.value, formTime.value) : 0,
);

const maxLeft = computed(() => {
  if (!editing.value)
    return baseLeft.value;
  const same
    = props.booking && props.booking.date === formDate.value && props.booking.time === formTime.value;
  return same ? baseLeft.value + (props.booking?.guests || 0) : baseLeft.value;
});

const showGuestWarning = computed(() => {
  return props.role === "agency" && formGuests.value > maxLeft.value;
});

async function onSave() {
  if (pending.value)
    return;
  if (!formDate.value || !formTime.value || formGuests.value < 1)
    return;
  if (formGuests.value > maxLeft.value)
    return;

  pending.value = true;
  try {
    if (!editing.value) {
      await s.book(formDate.value, formTime.value, formGuests.value);
      emit("close");
    }
    else if (props.role === "admin") {
      await s.adminModifyBooking({
        bookingId: String(props.booking!.id),
        date: formDate.value,
        time: formTime.value,
        people: formGuests.value,
      });
      await s.fetchWeek();
      emit("update", {
        date: formDate.value,
        time: formTime.value,
        guests: formGuests.value,
      });
    }
    else {
      await s.modifyBooking(String(props.booking!.id), formGuests.value);
      await s.fetchWeek();
      emit("update", {
        date: formDate.value,
        time: formTime.value,
        guests: formGuests.value,
      });
    }
  }
  finally {
    pending.value = false;
  }
}

async function onDelete() {
  if (pending.value)
    return;
  if (!editing.value)
    return;

  pending.value = true;
  try {
    if (props.role === "admin")
      await s.adminCancelBooking(String(props.booking!.id));
    else await s.cancelBooking(String(props.booking!.id));
    emit("close");
  }
  finally {
    pending.value = false;
  }
}

function onEditBooking() {
  if (props.booking?.id) {
    router.push(`/booking/${props.booking.id}/edit`);
    emit("close");
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-60 p-4" @click="$emit('close')">
    <Card
      class="w-full max-w-sm relative"
      @click.stop
    >
      <template #header>
        <div class="flex items-center justify-between p-4 pb-2">
          <h3 class="text-lg font-semibold m-0">
            {{ editing ? 'Бронирование' : 'Новое бронирование' }}
          </h3>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="$emit('close')"
          />
        </div>
      </template>
      <template #content>
        <template v-if="!editing">
          <div class="flex flex-col gap-2 mb-4">
            <label class="text-sm font-medium text-surface-700">Дата</label>
            <Datepicker
              v-model="formDate"
              locale="ru"
              model-type="yyyy-MM-dd"
              :auto-apply="true"
              :teleport="true"
              :ui="{ input: 'p-inputtext w-full' }"
              :disabled="pending"
              :enable-time-picker="false"
              :close-on-auto-apply="true"
            />
          </div>

          <div class="flex flex-col gap-2 mb-4">
            <label class="text-sm font-medium text-surface-700">Время</label>
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
              :disabled="pending"
              :close-on-auto-apply="true"
            />
          </div>

          <div class="flex flex-col gap-2 mb-4">
            <label class="text-sm font-medium text-surface-700">Количество гостей (макс. {{ maxLeft }})</label>
            <InputNumber
              v-model="formGuests"
              :min="0"
              :max="maxLeft"
              :disabled="pending"
              show-buttons
              class="w-full"
            />
            <Message
              v-if="showGuestWarning"
              severity="warn"
              class="mt-2"
            >
              Количество гостей превышает максимально доступное для данного слота
            </Message>
          </div>
        </template>

        <template v-else>
          <div class="space-y-4">
            <Card>
              <template #content>
                <h4 class="font-semibold mb-2 text-surface-900">
                  Информация о бронировании
                </h4>
                <div class="space-y-2 text-sm text-surface-700">
                  <div><strong>ID:</strong> {{ props.booking?.id }}</div>
                  <div><strong>Дата:</strong> {{ props.booking?.date }}</div>
                  <div><strong>Время:</strong> {{ props.booking?.time }}</div>
                  <div><strong>Гостей:</strong> {{ props.booking?.guests }}</div>
                </div>
              </template>
            </Card>

            <Message
              v-if="role === 'agency' && hasGuestList"
              severity="success"
            >
              Список гостей загружен
            </Message>

            <Message
              v-if="role === 'agency' && isAssigned"
              severity="info"
            >
              Гид назначен
            </Message>
          </div>
        </template>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            v-if="editing"
            label="Удалить"
            icon="pi pi-trash"
            severity="danger"
            size="small"
            :loading="pending"
            :disabled="pending"
            @click="onDelete"
          />
          <Button
            v-if="editing"
            label="Редактировать"
            icon="pi pi-pencil"
            size="small"
            :disabled="pending"
            @click="onEditBooking"
          />
          <Button
            v-if="!editing"
            label="Создать"
            icon="pi pi-check"
            size="small"
            :loading="pending"
            :disabled="pending"
            @click="onSave"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
