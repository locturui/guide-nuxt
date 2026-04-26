import { defineStore } from "pinia";
import { ref } from "vue";

export type ServiceAccountType = "CP-1" | "CP-2" | "Admin";

export type ServiceAccount = {
  id: string;
  type: ServiceAccountType;
  telegram_id?: number | null;
  email?: string | null;
};

export const useServiceAccountsStore = defineStore("service-accounts", () => {
  const items = ref<ServiceAccount[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string }; message?: string };
    return e?.data?.detail || e?.message || fallback;
  }

  async function fetchAll(type?: ServiceAccountType) {
    loading.value = true;
    error.value = null;
    try {
      const params = type ? `?account_type=${encodeURIComponent(type)}` : "";
      const res = await useApi<ServiceAccount[]>(`/accounts/service-accounts${params}`);
      items.value = Array.isArray(res) ? res : [];
    }
    catch (err: unknown) {
      error.value = extractErrorMessage(err, "Не удалось загрузить сервисные аккаунты");
    }
    finally {
      loading.value = false;
    }
  }

  async function create(payload: { type: ServiceAccountType; telegram_id?: number | null; email?: string | null }) {
    const res = await useApi<{ id: string; type: string; telegram_id?: number | null; email?: string | null }>(
      "/accounts/create-service-account",
      { method: "POST", body: payload },
    );
    items.value.push({
      id: res.id,
      type: res.type as ServiceAccountType,
      telegram_id: res.telegram_id ?? null,
      email: res.email ?? null,
    });
    return res;
  }

  async function update(id: string, payload: Partial<Pick<ServiceAccount, "type" | "telegram_id" | "email">>) {
    const res = await useApi<ServiceAccount>(`/accounts/service-accounts/${id}`, { method: "PUT", body: payload });
    const i = items.value.findIndex(x => x.id === id);
    if (i !== -1) {
      items.value[i] = {
        ...items.value[i],
        ...res,
        type: (res.type as ServiceAccountType) || items.value[i].type,
      };
    }
    return res;
  }

  async function remove(id: string) {
    await useApi(`/accounts/service-accounts/${id}`, { method: "DELETE" });
    const i = items.value.findIndex(x => x.id === id);
    if (i !== -1)
      items.value.splice(i, 1);
  }

  return { items, loading, error, fetchAll, create, update, remove };
});
