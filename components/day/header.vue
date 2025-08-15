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
  <div class="text-center font-medium relative">
    <div
      v-if="role === 'admin'"
      class="inline-block mb-2 cursor-pointer px-2 py-1 rounded-md shadow-[2px_2px_6px_#00000025] hover:shadow-[3px_3px_8px_#00000035] transition-shadow bg-white"
      @click="emit('toggle')"
    >
      {{ label }}
    </div>
    <div v-else>
      {{ label }}
    </div>
    <slot />
  </div>
</template>
