<script setup lang="ts">
import { useAuthStore } from "~/stores/auth";
import { useApi } from "~/utils/api";

type MeResponse = {
  id: string;
  email: string;
  agency_name: string;
};

const auth = useAuthStore();
const route = useRoute();
const isMobile = ref(typeof window !== "undefined" ? window.innerWidth < 768 : false);
const sidebarExpanded = ref(false);
const agencyName = ref<string | null>(null);

const isLoginPage = computed(() => route.path === "/login" || route.path === "/");

function isActiveRoute(path: string) {
  if (!path)
    return false;
  const currentPath = route.path;
  if (currentPath === path)
    return true;
  if (currentPath.startsWith(`${path}/`))
    return true;
  return false;
}

const menuItems = computed(() => {
  if (!auth.isAuthenticated) {
    return [];
  }
  return [
    {
      label: "Бронирования",
      icon: "pi pi-calendar",
      to: "/bookings",
    },
    {
      label: "Профиль",
      icon: "pi pi-user",
      to: "/account",
    },
    {
      separator: true,
    },
    {
      label: "Выйти",
      icon: "pi pi-sign-out",
      command: () => {
        auth.logout();
      },
      class: "text-red-600",
    },
  ];
});

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

function checkMobile() {
  if (typeof window !== "undefined") {
    isMobile.value = window.innerWidth < 768;
  }
}

onMounted(() => {
  checkMobile();
  loadAgencyName();
  if (typeof window !== "undefined") {
    window.addEventListener("resize", checkMobile);
  }
});

onUnmounted(() => {
  window.removeEventListener("resize", checkMobile);
});

watch(
  () => [auth.isAuthenticated, auth.role] as const,
  () => {
    loadAgencyName();
  },
  { immediate: false },
);
</script>

<template>
  <div v-if="isLoginPage" class="min-h-screen">
    <slot />
  </div>
  <div v-else class="flex h-screen overflow-hidden bg-surface-ground">
    <teleport to="body">
      <button
        v-if="isMobile && !sidebarExpanded"
        type="button"
        class="fixed top-4 left-4 z-50 rounded-full border border-gray-300 bg-white shadow-md hover:bg-gray-50 flex items-center justify-center"
        style="width: 2.5rem; height: 2.5rem; min-width: 2.5rem; min-height: 2.5rem;"
        @click="sidebarExpanded = !sidebarExpanded"
      >
        <i class="pi pi-bars text-gray-700" style="font-size: 1rem;" />
      </button>
    </teleport>

    <div
      v-if="isMobile && sidebarExpanded"
      class="fixed inset-0 bg-black/50 z-40"
      @click="sidebarExpanded = false"
    />

    <div
      class="bg-surface-0 bg-white shadow-sm transition-all duration-300 z-50 flex flex-col"
      :class="isMobile
        ? (sidebarExpanded ? 'fixed left-0 top-0 h-full w-64' : 'hidden')
        : 'fixed left-0 top-0 h-full w-16'"
    >
      <div v-if="isMobile" class="flex items-center justify-between p-4 min-h-[4rem]">
        <div v-if="isMobile && sidebarExpanded" class="flex items-center gap-2">
          <h2 class="text-lg font-bold text-surface-900">
            Innopolis TourBooking
          </h2>
        </div>
        <Button
          v-if="isMobile && !sidebarExpanded"
          icon="pi pi-times"
          text
          rounded
          size="small"
          @click="sidebarExpanded = false"
        />
      </div>

      <nav class="flex-1 overflow-y-auto py-2 space-y-1">
        <div
          v-for="(item, index) in menuItems"
          :key="index"
        >
          <div
            v-if="item.separator"
            class="my-2 mx-4 h-px bg-surface-200"
          />
          <template v-else>
            <NuxtLink
              v-if="item.to"
              v-tooltip.right="(!isMobile || !sidebarExpanded) ? item.label : ''"
              :to="item.to"
              class="flex items-center px-4 py-3 mx-2 rounded-lg transition-colors no-underline cursor-pointer"
              :class="[
                isMobile && sidebarExpanded ? 'justify-start gap-3' : 'justify-center',
                isActiveRoute(item.to)
                  ? 'bg-primary-50 text-primary-700 font-semibold hover:bg-primary-100'
                  : 'text-surface-700 hover:bg-surface-100',
              ]"
              @click="() => {
                if (isMobile && sidebarExpanded) {
                  sidebarExpanded = false;
                }
              }"
            >
              <i :class="item.icon" class="text-lg flex-shrink-0" />
              <span
                v-if="isMobile && sidebarExpanded"
                class="font-medium"
              >
                {{ item.label }}
              </span>
            </NuxtLink>
            <button
              v-else
              v-tooltip.right="(!isMobile || !sidebarExpanded) ? item.label : ''"
              class="flex items-center px-4 py-3 mx-2 rounded-lg transition-colors cursor-pointer hover:bg-surface-100"
              :class="[
                isMobile && sidebarExpanded ? 'justify-start gap-3 text-left' : 'justify-center',
                item.class || 'text-surface-700',
              ]"
              @click="() => {
                if (item.command) {
                  item.command();
                }
                if (isMobile && sidebarExpanded) {
                  sidebarExpanded = false;
                }
              }"
            >
              <i :class="item.icon" class="text-lg flex-shrink-0" />
              <span
                v-if="isMobile && sidebarExpanded"
                class="font-medium"
              >
                {{ item.label }}
              </span>
            </button>
          </template>
        </div>
      </nav>
    </div>

    <div
      class="flex flex-col flex-1 overflow-hidden transition-all duration-300"
      :class="isMobile
        ? 'ml-0'
        : 'ml-16'"
    >
      <main class="flex-1 overflow-auto bg-surface-ground">
        <div class="p-4 md:p-6" :class="isMobile ? 'pt-16' : ''">
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(a.router-link-active),
:deep(a.router-link-exact-active) {
  background-color: rgb(239 246 255) !important;
  color: rgb(29 78 216) !important;
  font-weight: 600 !important;
}

:deep(a.router-link-active:hover),
:deep(a.router-link-exact-active:hover) {
  background-color: rgb(219 234 254) !important;
}

:deep(nav a:not(.router-link-active):not(.router-link-exact-active):hover) {
  background-color: rgb(243 244 246) !important;
}

:deep(nav button:hover) {
  background-color: rgb(243 244 246) !important;
}
</style>
