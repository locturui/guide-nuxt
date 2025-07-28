<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";

const auth = useAuthStore();
const open = ref(false);

function logout() {
  auth.logout();
}
</script>

<template>
  <div class="navbar bg-base-100 shadow-md px-6 bg-gray-100">
    <div class="flex-1">
      <NuxtLink to="/" class="text-xl font-bold">
        207 Booking
      </NuxtLink>
    </div>

    <div v-if="auth.isAuthenticated" class="flex-none gap-4">
      <div class="dropdown dropdown-end">
        <button class="btn btn-ghost" @click="open = !open">
          <span class="ml-4 font-medium">{{ auth.role === 'admin' ? "Admin" : "Agency" }}</span>
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
          class="mt-3 p-2 shadow menu menu-compact dropdown-content bg-base-100 rounded-box w-52"
        >
          <li>
            <NuxtLink to="/account" class="flex items-center">
              Account
            </NuxtLink>
            <button class="text-error" @click="logout">
              Logout
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div v-else>
      <NuxtLink to="/login" class="btn btn-ghost">
        Login
      </NuxtLink>
    </div>
  </div>
</template>
