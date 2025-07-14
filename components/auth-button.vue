<script lang="ts" setup>
// const authStore = useAuthStore();
</script>

<template>
  <!-- <div v-if="!authStore.loading && authStore.user" class="dropdown dropdown-end">
    <div
      tabindex="0"
      role="button"
      class="btn m-1"
    >
      <div v-if="authStore.user.image" class="avatar">
        <div class="w-8 rounded-full">
          <img :src="authStore.user.image">
        </div>
      </div>
      {{ authStore.user.name }}
    </div>
    <ul tabindex="0" class="dropdown-content menu bg-base-200 rounded-box z-1 w-52 p-2 shadow-sm">
      <li>
        <NuxtLink to="/sign-out">
          <Icon
            name="tabler:logout-2"
            size="20"
          />
          Sign Out
        </NuxtLink>
      </li>
    </ul>
  </div>
  <button
    v-else
    :disabled="authStore.loading"
    class="btn btn-accent"
    @click="authStore.signIn"
  >
    Sign in with GitHub
    <span v-if="authStore.loading" class="loading loading-dots loading-sm" />
    <Icon
      v-else
      name="tabler:brand-github"
      size="20"
    />
  </button> -->
  <div />
</template>

<style>

</style>
