<script setup lang="ts">
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
const dropdownRef = ref<HTMLElement | null>(null);
const isToggling = ref(false);

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

async function toggleDropdown() {
  isToggling.value = true;
  open.value = !open.value;
  await nextTick();
  setTimeout(() => {
    isToggling.value = false;
  }, 100);
}

function closeDropdown() {
  open.value = false;
}

function handleClickOutside(event: MouseEvent | TouchEvent) {
  if (isToggling.value) {
    return;
  }
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    closeDropdown();
  }
}

onMounted(() => {
  loadAgencyName();
  document.addEventListener("click", handleClickOutside, true);
  document.addEventListener("touchend", handleClickOutside, true);
});

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside, true);
  document.removeEventListener("touchend", handleClickOutside, true);
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
  closeDropdown();
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
      <div ref="dropdownRef" class="dropdown dropdown-end">
        <button
          class="btn btn-ghost btn-sm md:btn-md"
          type="button"
          @click.stop="toggleDropdown"
          @touchstart.stop.prevent="toggleDropdown"
        >
          <span class="ml-1 md:ml-4 font-medium truncate max-w-[40vw] md:max-w-none">
            {{ auth.role === 'admin' ? 'Администратор' : (agencyName || 'Агентство') }}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="inline-block ml-1 h-4 w-4 transition-transform"
            :class="{ 'rotate-180': open }"
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
          class="mt-2 md:mt-3 p-2 shadow-lg menu menu-compact dropdown-content bg-base-100 rounded-box w-44 md:w-52 z-50"
          @click.stop
          @touchstart.stop
        >
          <li>
            <NuxtLink to="/bookings" @click="closeDropdown">
              К слотам
            </NuxtLink>
          </li>
          <li>
            <NuxtLink to="/account" @click="closeDropdown">
              Профиль
            </NuxtLink>
          </li>
          <li>
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
