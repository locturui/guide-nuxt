<script setup lang="ts">
useHead({
  title: "404 - Страница не найдена",
  meta: [
    { name: "description", content: "Страница не найдена" },
  ],
});

function goHome() {
  navigateTo("/");
}

function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  }
  else {
    navigateTo("/");
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-ground">
    <div class="text-center">
      <div class="mb-8">
        <h1 class="text-9xl font-bold text-primary">
          404
        </h1>
        <h2 class="text-3xl font-semibold text-surface-900 mt-4">
          Страница не найдена
        </h2>
        <p class="text-lg text-surface-600 mt-2">
          К сожалению, запрашиваемая страница не существует или была перемещена.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Button
          label="Вернуться на главную"
          icon="pi pi-home"
          size="large"
          class="w-full sm:w-auto"
          @click="goHome"
        />

        <Button
          label="Назад"
          icon="pi pi-arrow-left"
          outlined
          severity="secondary"
          size="large"
          class="w-full sm:w-auto"
          @click="goBack"
        />
      </div>

      <div class="mt-12 text-sm text-surface-500">
        <p>Если вы считаете, что это ошибка, обратитесь к администратору.</p>
      </div>
    </div>
  </div>
</template>
