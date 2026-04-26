<script setup lang="ts">
const props = defineProps<{
  modelValue: string;
  options: { label: string; value: string }[];
  placeholder?: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const search = ref("");

const filteredOptions = computed(() => {
  const q = search.value.trim().toLowerCase();
  if (!q)
    return props.options;
  return props.options.filter(o => o.label.toLowerCase().includes(q));
});
</script>

<template>
  <Select
    :model-value="modelValue"
    :options="filteredOptions"
    option-label="label"
    option-value="value"
    :placeholder="placeholder ?? 'Выберите гида'"
    class="w-full"
    show-clear
    @update:model-value="emit('update:modelValue', $event)"
    @hide="search = ''"
  >
    <template #header>
      <div class="p-3">
        <div class="relative w-full">
          <InputText
            v-model="search"
            placeholder="Поиск"
            class="w-full pr-10"
            autocomplete="off"
          />
          <span
            v-if="search"
            class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer select-none"
            role="button"
            tabindex="0"
            @click.stop="search = ''"
            @keydown.enter.stop="search = ''"
          >
            <span class="pi pi-times text-surface-500" />
          </span>
        </div>
      </div>
    </template>
  </Select>
</template>
