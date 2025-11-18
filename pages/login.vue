<script setup lang="ts">
const authStore = useAuthStore();
const username = ref("");
const password = ref("");

async function handleSubmit() {
  await authStore.login(username.value, password.value);
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface-50">
    <Card class="w-full max-w-md">
      <template #title>
        <h2 class="text-2xl font-bold text-center">
          Войти
        </h2>
      </template>
      <template #content>
        <form
          class="space-y-4"
          @submit.prevent="handleSubmit"
        >
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-surface-700">Логин</label>
            <InputText
              v-model="username"
              type="text"
              class="w-full"
              required
            />
          </div>
          <div class="flex flex-col gap-2">
            <label class="text-sm font-semibold text-surface-700">Пароль</label>
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
            class="w-full"
            :loading="authStore.isAuthenticating"
            :disabled="authStore.isAuthenticating"
          />
          <Message
            v-if="authStore.errorMessage"
            severity="error"
            class="mt-2"
          >
            {{ authStore.errorMessage }}
          </Message>
        </form>
      </template>
    </Card>
  </div>
</template>
