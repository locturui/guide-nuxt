<script setup lang="ts">
import { ref } from "vue";

import { useAuthStore } from "~/stores/auth";
import { useApi } from "~/utils/api";

type MeResponse = {
  id: string;
  email: string;
  agency_name: string;
};

const auth = useAuthStore();
const open = ref(false);
const agencyName = ref<string | null>(null);

async function loadAgencyName() {
  if (!auth.isAuthenticated || auth.role === "admin") {
    return;
  }
  try {
    const data = await useApi<MeResponse>("/users/my");
    agencyName.value = data.agency_name || null;
  }
  catch {
    agencyName.value = null;
  }
}

onMounted(() => {
  loadAgencyName();
});

watch(
  () => [auth.isAuthenticated, auth.role] as const,
  () => {
    loadAgencyName();
  },
  { immediate: false },
);

function logout() {
  auth.logout();
}
</script>

<template>
  <div class="navbar shadow-md px-4 md:px-6 bg-gray-100">
    <div class="flex-1 min-w-0">
      <NuxtLink to="/" class="text-lg md:text-xl font-bold truncate">
        Innopolis TourBooking
      </NuxtLink>
    </div>

    <div v-if="auth.isAuthenticated" class="flex-none gap-2 md:gap-4">
      <div class="dropdown dropdown-end">
        <button class="btn btn-ghost btn-sm md:btn-md" @click="open = !open">
          <span class="ml-1 md:ml-4 font-medium truncate max-w-[40vw] md:max-w-none">
            {{ auth.role === 'admin' ? 'Администратор' : (agencyName || 'Агентство') }}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="inline-block ml-1 h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>

        <ul
          v-show="open"
          class="mt-2 md:mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-44 md:w-52"
        >
          <li>
            <NuxtLink to="/bookings">
              К слотам
            </NuxtLink>
            <NuxtLink to="/account" class="flex items-center">
              Профиль
            </NuxtLink>
            <button class="text-error" @click="logout">
              Выйти
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-else>
      <NuxtLink to="/login" class="btn btn-ghost btn-sm md:btn-md">
        Войти
      </NuxtLink>
    </div>
  </div>
</template>
