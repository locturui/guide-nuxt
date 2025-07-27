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
  <div class="absolute left-1/2 -translate-x-1/2 mt-2 bg-base-200 p-2 rounded shadow z-20 w-40 space-y-2">
    <div>
      <label><input
        v-model="category"
        type="radio"
        value="Open"
      > Open</label>
    </div>
    <div>
      <label><input
        v-model="category"
        type="radio"
        value="Closed"
      > Closed</label>
    </div>
    <div>
      <label>
        <input
          v-model="category"
          type="radio"
          value="Limited"
        >
        Limited
      </label>
      <input
        v-if="category === 'Limited'"
        v-model.number="limit"
        type="number"
        class="input input-sm input-bordered ml-2 w-16"
        placeholder="Limit"
      >
    </div>
    <div class="flex justify-end gap-1 pt-1">
      <button
        class="btn btn-xs btn-primary"
        :disabled="!category || (category === 'Limited' && limit <= 0)"
        @click="emits('confirm', { category, limit })"
      >
        Confirm
      </button>
      <button class="btn btn-xs" @click="emits('cancel')">
        Cancel
      </button>
    </div>
  </div>
</template>
