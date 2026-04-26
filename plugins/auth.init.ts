import { isTokenExpiringSoon } from "@/utils/jwt";

export default defineNuxtPlugin(async (nuxtApp) => {
  if (import.meta.client) {
    const auth = useAuthStore();

    const initAuth = async () => {
      try {
        const token = useCookie("access_token").value;
        if (token) {
          await auth.checkSession();
        }
      }
      catch (error) {
        console.error("Initial auth check failed:", error);
        auth.logout();
      }
    };

    const handleRefresh = async (force: boolean = false) => {
      if (!auth.isAuthenticated) {
        return;
      }

      const token = useCookie("access_token").value;
      if (force || (token && isTokenExpiringSoon(token, 60))) {
        try {
          await auth.refreshToken(force);
        }
        catch (error) {
          console.error("Token refresh failed:", error);
          auth.logout();
        }
      }
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === "visible") {
        await handleRefresh();
      }
    };

    const handleWindowFocus = async () => {
      await handleRefresh();
    };

    nuxtApp.hook("app:mounted", () => {
      initAuth();
      document.addEventListener("visibilitychange", handleVisibilityChange);
      window.addEventListener("focus", handleWindowFocus);
    });
  }
});
