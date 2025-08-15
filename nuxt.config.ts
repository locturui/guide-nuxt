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
    define: {
      __VUE_PROD_DEVTOOLS__: true,
    },
  },
  runtimeConfig: {
    public: {
      // eslint-disable-next-line node/no-process-env
      nodeEnv: process.env.NODE_ENV,
      // eslint-disable-next-line node/no-process-env
      apiBase: process.env.BASE_URL,
    },
  },
});
