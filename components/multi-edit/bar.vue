<script setup>
import { useAuthStore } from "@/stores/auth";
import { useScheduleStore } from "@/stores/schedule";

const emit = defineEmits(["open"]);

const s = useScheduleStore();
const auth = useAuthStore();
const count = computed(() => s.selectedPairs.length);
const isAdmin = computed(() => auth.role === "admin");

function clear() {
  s.clearSelection();
}

function startSelectMode() {
  s.setSelectMode(true);
}
</script>

<template>
  <Card
    v-if="isAdmin"
    class="fixed bottom-4 right-4 z-50"
  >
    <template #content>
      <div
        v-if="!s.selectMode"
        class="flex justify-center items-center gap-2"
      >
        <Button
          label="Множественный выбор"
          icon="pi pi-check-square"
          size="small"
          @click="startSelectMode"
        />
      </div>
      <div
        v-else
        class="flex justify-center items-center gap-2"
      >
        <Tag
          v-if="count > 0"
          :value="`${count} выбрано`"
          severity="info"
          class="flex items-center"
          style="height: 2rem;"
        />
        <Button
          v-if="count > 0"
          label="Редактировать выбранные"
          icon="pi pi-pencil"
          size="small"
          @click="emit('open')"
        />
        <Button
          label="Отмена"
          icon="pi pi-times"
          outlined
          severity="secondary"
          size="small"
          @click="clear"
        />
      </div>
    </template>
  </Card>
</template>
