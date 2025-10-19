<script setup lang="ts">
const auth = useAuthStore();

onMounted(() => {
  if (auth.isAuthenticated) {
    navigateTo("/bookings");
  }
});
</script>

<template>
  <div class="hero bg-base-100 container mx-auto mt-5">
    <div class="hero-content text-center min-h-96">
      <div class="max-w-md">
        <h1 class="text-5xl font-bold">
          Бронирование слотов
        </h1>
        <p class="py-6">
          Это приложение позволяет бронировать слоты для экскурсий. Вы можете выбрать дату, время и количество гостей.
          Для начала работы, пожалуйста, войдите в систему.
        </p>
        <NuxtLink
          to="/bookings"
          class="btn btn-primary"
        >
          {{ auth.isAuthenticated ? "Перейти к бронированиям" : "Войти" }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
