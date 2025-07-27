export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();

  const routeAccessMap: Record<string, (string | null)[]> = {
    bookings: ["admin", "agency"],
    index: [null, "admin", "agency"],
    login: [null],
    account: ["admin", "agency"],
  };

  const allowedRoles = routeAccessMap[to.name as string];

  if (!allowedRoles) {
    return;
  }

  if (!auth.isAuthenticated && !allowedRoles.includes(null)) {
    return navigateTo("/login");
  }

  if (auth.role && !allowedRoles.includes(auth.role)) {
    return navigateTo("/");
  }
});
