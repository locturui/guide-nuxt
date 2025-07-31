<script setup>
const props = defineProps({
  dateStr: String,
  modelValue: String,
});
const emits = defineEmits(["update:modelValue", "confirm", "cancel"]);

const category = ref(null);
const limit = ref(0);

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      category.value = null;
      limit.value = 0;
    }
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="absolute left-1/2 -translate-x-1/2 mt-2 bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg w-48 space-y-3 border border-gray-200 dark:border-gray-700 z-60"
  >
    <label
      for="cat-open"
      class="flex items-center cursor-pointer space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 select-none text-gray-800 dark:text-gray-200 font-medium"
    >
      <input
        id="cat-open"
        v-model="category"
        type="radio"
        value="Open"
        class="form-radio text-blue-600 dark:text-blue-400"
      >
      <span>Open</span>
    </label>

    <label
      for="cat-closed"
      class="flex items-center cursor-pointer space-x-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 select-none text-gray-800 dark:text-gray-200 font-medium"
    >
      <input
        id="cat-closed"
        v-model="category"
        type="radio"
        value="Closed"
        class="form-radio text-blue-600 dark:text-blue-400"
      >
      <span>Closed</span>
    </label>

    <div
      class="flex items-center space-x-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 rounded px-2 py-1 select-none text-gray-800 dark:text-gray-200 font-medium"
    >
      <label for="cat-limited" class="flex items-center space-x-2 flex-grow cursor-pointer">
        <input
          id="cat-limited"
          v-model="category"
          type="radio"
          value="Limited"
          class="form-radio text-blue-600 dark:text-blue-400"
        >
        <span>Limited</span>
      </label>
      <input
        v-if="category === 'Limited'"
        v-model.number="limit"
        type="number"
        min="1"
        placeholder="Limit"
        class="input input-sm input-bordered w-20"
        @click.stop
      >
    </div>

    <div class="flex justify-end space-x-2 pt-2">
      <button
        class="btn btn-xs btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        :disabled="!category || (category === 'Limited' && (!limit || limit <= 0))"
        @click="emits('confirm', { category, limit })"
      >
        Confirm
      </button>
      <button class="btn btn-xs btn-outline" @click="emits('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>
