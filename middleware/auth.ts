export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  if (import.meta.server) {
    return;
  }

  if (typeof window === "undefined") {
    return;
  }

  const routeAccessMap: Record<string, (string | null)[]> = {
    "bookings": ["admin", "agency"],
    "index": [null, "admin", "agency", "vendor"],
    "login": [null],
    "account": ["admin", "agency"],
    "agencies": ["admin"],
    "service-accounts": ["admin"],
    "reports": ["admin"],
    "agency-reports": ["agency"],
    "guides": ["agency"],
    "bonus-points": ["admin", "vendor"],
    "agency-bonus-program": ["agency"],
  };

  const allowedRoles = routeAccessMap[to.name as string] || [];

  if (allowedRoles.includes(null) && !auth.isAuthenticated) {
    return;
  }

  const token = useCookie("access_token").value;
  if (token && !auth.isAuthenticated) {
    try {
      await auth.checkSession();
    }
    catch (error) {
      console.error("Session check failed:", error);
      auth.logout();
      return navigateTo("/login");
    }
  }

  if (!auth.isAuthenticated) {
    return navigateTo("/login");
  }

  if (auth.role && !allowedRoles.includes(auth.role)) {
    return navigateTo("/");
  }
});
