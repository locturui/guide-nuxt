<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  buttonLabel: string;
  buttonIcon?: string;
  loading: boolean;
  disabled: boolean;
  error: string;
  success: boolean;
  successMessage: string;
}>();

defineEmits<{
  (e: "export"): void;
}>();
</script>

<template>
  <Card>
    <template #title>
      <span class="text-xl font-semibold">{{ title }}</span>
    </template>
    <template #content>
      <div class="space-y-4">
        <p class="text-sm text-surface-600">
          {{ description }}
        </p>
        <slot />
        <div class="flex items-center gap-3">
          <Button
            :label="buttonLabel"
            :icon="buttonIcon"
            :loading="loading"
            :disabled="disabled"
            @click="$emit('export')"
          />
          <Message
            v-if="success"
            severity="success"
            class="m-0"
          >
            {{ successMessage }}
          </Message>
          <Message
            v-if="error"
            severity="error"
            class="m-0"
          >
            {{ error }}
          </Message>
        </div>
      </div>
    </template>
  </Card>
</template>
