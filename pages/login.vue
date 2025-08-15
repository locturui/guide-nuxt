<script setup lang="ts">
const authStore = useAuthStore();
const username = ref("");
const password = ref("");

async function handleSubmit() {
  await authStore.login(username.value, password.value);
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <form class="p-6 card bg-base-200 max-w-m" @submit.prevent="handleSubmit">
      <h2 class="text-2xl font-bold mb-4 text-center">
        Войти
      </h2>
      <div class="form-control mb-4">
        <label class="label font-semibold">Логин</label>
        <input
          v-model="username"
          type="text"
          class="input input-bordered w-full"
          required
        >
      </div>
      <div class="form-control mb-6">
        <label class="label font-semibold">Пароль</label>
        <input
          v-model="password"
          type="password"
          class="input input-bordered w-full"
          required
        >
      </div>
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="authStore.isAuthenticating"
      >
        {{ authStore.isAuthenticating ? 'Авторизация...' : 'Войти' }}
      </button>
      <p v-if="authStore.errorMessage" class="text-error mt-2">
        {{ authStore.errorMessage }}
      </p>
    </form>
  </div>
</template>
