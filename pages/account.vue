<script setup lang="ts">
definePageMeta({
  middleware: "auth",
  name: "account",
});

const auth = useAuthStore();
const users = useUsersStore();
const telegram = useTelegramStore();
const isAdmin = computed(() => auth.role === "admin");
const isAgency = computed(() => auth.role === "agency");
const telegramStatus = ref<{ id?: number | null; username?: string | null; link?: string | null } | null>(null);
const telegramLink = computed(() => {
  const u = telegramStatus.value?.username as string | undefined;
  const id = telegramStatus.value?.id as number | undefined;
  const handle = u || (id ? String(id) : undefined);
  return handle ? `https://t.me/${handle}` : "#";
});
const linkLoading = ref(false);
const linkError = ref("");
const unlinkLoading = ref(false);
const unlinkError = ref("");
const unlinkSuccess = ref(false);

const oldPassword = ref("");
const newPassword = ref("");

const passwordSuccess = ref(false);
const passwordError = ref("");

function extractErrorMessage(err: unknown, fallback: string) {
  const e = err as { data?: { detail?: string; message?: string }; message?: string };
  return e?.data?.detail || e?.data?.message || e?.message || fallback;
}

async function changePassword() {
  passwordSuccess.value = false;
  passwordError.value = "";

  try {
    await users.changePassword({
      old_password: oldPassword.value,
      new_password: newPassword.value,
    });

    passwordSuccess.value = true;
    oldPassword.value = "";
    newPassword.value = "";
  }
  catch (err: unknown) {
    passwordError.value = extractErrorMessage(err, "Ошибка смены пароля");
  }
}

onMounted(() => {
  if (isAgency.value || isAdmin.value) {
    fetchMyAccount();
  }
});

watch(() => auth.role, (role) => {
  void role;
});

async function fetchMyAccount() {
  try {
    const me = await users.fetchMe();
    telegramStatus.value = {
      id: me.telegram_id ?? null,
      username: me.telegram_username ?? null,
      link: null,
    };
  }
  catch {}
}

async function getTelegramLink() {
  linkError.value = "";
  linkLoading.value = true;
  try {
    const { link } = await telegram.getLink();
    telegramStatus.value = { ...(telegramStatus.value || {}), link };
    const opened = window.open(link, "_blank");
    if (!opened) {
      window.location.href = link;
    }
  }
  catch (e: unknown) {
    linkError.value = extractErrorMessage(e, "Не удалось получить ссылку");
  }
  finally {
    linkLoading.value = false;
  }
}

async function unlinkTelegram() {
  unlinkError.value = "";
  unlinkSuccess.value = false;
  unlinkLoading.value = true;
  try {
    await telegram.unlink();
    telegramStatus.value = { id: null, username: null, link: null };
    try {
      await fetchMyAccount();
    }
    catch {}
    unlinkSuccess.value = true;
  }
  catch (e: unknown) {
    unlinkError.value = extractErrorMessage(e, "Не удалось отключиться");
  }
  finally {
    unlinkLoading.value = false;
  }
}

let tgPollInterval: ReturnType<typeof setInterval> | null = null;
function startTelegramLinkPolling() {
  try {
    if (tgPollInterval) {
      clearInterval(tgPollInterval);
    }
  }
  catch {}
  tgPollInterval = setInterval(async () => {
    try {
      await fetchMyAccount();
      if (telegramStatus.value && telegramStatus.value.id) {
        if (tgPollInterval) {
          clearInterval(tgPollInterval);
          tgPollInterval = null;
        }
      }
    }
    catch {}
  }, 5000);
}
try {
  onUnmounted(() => {
    if (tgPollInterval) {
      clearInterval(tgPollInterval);
      tgPollInterval = null;
    }
  });
}
catch {}
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Настройки аккаунта
        </h1>
        <p class="text-sm text-surface-600">
          Управляйте вашим паролем{{ isAdmin ? " и агентствами" : "" }} ниже.
        </p>
      </header>

      <div class="grid md:grid-cols-2 gap-6">
        <Card>
          <template #title>
            <span class="text-xl font-semibold">Сменить пароль</span>
          </template>
          <template #content>
            <div class="space-y-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Старый пароль</label>
                <Password
                  v-model="oldPassword"
                  :feedback="false"
                  toggle-mask
                  class="w-full"
                  input-class="w-full"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Новый пароль</label>
                <Password
                  v-model="newPassword"
                  :feedback="false"
                  toggle-mask
                  class="w-full"
                  input-class="w-full"
                />
              </div>
              <div class="flex items-center gap-3">
                <Button
                  label="Обновить пароль"
                  icon="pi pi-key"
                  @click="changePassword"
                />
                <Message
                  v-if="passwordSuccess"
                  severity="success"
                  class="m-0"
                >
                  Успех
                </Message>
                <Message
                  v-if="passwordError"
                  severity="error"
                  class="m-0"
                >
                  {{ passwordError }}
                </Message>
              </div>
            </div>
          </template>
        </Card>

        <Card
          v-if="isAgency || isAdmin"
        >
          <template #title>
            <span class="text-xl font-semibold">Telegram</span>
          </template>
          <template #content>
            <div class="space-y-4">
              <div v-if="telegramStatus?.id">
                <Card>
                  <template #content>
                    <div class="flex items-center justify-between gap-4">
                      <p class="m-0">
                        Подключен аккаунт:
                        <strong>
                          <a
                            :href="telegramLink"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="text-primary-600 hover:text-primary-700"
                          >
                            @{{ telegramStatus?.username || telegramStatus?.id }}
                          </a>
                        </strong>
                      </p>
                      <Button
                        label="Отключить"
                        icon="pi pi-times"
                        severity="danger"
                        size="small"
                        :loading="unlinkLoading"
                        :disabled="unlinkLoading"
                        @click="unlinkTelegram"
                      />
                    </div>
                  </template>
                </Card>
                <Message
                  v-if="unlinkError"
                  severity="error"
                >
                  {{ unlinkError }}
                </Message>
              </div>
              <div v-else>
                <p class="text-sm text-surface-600 mb-3">
                  Подключите ваш аккаунт Telegram, чтобы получать уведомления.
                </p>
                <Button
                  label="Подключить Telegram"
                  icon="pi pi-send"
                  severity="secondary"
                  :loading="linkLoading"
                  :disabled="linkLoading"
                  @click="getTelegramLink(); startTelegramLinkPolling()"
                />
                <Message
                  v-if="linkError"
                  severity="error"
                  class="mt-2"
                >
                  {{ linkError }}
                </Message>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>
