import { defineStore } from "pinia";
import { ref } from "vue";

import type { AgencyListResponse, ChangeAgencyEmailResponse, ChangeAgencyNameResponse, RemoveAgencyResponse } from "@/types/api";
import type { Agency } from "@/types/domain";

import { useApi } from "@/utils/api";

export const useAgenciesStore = defineStore("agencies", () => {
  const items = ref<Agency[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string }; message?: string };
    return e?.data?.detail || e?.message || fallback;
  }

  async function fetchAgencies() {
    loading.value = true;
    error.value = null;
    try {
      const res = await useApi<AgencyListResponse>("/users/admin/agencies");
      items.value = Array.isArray(res?.agencies)
        ? res.agencies.map(a => ({ agency_id: a.agency_id, email: a.email, name: a.name ?? "" }))
        : [];
    }
    catch (err: unknown) {
      error.value = extractErrorMessage(err, "Не удалось загрузить агентства");
    }
    finally {
      loading.value = false;
    }
  }

  async function changeAgencyEmail(agency_id: string, new_email: string) {
    const res = await useApi<ChangeAgencyEmailResponse>("/users/admin/change-agency-email", {
      method: "POST",
      body: { agency_id, new_email },
    });
    const i = items.value.findIndex(a => a.agency_id === agency_id);
    if (i !== -1)
      items.value[i].email = res?.new_email ?? new_email;
    return res;
  }

  async function changeAgencyName(agency_id: string, new_name: string) {
    const res = await useApi<ChangeAgencyNameResponse>("/users/admin/change-agency-name", {
      method: "POST",
      body: { agency_id, new_name },
    });
    const i = items.value.findIndex(a => a.agency_id === agency_id);
    if (i !== -1)
      items.value[i].name = res?.new_name ?? new_name;
    return res;
  }

  async function removeAgency(agency_id: string) {
    const res = await useApi<RemoveAgencyResponse>("/users/admin/remove-agency", {
      method: "POST",
      body: { agency_id },
    });
    const i = items.value.findIndex(a => a.agency_id === agency_id);
    if (i !== -1)
      items.value.splice(i, 1);
    return res;
  }

  return {
    items,
    loading,
    error,
    fetchAgencies,
    changeAgencyEmail,
    changeAgencyName,
    removeAgency,
  };
});
