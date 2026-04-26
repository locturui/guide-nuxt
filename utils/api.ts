import { useAuthStore } from "@/stores/auth";

type NuxtFetchOptions = Parameters<typeof $fetch<unknown>>[1];

export async function useApi<T>(url: string, options: NuxtFetchOptions = {}): Promise<T> {
  const auth = useAuthStore();
  const config = useRuntimeConfig();
  const base = config.public.apiBase || (import.meta.env.PROD ? "/api" : "http://localhost:8000");

  const headers: Record<string, string> = (options.headers as Record<string, string> | undefined) || {};
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
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
  catch (err: unknown) {
    const e = err as { response?: { status?: number } };
    if (e.response?.status === 401) {
      const refreshed = await auth.refreshToken();
      if (refreshed && auth.token) {
        const newHeaders: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
        if (!isFormData) {
          newHeaders["Content-Type"] = "application/json";
        }
        newHeaders.Authorization = `Bearer ${auth.token}`;
        return await $fetch<T>(url, {
          baseURL: base,
          credentials: "include",
          ...options,
          headers: newHeaders,
        });
      }
    }
    throw err;
  }
}
