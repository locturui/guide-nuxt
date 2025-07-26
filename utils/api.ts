import { useAuthStore } from "@/stores/auth";

export async function useApi<T>(url: string, options: any = {}): Promise<T> {
  const auth = useAuthStore();
  const config = useRuntimeConfig();
  const base = config.public.apiBase;

  const headers = options.headers || {};
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }

  try {
    return await $fetch<T>(url, {
      baseURL: base,
      credentials: "include",
      ...options,
      headers,
    });
  }
  catch (err: any) {
    if (err.response?.status === 401) {
      const refreshed = await auth.refreshToken();
      if (refreshed && auth.token) {
        headers.Authorization = `Bearer ${auth.token}`;
        return await $fetch<T>(url, {
          baseURL: base,
          credentials: "include",
          ...options,
          headers,
        });
      }
    }
    throw err;
  }
}
