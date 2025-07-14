<script setup lang="ts">
// const authStore = useAuthStore();
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
        <!-- <AuthButton v-if="!authStore.user" /> -->
        <NuxtLink
          to="/bookings"
          class="btn btn-primary"
        >
          К расписанию
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
