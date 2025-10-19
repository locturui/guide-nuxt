export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) {
    return;
  }

  const publicRoutes = ["index", "login", "404"];

  if (to.name && publicRoutes.includes(to.name as string)) {
    return;
  }

  const accessToken = useCookie("access_token");

  if (!accessToken.value) {
    return navigateTo("/login");
  }
});
