import { defineStore } from "pinia";
import { computed, ref } from "vue";

type LoginResponse = { access_token: string };

export const useAuthStore = defineStore("auth", () => {
  const token = useCookie<string | null>("auth_token");
  const id = useCookie<string | null>("user_id");
  const email = useCookie<string | null>("user_email");

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
        },
      );

      token.value = data.access_token;
      navigateTo("/");
    }
    catch (err: any) {
      errorMessage.value = err.message || "Login failed";
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

  function logout() {
    token.value = null;
    id.value = null;
    email.value = null;
    errorMessage.value = null;

    useCookie("auth_token").value = null;
    useCookie("user_id").value = null;
    useCookie("user_email").value = null;
    navigateTo("/login");
  }

  return {
    token,
    id,
    email,
    isAuthenticating,
    errorMessage,

    isAuthenticated,

    login,
    register,
    logout,
  };
});
