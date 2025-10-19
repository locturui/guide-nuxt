import tailwindcss from "@tailwindcss/vite";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2025-05-15",
  devtools: { enabled: true },
  modules: ["@nuxt/eslint", "@nuxt/icon", "@pinia/nuxt"],
  css: ["~/assets/css/main.css", "vue-cal/style"],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },
  runtimeConfig: {
    // Server-only config
    // eslint-disable-next-line node/no-process-env
    databaseUrl: process.env.DATABASE_URL,
    // eslint-disable-next-line node/no-process-env
    jwtSecret: process.env.JWT_SECRET,
    // eslint-disable-next-line node/no-process-env
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,

    // Public config
    public: {
      // eslint-disable-next-line node/no-process-env
      nodeEnv: process.env.NODE_ENV || "development",
      // eslint-disable-next-line node/no-process-env
      apiBase: process.env.BASE_URL || (process.env.NODE_ENV === "production" ? "/api" : "/api"),
    },
  },
});
