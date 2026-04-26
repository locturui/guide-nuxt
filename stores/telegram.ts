import { defineStore } from "pinia";

import { useApi } from "@/utils/api";

export const useTelegramStore = defineStore("telegram", () => {
  async function getLink() {
    return await useApi<{ link: string }>("/telegram/link", { method: "POST" });
  }

  async function unlink() {
    return await useApi("/telegram/unlink", { method: "POST" });
  }

  return {
    getLink,
    unlink,
  };
});
