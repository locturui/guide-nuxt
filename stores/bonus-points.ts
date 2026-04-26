import { defineStore } from "pinia";

import { useApi } from "@/utils/api";

export type BonusPointsResponse = {
  guide_id: string;
  previous_points: number;
  new_points: number;
  operation: "add" | "subtract";
  detail: string;
};

export type BonusPointsAdminResponse = {
  guide_id: string;
  current_points: number;
};

export const useBonusPointsStore = defineStore("bonusPoints", () => {
  async function add(payload: { guide_id: string; points: number; percentage?: number }) {
    return await useApi<BonusPointsResponse>("/bonus-points/add", {
      method: "POST",
      body: payload,
    });
  }

  async function addPoints(payload: { guide_id: string; points: number }) {
    return await useApi<BonusPointsAdminResponse>("/bonus-points/add-points", {
      method: "POST",
      body: payload,
    });
  }

  async function subtract(payload: { guide_id: string; points: number }) {
    return await useApi<BonusPointsResponse>("/bonus-points/subtract", {
      method: "POST",
      body: payload,
    });
  }

  return {
    add,
    addPoints,
    subtract,
  };
});
