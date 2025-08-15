import { defineStore } from "pinia";
import { ref } from "vue";

export type Agency = {
  agency_id: string;
  email: string;
  name: string;
};

export const useAgenciesStore = defineStore("agencies", () => {
  const items = ref<Agency[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function fetchAgencies() {
    loading.value = true;
    error.value = null;
    try {
      const res = await useApi("/users/admin/agencies") as { agencies: Agency[] };
      items.value = Array.isArray(res?.agencies) ? res.agencies : [];
    }
    catch (e: any) {
      error.value = e?.data?.detail || e?.message || "Не удалось загрузить агентства";
    }
    finally {
      loading.value = false;
    }
  }

  async function changeAgencyEmail(agency_id: string, new_email: string) {
    const res = await useApi("/users/admin/change-agency-email", {
      method: "POST",
      body: { agency_id, new_email },
    }) as { new_email?: string };
    const i = items.value.findIndex(a => a.agency_id === agency_id);
    if (i !== -1)
      items.value[i].email = res?.new_email ?? new_email;
    return res;
  }

  async function changeAgencyName(agency_id: string, new_name: string) {
    const res = await useApi("/users/admin/change-agency-name", {
      method: "POST",
      body: { agency_id, new_name },
    }) as { new_name?: string };
    const i = items.value.findIndex(a => a.agency_id === agency_id);
    if (i !== -1)
      items.value[i].name = res?.new_name ?? new_name;
    return res;
  }

  return {
    items,
    loading,
    error,
    fetchAgencies,
    changeAgencyEmail,
    changeAgencyName,
  };
});
