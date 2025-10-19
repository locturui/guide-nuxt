import { defineStore } from "pinia";
import { computed, ref } from "vue";

type LoginResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  role: UserRole;
};

type UserRole = "admin" | "agency" | null;

export const useAuthStore = defineStore("auth", () => {
  const token = useCookie<string | null>("access_token");
  const refreshToken = useCookie<string | null>("refresh_token");
  const role = useCookie<UserRole>("user_role");

  const isAuthenticating = ref(false);
  const isRefreshing = ref(false);
  const errorMessage = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  const config = useRuntimeConfig();
  const base = config.public.apiBase;

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
      navigateTo("/");
    }
    catch (err: any) {
      errorMessage.value = err.data?.detail || err.message || "Login failed";
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
    catch (err: any) {
      errorMessage.value = err.message || "Register failed";
      throw err;
    }
    finally {
      isAuthenticating.value = false;
      login(username, password);
    }
  }

  async function refreshTokenOnExpire() {
    if (isRefreshing.value) {
      while (isRefreshing.value) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return !!token.value;
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

      await new Promise(resolve => setTimeout(resolve, 10));

      return true;
    }
    catch (err: any) {
      errorMessage.value = err.data?.detail || err.message || "Token refresh failed";
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

  return {
    token,
    role,
    isAuthenticating,
    errorMessage,

    isAuthenticated,

    login,
    register,
    refreshToken: refreshTokenOnExpire,
    logout,
  };
});
