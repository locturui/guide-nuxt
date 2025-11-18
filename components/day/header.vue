<script setup>
const props = defineProps({
  date: { type: Date, required: true },
  role: { type: String, required: true },
});

const emit = defineEmits(["toggle"]);

const label = computed(() =>
  props.date
    .toLocaleDateString("ru", { weekday: "short", day: "numeric", month: "short" })
    .replace(/^./, c => c.toUpperCase()),
);
</script>

<template>
  <div class="text-center font-medium relative" data-day-header>
    <Button
      v-if="role === 'admin'"
      :label="label"
      text
      size="small"
      class="mb-2 font-medium text-green-600"
      @click="emit('toggle')"
    />
    <div
      v-else
      class="text-surface-700"
    >
      {{ label }}
    </div>
    <slot />
  </div>
</template>
