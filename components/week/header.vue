<script setup>
import Datepicker from "@vuepic/vue-datepicker";
import "@vuepic/vue-datepicker/dist/main.css";

import { formatRangeTitle, startOfWeek } from "~/utils/date";

const props = defineProps({ weekStart: { type: Date, required: true } });
const emit = defineEmits(["jump", "prev", "next"]);

const show = ref(false);
const jump = ref(null);
const datepickerRef = ref(null);
const headerButtonRef = ref(null);

function handleClickOutside(event) {
  const target = event.target;
  if (!show.value)
    return;

  const getElement = (ref) => {
    if (!ref)
      return null;
    if (ref.$el)
      return ref.$el;
    if (ref instanceof HTMLElement)
      return ref;
    return null;
  };

  const headerButtonEl = getElement(headerButtonRef.value);
  if (headerButtonEl && headerButtonEl.contains(target))
    return;

  const datepickerEl = getElement(datepickerRef.value);
  if (datepickerEl && datepickerEl.contains(target))
    return;

  let element = target;
  while (element && element !== document.body) {
    if (element.classList && Array.from(element.classList).some(cls => cls.startsWith("dp__")))
      return;
    if (datepickerEl && element === datepickerEl)
      return;
    element = element.parentElement;
  }

  show.value = false;
}

const rangeTitle = computed(() => formatRangeTitle(props.weekStart));
const isMobile = ref(false);

function checkMobile() {
  isMobile.value = window.innerWidth < 640;
}

onMounted(() => {
  const element = document.querySelector("[data-week-header]");
  if (element) {
    element.addEventListener("close-datepicker", () => {
      show.value = false;
    });
  }

  checkMobile();
  window.addEventListener("resize", checkMobile);

  watch(show, (isOpen) => {
    if (isOpen) {
      setTimeout(() => {
        document.addEventListener("mousedown", handleClickOutside);
        document.addEventListener("click", handleClickOutside);
      }, 0);
    }
    else {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("click", handleClickOutside);
    }
  });
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleClickOutside);
  document.removeEventListener("click", handleClickOutside);
  window.removeEventListener("resize", checkMobile);
});

function jumpTo() {
  if (!jump.value)
    return;
  const d = startOfWeek(new Date(jump.value));
  emit("jump", d);
  show.value = false;
}
</script>

<template>
  <div
    class="flex items-center justify-between mb-4 md:mb-10 gap-2 md:gap-3 px-2 md:px-0"
    data-week-header
  >
    <Button
      :label="isMobile ? undefined : 'Предыдущая'"
      icon="pi pi-chevron-left"
      outlined
      size="small"
      class="flex-shrink-0"
      @click="$emit('prev')"
    />

    <div class="relative flex-1 min-w-0">
      <Button
        ref="headerButtonRef"
        :label="rangeTitle"
        icon="pi pi-calendar"
        size="small"
        class="font-semibold text-sm md:text-base w-full"
        @click="show = true"
      />

      <Card
        v-if="show"
        ref="datepickerRef"
        class="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-[1500] w-64 sm:w-80"
        @click.stop
      >
        <template #content>
          <Datepicker
            v-model="jump"
            locale="ru"
            :calendar-only="true"
            calendar-class="bg-white rounded shadow-lg p-2"
            input-class="hidden"
            format="dd.MM.yyyy"
            :auto-apply="true"
            :close-on-auto-apply="true"
          />
          <div class="flex justify-end mt-3 gap-2">
            <Button
              label="Перейти"
              icon="pi pi-check"
              size="small"
              @click="jumpTo"
            />
            <Button
              label="Отмена"
              icon="pi pi-times"
              outlined
              severity="secondary"
              size="small"
              @click="show = false"
            />
          </div>
        </template>
      </Card>
    </div>

    <Button
      :label="isMobile ? undefined : 'Следующая'"
      icon="pi pi-chevron-right"
      icon-pos="right"
      outlined
      size="small"
      class="flex-shrink-0"
      @click="$emit('next')"
    />
  </div>
</template>
