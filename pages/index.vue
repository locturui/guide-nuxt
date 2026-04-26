<script setup lang="ts">
const auth = useAuthStore();
if (auth.isAuthenticated) {
  navigateTo("/bookings");
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 relative overflow-hidden">
    <div class="absolute inset-0">
      <div class="absolute top-20 left-10 w-32 h-32 bg-green-200 rounded-full mix-blend-multiply filter blur-lg opacity-30 animate-pulse" />
      <div class="absolute top-40 right-10 w-40 h-40 bg-emerald-200 rounded-full mix-blend-multiply filter blur-lg opacity-20 animate-pulse animation-delay-2000" />
      <div class="absolute bottom-20 left-1/2 w-64 h-64 bg-lime-200 rounded-full mix-blend-multiply filter blur-xl opacity-15" />
    </div>
    <div class="relative z-10 flex items-center justify-center min-h-screen p-4">
      <div class="max-w-md w-full">
        <div class="backdrop-blur-sm bg-white/80 backdrop-saturate-100 border border-green-200/30 rounded-2xl shadow-lg p-8">
          <div class="text-center">
            <div class="mb-8">
              <div class="inline-flex items-center justify-center mb-6">
                <div class="w-20 h-20 bg-gradient-to-br from-green-600 to-emerald-500 rounded-2xl flex items-center justify-center shadow-md">
                  <span class="text-white text-3xl font-bold">TI</span>
                </div>
              </div>
              <h1 class="text-4xl font-light text-gray-800 mb-3 tracking-tight">
                TourBooking Innopolis
              </h1>
              <p class="text-gray-600 text-base">
                Система бронирования экскурсий
                <span class="text-gray-500 text-sm block mt-2 font-mono">
                  tourbooking.innopolis.university
                </span>
              </p>
            </div>
            <div class="backdrop-blur-sm bg-white/60 backdrop-saturate-100 rounded-xl p-6 border border-green-200/20">
              <p class="text-gray-700 mb-6">
                {{
                  auth.isAuthenticated
                    ? 'Перенаправление на страницу бронирований...'
                    : 'Войдите в систему для управления бронированиями'
                }}
              </p>
              <Button
                :label="auth.isAuthenticated ? 'Открыть бронирования' : 'Войти'"
                icon="pi pi-arrow-right"
                class="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 border-0 shadow-md transform transition-all duration-200 hover:scale-105"
                size="large"
                @click="navigateTo('/bookings')"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes pulse {
  0%,
  100% {
    opacity: 0.2;
  }
  50% {
    opacity: 0.3;
  }
}

.animate-pulse {
  animation: pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animation-delay-2000 {
  animation-delay: 2s;
}
</style>
