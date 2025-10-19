import { useAuthStore } from "@/stores/auth";

export async function useApi<T>(url: string, options: any = {}): Promise<T> {
  const auth = useAuthStore();
  const config = useRuntimeConfig();
  const base = config.public.apiBase || (import.meta.env.PROD ? "/api" : "http://localhost:8000");

  const headers = options.headers || {};
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
  catch (err: any) {
    if (err.response?.status === 401) {
      const refreshed = await auth.refreshToken();
      if (refreshed && auth.token) {
        const newHeaders = { ...options.headers };
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
