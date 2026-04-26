import { defineStore } from "pinia";

import { useApi } from "@/utils/api";

export type MeResponse = {
  id: string;
  email: string;
  agency_name?: string | null;
  telegram_id?: number | null;
  telegram_username?: string | null;
};

export const useUsersStore = defineStore("users", () => {
  async function fetchMe() {
    return await useApi<MeResponse>("/users/my");
  }

  async function changePassword(payload: { old_password: string; new_password: string }) {
    return await useApi("/users/change-password", {
      method: "POST",
      body: payload,
    });
  }

  async function createAgency(payload: { email: string; agency_name: string }) {
    return await useApi("/users/create-agency", {
      method: "POST",
      body: payload,
    });
  }

  return {
    fetchMe,
    changePassword,
    createAgency,
  };
});
