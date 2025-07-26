export default defineNuxtRouteMiddleware((to) => {
  const auth = useAuthStore();

  const routeAccessMap: Record<string, (string | null)[]> = {
    bookings: ["admin", "user"],
    index: [null, "admin", "user"],
    login: [null],
  };

  const allowedRoles = routeAccessMap[to.name as string];

  if (!allowedRoles) {
    console.warn(`❌ No access rules defined for route: ${String(to.name)}`);
    return;
  }

  if (!auth.isAuthenticated && !allowedRoles.includes(null)) {
    return navigateTo("/login");
  }

  if (auth.role && !allowedRoles.includes(auth.role)) {
    return navigateTo("/unauthorized");
  }
});
