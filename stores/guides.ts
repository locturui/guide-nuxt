import { defineStore } from "pinia";
import { ref } from "vue";

import { useAuthStore } from "~/stores/auth";
import { useApi } from "~/utils/api";

export type Guide = {
  id: string;
  name: string;
  lastname: string;
  agency_id: string;
  badge_number: string;
};

export const useGuidesStore = defineStore("guides", () => {
  const items = ref<Guide[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchGuides() {
    loading.value = true;
    error.value = null;
    try {
      const auth = useAuthStore();
      const endpoint = auth.role === "admin" ? "/guides/admin" : "/guides";
      const res = await useApi(endpoint) as { guides: Guide[] } | Record<string, Guide[]>;

      if (auth.role === "admin") {
        const allGuides: Guide[] = [];
        Object.values(res).forEach((agencyGuides) => {
          if (Array.isArray(agencyGuides)) {
            allGuides.push(...agencyGuides);
          }
        });
        items.value = allGuides;
      }
      else {
        items.value = Array.isArray(res?.guides) ? res.guides : [];
      }
    }
    catch (e: any) {
      error.value = e?.data?.detail || e?.message || "Не удалось загрузить гидов";
    }
    finally {
      loading.value = false;
    }
  }

  async function createGuide(name: string, lastname: string, badge_number: string) {
    const res = await useApi("/guides", {
      method: "POST",
      body: { name, lastname, badge_number },
    }) as { id?: string };
    await fetchGuides();
    return res;
  }

  async function updateGuide(guide_id: string, name: string, lastname: string, badge_number: string) {
    const res = await useApi("/guides/update", {
      method: "POST",
      body: { guide_id, name, lastname, badge_number },
    }) as { ok?: boolean };
    const idx = items.value.findIndex(g => g.id === guide_id);
    if (idx !== -1) {
      items.value[idx] = { ...items.value[idx], name, lastname, badge_number };
    }
    return res;
  }

  async function deleteGuide(guide_id: string) {
    const res = await useApi("/guides/delete", {
      method: "POST",
      body: { guide_id },
    }) as { ok?: boolean };
    items.value = items.value.filter(g => g.id !== guide_id);
    return res;
  }

  async function assignGuide(booking_id: string, guide_id: string) {
    const res = await useApi("/guides/assign", {
      method: "POST",
      body: { booking_id, guide_id },
    }) as { detail: string; assignment_id: string; booking_id: string; guide_id: string; guide_name: string; created_at: string };
    return res;
  }

  async function reassignGuide(booking_id: string, new_guide_id: string) {
    const res = await useApi("/guides/reassign", {
      method: "POST",
      body: { booking_id, new_guide_id },
    }) as { detail: string; assignment_id: string; booking_id: string; guide_id: string; guide_name: string; created_at: string };
    return res;
  }

  return {
    items,
    loading,
    error,
    fetchGuides,
    createGuide,
    updateGuide,
    deleteGuide,
    assignGuide,
    reassignGuide,
  };
});
