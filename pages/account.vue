<script setup>
import { ref } from "vue";

import { useAuthStore } from "@/stores/auth";

definePageMeta({
  middleware: "auth",
  name: "account",
});

const auth = useAuthStore();

const isAdmin = auth.role === "admin";

const oldPassword = ref("");
const newPassword = ref("");
const email = ref("");
const name = ref("");

const passwordSuccess = ref(false);
const passwordError = ref("");
const agencySuccess = ref(false);
const agencyError = ref("");

async function changePassword() {
  passwordSuccess.value = false;
  passwordError.value = "";

  try {
    await useApi("/users/change-password", {
      method: "POST",
      body: {
        old_password: oldPassword.value,
        new_password: newPassword.value,
      },
    });
    passwordSuccess.value = true;
    oldPassword.value = "";
    newPassword.value = "";
  }
  catch (err) {
    passwordError.value = err?.data?.message || "Failed to change password";
  }
}

async function createAgency() {
  agencySuccess.value = false;
  agencyError.value = "";

  try {
    await useApi("/users/create-agency", {
      method: "POST",
      body: { email: email.value, agency_name: name.value },
    });
    agencySuccess.value = true;
    email.value = "";
    name.value = "";
  }
  catch (err) {
    agencyError.value = err?.data?.message || "Failed to create agency";
  }
}
</script>

<template>
  <div class="w-full min-h-screen bg-gray-50 py-16 px-6 md:px-12">
    <div class="max-w-6xl mx-auto">
      <header class="mb-12 text-center">
        <h1 class="text-3xl font-semibold text-gray-900">
          Account Settings
        </h1>
        <p class="text-sm text-gray-500 mt-2">
          Manage your password{{ isAdmin ? " and agencies" : "" }} below.
        </p>
      </header>

      <div
        :class="[
          isAdmin ? 'grid md:grid-cols-2 gap-16' : 'flex justify-center',
        ]"
      >
        <section class="flex-1 space-y-6 max-w-md w-full">
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2">
            Change Password
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Old Password</label>
              <input
                v-model="oldPassword"
                type="password"
                class="input input-bordered w-full"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">New Password</label>
              <input
                v-model="newPassword"
                type="password"
                class="input input-bordered w-full"
              >
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn btn-primary" @click="changePassword">
              Update Password
            </button>
            <span v-if="passwordSuccess" class="text-green-600 text-sm">✓ Success</span>
            <span v-if="passwordError" class="text-red-600 text-sm">⚠ {{ passwordError }}</span>
          </div>
        </section>

        <section
          v-if="isAdmin"
          class="flex-1 space-y-6 max-w-md w-full"
        >
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2">
            Create Agency
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Agency Email</label>
              <input
                v-model="email"
                type="email"
                class="input input-bordered w-full"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">Agency Name</label>
              <input
                v-model="name"
                type="text"
                class="input input-bordered w-full"
              >
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn btn-secondary" @click="createAgency">
              Create Agency
            </button>
            <span v-if="agencySuccess" class="text-green-600 text-sm">✓ Success</span>
            <span v-if="agencyError" class="text-red-600 text-sm">⚠ {{ agencyError }}</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
