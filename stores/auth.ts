import { defineStore } from "pinia";
import { computed, ref } from "vue";

type LoginResponse = {
  access_token: string;
  token_type: string;
  refresh_token: string;
  role: UserRole;
};

type UserRole = "admin" | "agent" | null;

export const useAuthStore = defineStore("auth", () => {
  const token = useCookie<string | null>("access_token");
  const refreshToken = useCookie<string | null>("refresh_token");
  const role = useCookie<UserRole>("user_role");

  const isAuthenticating = ref(false);
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
    try {
      const data = await $fetch<LoginResponse>(
        "/auth/refresh",
        {
          method: "POST",
          credentials: "include",
          baseURL: base,
        },
      );
      token.value = data.access_token;
      role.value = data.role;
      return true;
    }
    catch (err: any) {
      errorMessage.value = err.message || "Token refresh failed";
      logout();
      return false;
    }
  }

  function logout() {
    token.value = null;
    refreshToken.value = null;
    role.value = null;
    errorMessage.value = null;

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
