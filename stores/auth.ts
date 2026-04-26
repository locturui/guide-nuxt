import { defineStore } from "pinia";
import { computed, ref } from "vue";

import { isTokenExpiringSoon } from "@/utils/jwt";

export type UserRole = "admin" | "agency" | "vendor";
type StoredUserRole = UserRole | null;

type LoginResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  role: UserRole;
};

export const useAuthStore = defineStore("auth", () => {
  const token = useCookie<string | null>("access_token");
  const refreshToken = useCookie<string | null>("refresh_token");
  const role = useCookie<StoredUserRole>("user_role");

  const isAuthenticating = ref(false);
  const isRefreshing = ref(false);
  const errorMessage = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  const config = useRuntimeConfig();
  const base = config.public.apiBase;

  function extractErrorMessage(err: unknown, fallback: string) {
    const e = err as { data?: { detail?: string }; message?: string };
    return e?.data?.detail || e?.message || fallback;
  }

  async function login(username: string, password: string) {
    isAuthenticating.value = true;
    errorMessage.value = null;
    try {
      const data = await $fetch<LoginResponse>(
        "/auth/login",
        {
          method: "POST",
          body: new URLSearchParams({
            username,
            password,
            grant_type: "password",
          }),
          baseURL: base,
          credentials: "include",
        },
      );

      token.value = data.access_token;
      refreshToken.value = data.refresh_token;
      role.value = data.role;
      if (data.role === "vendor") {
        navigateTo("/bonus-points");
      }
      else {
        navigateTo("/");
      }
    }
    catch (err: unknown) {
      errorMessage.value = extractErrorMessage(err, "Login failed");
      throw err;
    }
    finally {
      isAuthenticating.value = false;
    }
  }

  async function register(username: string, password: string) {
    isAuthenticating.value = true;
    errorMessage.value = null;
    try {
      await $fetch("/auth/register", {
        method: "POST",
        body: { email: username, password },
        baseURL: base,
        credentials: "include",
      });
    }
    catch (err: unknown) {
      errorMessage.value = extractErrorMessage(err, "Register failed");
      throw err;
    }
    finally {
      isAuthenticating.value = false;
      login(username, password);
    }
  }

  async function refreshTokenOnExpire(force: boolean = false) {
    if (isRefreshing.value) {
      while (isRefreshing.value) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return !!token.value;
    }

    if (!force && token.value && !isTokenExpiringSoon(token.value, 60)) {
      return true;
    }

    if (!refreshToken.value) {
      logout();
      return false;
    }

    isRefreshing.value = true;
    try {
      const data = await $fetch<LoginResponse>(
        "/auth/refresh",
        {
          method: "POST",
          body: new URLSearchParams({
            refresh_token: refreshToken.value,
            grant_type: "refresh_token",
          }),
          baseURL: base,
          credentials: "include",
        },
      );
      token.value = data.access_token;
      refreshToken.value = data.refresh_token;
      role.value = data.role;

      return true;
    }
    catch (err: unknown) {
      errorMessage.value = extractErrorMessage(err, "Token refresh failed");
      logout();
      return false;
    }
    finally {
      isRefreshing.value = false;
    }
  }

  function logout() {
    token.value = null;
    refreshToken.value = null;
    role.value = null;
    errorMessage.value = null;

    useCookie("access_token").value = null;
    useCookie("refresh_token").value = null;
    useCookie("user_role").value = null;
    useCookie("auth_token").value = null;
    useCookie("user_id").value = null;
    useCookie("user_email").value = null;
    navigateTo("/login");
  }

  async function checkSession() {
    if (!token.value && refreshToken.value) {
      return await refreshTokenOnExpire();
    }
    return isAuthenticated.value;
  }

  let refreshInterval: ReturnType<typeof setInterval>;

  function startAutoRefresh() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }

    const checkInterval = 5 * 60 * 1000; // 5 minutes

    refreshInterval = setInterval(async () => {
      if (token.value && isTokenExpiringSoon(token.value, 60)) {
        try {
          await refreshTokenOnExpire();
        }
        catch (error) {
          console.error("Auto-refresh failed:", error);
          logout();
        }
      }
    }, checkInterval);
  }

  watch(token, (newToken) => {
    if (newToken) {
      startAutoRefresh();
    }
    else if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  }, { immediate: true });

  return {
    token,
    role,
    isAuthenticating,
    isRefreshing,
    errorMessage,
    isAuthenticated,
    login,
    register,
    refreshToken: refreshTokenOnExpire,
    logout,
    checkSession,
  };
});
