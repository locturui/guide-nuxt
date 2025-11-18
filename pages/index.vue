<script setup lang="ts">
const auth = useAuthStore();
if (auth.isAuthenticated) {
  navigateTo("/bookings");
}
</script>

<template>
  <div class="container mx-auto mt-5">
    <Card class="max-w-md mx-auto">
      <template #content>
        <div class="text-center min-h-96 flex flex-col justify-center">
          <h1 class="text-5xl font-bold text-surface-900 mb-6">
            Бронирование слотов
          </h1>
          <p class="py-6 text-surface-700">
            Это приложение позволяет бронировать слоты для экскурсий. Вы можете выбрать дату, время и количество гостей.
            Для начала работы, пожалуйста, войдите в систему.
          </p>
          <Button
            :label="auth.isAuthenticated ? 'Перейти к бронированиям' : 'Войти'"
            icon="pi pi-sign-in"
            class="w-full"
            @click="navigateTo('/bookings')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
