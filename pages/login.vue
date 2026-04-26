<script setup lang="ts">
const username = ref("");
const password = ref("");
const auth = useAuthStore();

async function handleSubmit() {
  await auth.login(username.value, password.value);
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
          <h2 class="text-2xl font-bold text-center text-gray-800 mb-6">
            Войти
          </h2>
          <form
            class="space-y-4"
            @submit.prevent="handleSubmit"
          >
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-gray-700">Логин</label>
              <InputText
                v-model="username"
                type="text"
                class="w-full"
                required
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-semibold text-gray-700">Пароль</label>
              <InputText
                v-model="password"
                type="password"
                class="w-full"
                required
              />
            </div>
            <Button
              type="submit"
              label="Войти"
              icon="pi pi-sign-in"
              class="w-full bg-gradient-to-r from-green-600 to-emerald-500 hover:from-green-700 hover:to-emerald-600 border-0 shadow-md transform transition-all duration-200 hover:scale-105"
              :loading="auth.isAuthenticating"
              :disabled="auth.isAuthenticating"
            />
            <Message
              v-if="auth.errorMessage"
              severity="error"
              class="mt-2"
            >
              {{ auth.errorMessage }}
            </Message>
          </form>
        </div>
      </div>
    </div>
  </div>
</template>
