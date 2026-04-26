import { defineStore } from "pinia";
import { ref } from "vue";

import type { GuideAssignmentResponse, GuideDeleteResponse, GuidesAdminResponse, GuidesResponse } from "@/types/api";
import type { Guide } from "@/types/domain";

import { useAuthStore } from "~/stores/auth";
import { useApi } from "~/utils/api";

export const useGuidesStore = defineStore("guides", () => {
  const items = ref<Guide[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const infoLoadingIds = ref(new Set<string>());

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string }; message?: string };
    return e?.data?.detail || e?.message || fallback;
  }

  async function fetchGuideInfo(guide_id: string) {
    if (!guide_id)
      return null;

    const existing = items.value.find(g => g.id === guide_id);
    if (existing)
      return existing;

    if (infoLoadingIds.value.has(guide_id))
      return null;

    infoLoadingIds.value.add(guide_id);
    try {
      const auth = useAuthStore();
      const endpoint = auth.role === "admin" ? "/guides/info/admin" : "/guides/info";

      const guide = await useApi<Guide>(endpoint, {
        method: "GET",
        query: { guide_id },
      });
      const idx = items.value.findIndex(g => g.id === guide.id);
      if (idx === -1)
        items.value.push(guide);
      else
        items.value[idx] = guide;
      return guide;
    }
    finally {
      infoLoadingIds.value.delete(guide_id);
    }
  }

  async function fetchGuides() {
    loading.value = true;
    error.value = null;
    try {
      const auth = useAuthStore();
      const endpoint = auth.role === "admin" || auth.role === "vendor" ? "/guides/admin" : "/guides";

      if (auth.role === "admin" || auth.role === "vendor") {
        const res = await useApi<GuidesAdminResponse>(endpoint);
        const fetched = Object.values(res).flatMap(v => v);
        const byId = new Map<string, Guide>();

        for (const g of items.value)
          byId.set(g.id, g);
        for (const g of fetched)
          byId.set(g.id, g);

        items.value = Array.from(byId.values());
      }
      else {
        const res = await useApi<GuidesResponse>(endpoint);
        items.value = res.guides;
      }
    }
    catch (err: unknown) {
      error.value = extractErrorMessage(err, "Не удалось загрузить гидов");
    }
    finally {
      loading.value = false;
    }
  }

  async function createGuide(name: string, lastname: string) {
    const res = await useApi<Guide>("/guides", {
      method: "POST",
      body: { name, lastname },
    });
    const idx = items.value.findIndex(g => g.id === res.id);
    if (idx === -1)
      items.value.push(res);
    else
      items.value[idx] = res;
    return res;
  }

  async function updateGuide(guide_id: string, name: string, lastname: string) {
    const res = await useApi<Guide>("/guides/update", {
      method: "POST",
      body: { guide_id, name, lastname },
    });
    const idx = items.value.findIndex(g => g.id === guide_id);
    if (idx !== -1)
      items.value[idx] = { ...items.value[idx], ...res };
    else
      items.value.push(res);
    return res;
  }

  async function deleteGuide(guide_id: string) {
    const res = await useApi<GuideDeleteResponse>("/guides/delete", {
      method: "POST",
      body: { guide_id },
    });
    const idx = items.value.findIndex(g => g.id === guide_id);
    if (idx !== -1)
      items.value[idx] = { ...items.value[idx], removed: true };
    return res;
  }

  async function assignGuide(booking_id: string, guide_id: string) {
    const res = await useApi<GuideAssignmentResponse>("/guides/assign", {
      method: "POST",
      body: { booking_id, guide_id },
    });
    return res;
  }

  async function reassignGuide(booking_id: string, old_guide_id: string, new_guide_id: string) {
    const res = await useApi<GuideAssignmentResponse>("/guides/reassign", {
      method: "POST",
      body: { booking_id, old_guide_id, new_guide_id },
    });
    return res;
  }

  async function fetchAll() {
    await fetchGuides();
    return items.value;
  }

  return {
    items,
    loading,
    error,
    fetchGuides,
    fetchGuideInfo,
    fetchAll,
    createGuide,
    updateGuide,
    deleteGuide,
    assignGuide,
    reassignGuide,
  };
});
