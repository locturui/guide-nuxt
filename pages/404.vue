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
  <div class="min-h-screen flex items-center justify-center bg-base-100">
    <div class="text-center">
      <div class="mb-8">
        <h1 class="text-9xl font-bold text-primary">
          404
        </h1>
        <h2 class="text-3xl font-semibold text-base-content mt-4">
          Страница не найдена
        </h2>
        <p class="text-lg text-base-content/70 mt-2">
          К сожалению, запрашиваемая страница не существует или была перемещена.
        </p>
      </div>

      <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <button
          class="btn btn-primary btn-lg w-full sm:w-auto"
          @click="goHome"
        >
          <Icon name="tabler:home" class="w-5 h-5 mr-2" />
          Вернуться на главную
        </button>

        <button
          class="btn btn-ghost btn-lg w-full sm:w-auto"
          @click="goBack"
        >
          <Icon name="tabler:arrow-left" class="w-5 h-5 mr-2" />
          Назад
        </button>
      </div>

      <div class="mt-12 text-sm text-base-content/50">
        <p>Если вы считаете, что это ошибка, обратитесь к администратору.</p>
      </div>
    </div>
  </div>
</template>
