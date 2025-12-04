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
const dayDropdownRef = ref<HTMLElement | null>(null);
const isMobile = ref(false);
const viewMode = ref<"grid" | "timeline">("grid");
const fmt = (d: Date): string => formattedDate(d);

function checkMobile() {
  isMobile.value = window.innerWidth < 768;
  if (isMobile.value) {
    viewMode.value = "timeline";
  }
  else {
    viewMode.value = "grid";
  }
}

function forceGridOnDesktop() {
  if (window.innerWidth >= 768) {
    viewMode.value = "grid";
  }
  else {
    viewMode.value = "timeline";
  }
}

function toggleDay(d: Date): void {
  const key = fmt(d);
  dayDropdown.value = dayDropdown.value === key ? null : key;
}

function handleDayDropdownClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement;
  if (!dayDropdown.value)
    return;

  const clickedDayHeader = target.closest("[data-day-header]");
  if (clickedDayHeader)
    return;

  const dropdownCard = target.closest(".p-card");
  if (dropdownCard) {
    const hasDropdown = dropdownCard.querySelector(".p-dropdown");
    if (hasDropdown)
      return;
  }

  dayDropdown.value = null;
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
  const now = new Date();
  const todayStr = formattedDate(now);
  if (date === todayStr) {
    const [h, m] = time.split(":").map(Number);
    const slot = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    if (slot > now) {
      await navigateTo(`/booking/immediate?date=${date}&time=${time}`);
      return;
    }
  }
  const wanted = new Date(`${date}T00:00:00`);
  const prev = new Date(wanted);
  prev.setDate(prev.getDate() - 1);
  const cutoff = new Date(prev.getFullYear(), prev.getMonth(), prev.getDate(), 20, 0, 0, 0);
  if (now >= cutoff) {
    await navigateTo(`/booking/immediate?date=${date}&time=${time}`);
    return;
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
  if (!s)
    return;
  showFloating.value = s.getBoundingClientRect().top <= stickyTop.value;
  if (!showFloating.value) {
    floatLeft.value = 0;
    floatWidth.value = 0;
    floatTranslateX.value = 0;
    return;
  }
  const el = scrollerRef.value;
  if (!el)
    return;
  const rect2 = el.getBoundingClientRect();
  floatLeft.value = rect2.left;
  floatWidth.value = rect2.width;
  floatTranslateX.value = -el.scrollLeft;
}

function updateFloatingLayout() {
  const el = scrollerRef.value;
  if (!el)
    return;
  const rect = el.getBoundingClientRect();
  floatLeft.value = rect.left;
  floatWidth.value = rect.width;
  floatTranslateX.value = -el.scrollLeft;
}

function calculateStickyTop() {
  const weekHeader = document.querySelector("[data-week-header]");
  if (weekHeader) {
    const weekHeaderRect = weekHeader.getBoundingClientRect();
    stickyTop.value = weekHeaderRect.height;
  }
  else if (headerRef.value) {
    const rect = headerRef.value.getBoundingClientRect();
    stickyTop.value = rect.height;
  }
  else {
    stickyTop.value = 100;
  }
}

watch(dayDropdown, (isOpen) => {
  if (isOpen) {
    setTimeout(() => {
      document.addEventListener("click", handleDayDropdownClickOutside);
    }, 0);
  }
  else {
    document.removeEventListener("click", handleDayDropdownClickOutside);
  }
});

onMounted(() => {
  checkMobile();
  forceGridOnDesktop();

  const recalculate = () => {
    requestAnimationFrame(() => {
      calculateStickyTop();
      updateFloating();
      updateFloatingLayout();
    });
  };

  nextTick(() => {
    recalculate();
  });

  window.addEventListener("scroll", updateFloating, { passive: true });
  window.addEventListener("resize", () => {
    checkMobile();
    forceGridOnDesktop();
    recalculate();
  });

  scrollerRef.value?.addEventListener("scroll", updateFloatingLayout, { passive: true });

  nextTick(() => {
    const weekHeader = document.querySelector("[data-week-header]");
    if (weekHeader) {
      const resizeObserver = new ResizeObserver(() => {
        recalculate();
      });
      resizeObserver.observe(weekHeader);

      onBeforeUnmount(() => {
        resizeObserver.disconnect();
      });
    }
    else if (headerRef.value) {
      const resizeObserver = new ResizeObserver(() => {
        recalculate();
      });
      resizeObserver.observe(headerRef.value);

      onBeforeUnmount(() => {
        resizeObserver.disconnect();
      });
    }
  });

  setTimeout(() => {
    recalculate();
  }, 200);

  setTimeout(() => {
    recalculate();
  }, 500);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      recalculate();
    });
  });
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", updateFloating);
  window.removeEventListener("resize", () => {});
  scrollerRef.value?.removeEventListener("scroll", updateFloatingLayout);
  document.removeEventListener("click", handleDayDropdownClickOutside);
});

watch(stickyTop, () => requestAnimationFrame(updateFloating));

watch(viewMode, () => {
  forceGridOnDesktop();
});
</script>

<template>
  <div
    class="w-full px-2 py-2 sm:px-4 sm:py-4 md:px-10 md:py-5 lg:px-15"
    :style="{ '--tg-sticky-top': `${stickyTop}px` }"
  >
    <div ref="headerRef">
      <WeekHeader
        :week-start="s.weekStart"
        @prev="prevWeek"
        @next="nextWeek"
        @jump="jumpWeek"
      />

      <div
        v-if="s.loading"
        class="flex justify-center items-center py-20"
      >
        <ProgressSpinner />
      </div>

      <div ref="sentinelRef" style="height:0; margin:0; padding:0;" />

      <div
        v-if="viewMode === 'grid' && !isMobile"
        class="w-full"
      >
        <div
          v-if="!s.loading"
          class="grid w-full gap-2 mb-2"
          :class="[
            showFloating ? 'invisible pointer-events-none' : '',
            role === 'admin' ? '' : 'py-3',
          ]"
          :style="{
            gridTemplateColumns: '32px repeat(7, minmax(120px, 1fr))',
            position: 'sticky',
            top: '0px',
            zIndex: 50,
            background: 'white',
          }"
        >
          <div />

          <div
            v-for="d in days"
            :key="d.toISOString()"
          >
            <DayHeader
              :date="d"
              :role="role"
              @toggle="toggleDay(d)"
            >
              <div
                v-if="!showFloating"
                class="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-[1000]"
                style="pointer-events:auto"
              >
                <transition name="modal-fade">
                  <div
                    v-if="role === 'admin' && dayDropdown === fmt(d)"
                    ref="dayDropdownRef"
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

        <div
          ref="scrollerRef"
          class="w-full overflow-x-auto"
          style="padding: 8px; margin: -8px;"
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
          />
        </div>
      </div>

      <BookingTimeline
        v-if="!s.loading && (viewMode === 'timeline' || isMobile)"
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
        v-show="viewMode === 'grid' && showFloating && !isMobile"
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
                      ref="dayDropdownRef"
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
