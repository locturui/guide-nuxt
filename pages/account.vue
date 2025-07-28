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
  <div class="max-w-5xl mx-auto p-8 mt-20">
    <div class="grid gap-50" :class="[isAdmin ? 'md:grid-cols-2' : 'grid-cols-1']">
      <div class="bg-white shadow rounded-xl p-6 space-y-4 ">
        <h2 class="text-xl font-semibold">
          Change Password
        </h2>
        <div>
          <label class="block text-sm font-medium mb-1">Old Password</label>
          <input
            v-model="oldPassword"
            type="password"
            class="w-full input input-bordered"
          >
        </div>
        <div>
          <label class="block text-sm font-medium mb-1">New Password</label>
          <input
            v-model="newPassword"
            type="password"
            class="w-full input input-bordered"
          >
        </div>
        <button class="btn btn-primary w-full" @click="changePassword">
          Change Password
        </button>
        <p v-if="passwordSuccess" class="text-green-600 text-sm">
          Password changed successfully
        </p>
        <p v-if="passwordError" class="text-red-600 text-sm">
          {{ passwordError }}
        </p>
      </div>

      <div v-if="isAdmin" class="bg-white shadow rounded-xl p-6 space-y-4">
        <h2 class="text-xl font-semibold">
          Create New Agency
        </h2>
        <div>
          <label class="block text-sm font-medium mb-1">Agency Email</label>
          <input
            v-model="email"
            type="email"
            class="w-full input input-bordered"
          >
          <label class="block text-sm font-medium mb-1">Agency Name</label>
          <input
            v-model="name"
            type="text"
            class="w-full input input-bordered"
          >
        </div>
        <button class="btn btn-secondary w-full" @click="createAgency">
          Add Agency
        </button>
        <p v-if="agencySuccess" class="text-green-600 text-sm">
          Agency created successfully
        </p>
        <p v-if="agencyError" class="text-red-600 text-sm">
          {{ agencyError }}
        </p>
      </div>
    </div>
  </div>
</template>
