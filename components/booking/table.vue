<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { useGuestListsStore } from "~/stores/guest-lists";
import { useScheduleStore } from "~/stores/schedule";
import { formattedDate, startOfWeek } from "~/utils/date";

const role = useAuthStore().role as unknown as "admin" | "agency";
const s = useScheduleStore();
const gl = useGuestListsStore();

onMounted(async () => {
  await s.setWeekStart(new Date());
  const initialBookings = s.allBookings;
  if (initialBookings.length) {
    const bookingsWithGuestLists = initialBookings.filter(b => b.status === "filled" || b.status === "assigned");
    if (bookingsWithGuestLists.length) {
      await Promise.all(bookingsWithGuestLists.map(b => gl.fetchByBooking(b.id)));
    }
  }
  watch(
    () => s.timeSlots,
    async () => {
      const bookings = s.allBookings;
      if (bookings.length) {
        const bookingsWithGuestLists = bookings.filter(b => b.status === "filled" || b.status === "assigned");
        if (bookingsWithGuestLists.length) {
          await Promise.all(bookingsWithGuestLists.map(b => gl.fetchByBooking(b.id)));
        }
      }
    },
    { deep: true },
  );
});

const days = computed<Date[]>(() => {
  const arr: Date[] = [];
  const start = startOfWeek(s.weekStart);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    arr.push(d);
  }
  return arr;
});

function prevWeek(): void {
  s.setWeekStart(new Date(s.weekStart.getTime() - 7 * 86400000));
}
function nextWeek(): void {
  s.setWeekStart(new Date(s.weekStart.getTime() + 7 * 86400000));
}
function jumpWeek(d: Date): void {
  s.setWeekStart(d);
}

const dayDropdown = ref<string | null>(null);
const viewMode = ref<"grid" | "timeline">("grid");
const fmt = (d: Date): string => formattedDate(d);

function forceGridOnDesktop() {
  if (window.innerWidth >= 768) {
    viewMode.value = "grid";
  }
}

function toggleDay(d: Date): void {
  const key = fmt(d);
  dayDropdown.value = dayDropdown.value === key ? null : key;
}

async function confirmDay(
  dateStr: string,
  payload: { category: string; limit?: number },
): Promise<void> {
  await s.setDayCategory(dateStr, payload);
  dayDropdown.value = null;
}

type BookingEdit = { id: number; date: string; time: string; guests: number; agentId?: string | number };

const showBooking = ref<boolean>(false);
const editingBooking = ref<BookingEdit | null>(null);
const initialSlot = ref<{ date?: string; time?: string }>({});

const showMulti = ref<boolean>(false);

function closeMulti(): void {
  showMulti.value = false;
  s.clearSelection();
}

const limitModal = ref<{ date: string; time: string; limit: number } | null>(null);

watch([showBooking, showMulti, limitModal], () => {
  const weekHeader = document.querySelector("[data-week-header]");
  if (weekHeader) {
    const event = new CustomEvent("close-datepicker");
    weekHeader.dispatchEvent(event);
  }
});

async function resolveSlotLimit(date: string, time: string): Promise<number> {
  const fromWeek = s.slotMap[date]?.[time]?.limit;
  if (typeof fromWeek === "number")
    return fromWeek;

  await s.fetchSlotData(date, time);
  const cached = s.extraSlotData?.[`${date}|${time}`]?.limit as number | undefined;
  return typeof cached === "number" ? cached : 0;
}

async function openCreate({ date, time }: { date: string; time: string }) {
  if (role === "admin") {
    const limit = await resolveSlotLimit(date, time);
    limitModal.value = { date, time, limit };
    return;
  }
  const today = formattedDate(new Date());
  if (date === today) {
    const now = new Date();
    const [h, m] = time.split(":").map(Number);
    const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (slot > now) {
      await navigateTo(`/booking/immediate?date=${date}&time=${time}`);
      return;
    }
  }
  editingBooking.value = null;
  initialSlot.value = { date, time };
  showBooking.value = true;
}

async function openEdit(b: { id: number; date: string; time: string; guests: number; agentId?: string | number }) {
  await navigateTo(`/booking/${b.id}/edit`);
}

function closeBooking(): void {
  showBooking.value = false;
  editingBooking.value = null;
}
const stickyTop = ref(0);
const headerRef = ref<HTMLElement | null>(null);
const sentinelRef = ref<HTMLElement | null>(null);
const showFloating = ref(false);
const scrollerRef = ref<HTMLElement | null>(null);
const floatLeft = ref(0);
const floatWidth = ref(0);
const floatTranslateX = ref(0);
const floatingRef = ref<HTMLElement | null>(null);

function onFloatingWheel(e: WheelEvent) {
  const el = scrollerRef.value;
  if (!el)
    return;
  const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
  el.scrollLeft += dx;
}

function updateFloating() {
  const s = sentinelRef.value;
  if (!s) {
    return;
  }
  showFloating.value = s.getBoundingClientRect().top <= stickyTop.value;
}

function updateFloatingLayout() {
  const el = scrollerRef.value;
  if (!el) {
    return;
  }
  const rect = el.getBoundingClientRect();
  floatLeft.value = rect.left;
  floatWidth.value = rect.width;
  floatTranslateX.value = -el.scrollLeft;
}

onMounted(() => {
  stickyTop.value = 10;
  forceGridOnDesktop();

  window.addEventListener("scroll", updateFloating, { passive: true });
  window.addEventListener("resize", () => {
    forceGridOnDesktop();
    updateFloating();
    updateFloatingLayout();
  });

  scrollerRef.value?.addEventListener("scroll", updateFloatingLayout, { passive: true });

  requestAnimationFrame(() => {
    updateFloating();
    updateFloatingLayout();
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateFloating);
  window.removeEventListener("resize", () => {});
  scrollerRef.value?.removeEventListener("scroll", updateFloatingLayout);
});

watch(stickyTop, () => requestAnimationFrame(updateFloating));

watch(viewMode, () => {
  forceGridOnDesktop();
});
</script>

<template>
  <div
    class="p-4 w-full px-4 sm:px-6 md:px-10 lg:px-15 pt-4 md:pt-5"
    :style="{ '--tg-sticky-top': `${stickyTop}px` }"
  >
    <div ref="headerRef">
      <WeekHeader
        :week-start="s.weekStart"
        @prev="prevWeek"
        @next="nextWeek"
        @jump="jumpWeek"
      />
      <div class="flex items-center gap-3 mt-3 mb-4 md:hidden">
        <button
          class="btn btn-sm md:btn-md"
          :class="viewMode === 'grid' ? 'btn-primary' : ''"
          @click="viewMode = 'grid'"
        >
          Сетка
        </button>
        <button
          class="btn btn-sm md:btn-md"
          :class="viewMode === 'timeline' ? 'btn-primary' : ''"
          @click="viewMode = 'timeline'"
        >
          Таймлайн
        </button>
      </div>

      <div v-if="s.loading" class="flex justify-center items-center py-20">
        <span class="loading loading-spinner loading-lg" />
      </div>

      <div ref="sentinelRef" style="height:0; margin:0; padding:0;" />

      <div
        v-if="viewMode === 'grid'"
        ref="scrollerRef"
        class="w-full overflow-x-auto"
      >
        <TimeGrid
          v-if="!s.loading"
          :days="days"
          :times="s.allTimes"
          :role="role"
          :ghost-headers="showFloating"
          @toggle-day="toggleDay"
          @select-slot="openCreate"
          @select-booking="openEdit"
        >
          <template #day-dropdown="{ date }">
            <transition name="modal-fade">
              <div v-if="role === 'admin' && dayDropdown === fmt(date)">
                <DayCategoryDropdown
                  :date-str="fmt(date)"
                  :model-value="dayDropdown"
                  @confirm="p => confirmDay(fmt(date), p)"
                  @cancel="dayDropdown = null"
                />
              </div>
            </transition>
          </template>
        </TimeGrid>
      </div>

      <BookingTimeline
        v-else
        :days="days"
        :times="s.allTimes"
        :role="role"
        @toggle-day="toggleDay"
        @select-slot="openCreate"
        @select-booking="openEdit"
      />
    </div>

    <MultiEditBar @open="showMulti = true" />

    <BookingModal
      v-if="showBooking"
      :role="role"
      :booking="editingBooking"
      :initial-date="initialSlot.date"
      :initial-time="initialSlot.time"
      @close="closeBooking"
    />

    <MultiEditModal
      v-if="showMulti"
      :pairs="s.selectedPairs"
      @close="closeMulti"
    />
    <SlotLimitModal
      v-if="limitModal"
      :date="limitModal.date"
      :time="limitModal.time"
      :initial-limit="limitModal.limit"
      @close="() => (limitModal = null)"
    />

    <teleport to="body">
      <div
        v-show="viewMode === 'grid' && showFloating"
        ref="floatingRef"
        class="fixed z-[400] bg-white pt-2 pb-1 shadow-sm border-b border-gray-200"
        :style="{ top: `0px`, left: `${floatLeft}px`, width: `${floatWidth}px` }"
        @wheel.prevent="onFloatingWheel"
      >
        <div class="px-4 sm:px-6 md:px-10 lg:px-15">
          <div
            class="grid w-full gap-0"
            style="grid-template-columns:32px repeat(7, minmax(120px, 1fr));"
            :style="{ transform: `translateX(${floatTranslateX}px)` }"
          >
            <div />

            <div v-for="d in days" :key="`float-${d.toISOString()}`">
              <DayHeader
                :date="d"
                :role="role"
                @toggle="toggleDay(d)"
              >
                <div class="relative">
                  <transition name="modal-fade">
                    <div
                      v-if="role === 'admin' && dayDropdown === fmt(d)"
                      class="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[1000]"
                      style="pointer-events:auto"
                    >
                      <DayCategoryDropdown
                        :date-str="fmt(d)"
                        :model-value="dayDropdown"
                        @confirm="p => confirmDay(fmt(d), p)"
                        @cancel="dayDropdown = null"
                      />
                    </div>
                  </transition>
                </div>
              </DayHeader>
            </div>
          </div>
        </div>
      </div>
    </teleport>
  </div>
</template>
