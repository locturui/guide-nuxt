<script setup lang="ts">
import type { ServiceAccount, ServiceAccountType } from "@/stores/service-accounts";

const svc = useServiceAccountsStore();
const users = useUsersStore();

const newType = ref<ServiceAccountType>("CP-1");
const newTelegramId = ref<string>("");
const newEmail = ref<string>("");
const creating = ref(false);
const createError = ref("");

const items = computed(() => svc.items);

const adminEmail = ref<string | null>(null);
const adminTelegramId = ref<number | null>(null);
const adminTelegramUsername = ref<string | null>(null);

function extractErrorMessage(err: unknown, fallback: string) {
  const e = err as { data?: { detail?: string; message?: string }; message?: string };
  return e?.data?.detail || e?.data?.message || e?.message || fallback;
}

onMounted(async () => {
  try {
    const me = await users.fetchMe();
    adminEmail.value = me.email || null;
    adminTelegramId.value = me.telegram_id ?? null;
    adminTelegramUsername.value = me.telegram_username ?? null;
  }
  catch {}
});

async function createAccount() {
  creating.value = true;
  createError.value = "";
  try {
    await svc.create({
      type: newType.value,
      email: newEmail.value ? newEmail.value : null,
      telegram_id: newTelegramId.value ? Number(newTelegramId.value) : null,
    });
    newEmail.value = "";
    newTelegramId.value = "";
    newType.value = "CP-1";
  }
  catch (e: unknown) {
    createError.value = extractErrorMessage(e, "Не удалось создать аккаунт");
  }
  finally {
    creating.value = false;
  }
}

async function updateAccount(a: ServiceAccount, field: "type" | "telegram_id" | "email", value: unknown) {
  try {
    const payload = { [field]: value } as Partial<Pick<ServiceAccount, "type" | "telegram_id" | "email">>;
    await svc.update(a.id, payload);
  }
  catch (e: unknown) {
    // eslint-disable-next-line no-alert
    alert(extractErrorMessage(e, "Ошибка обновления аккаунта"));
  }
}

async function removeAccount(id: string) {
  // eslint-disable-next-line no-alert
  if (!confirm("Удалить сервисный аккаунт?"))
    return;
  try {
    await svc.remove(id);
  }
  catch (e: unknown) {
    // eslint-disable-next-line no-alert
    alert(extractErrorMessage(e, "Ошибка удаления аккаунта"));
  }
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <template #title>
        <span class="text-lg font-semibold">Создать сервисный аккаунт</span>
      </template>
      <template #content>
        <div class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">Тип</label>
              <Select
                v-model="newType"
                :options="[
                  { label: 'CP-1', value: 'CP-1' },
                  { label: 'CP-2', value: 'CP-2' },
                  { label: 'Admin', value: 'Admin' },
                ]"
                option-label="label"
                option-value="value"
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">Telegram ID (необязательно)</label>
              <InputText
                v-model="newTelegramId"
                placeholder="например, 123456789"
                class="w-full"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-surface-700">Email (необязательно)</label>
              <InputText
                v-model="newEmail"
                type="email"
                placeholder="email@example.com"
                class="w-full"
              />
            </div>
          </div>
          <div class="flex items-center gap-3">
            <Button
              label="Создать"
              icon="pi pi-plus"
              :loading="creating"
              :disabled="creating"
              @click="createAccount"
            />
            <Message
              v-if="createError"
              severity="error"
              class="text-sm"
            >
              {{ createError }}
            </Message>
          </div>
        </div>
      </template>
    </Card>

    <div>
      <h3 class="text-lg font-semibold mb-4 text-surface-900">
        Существующие аккаунты
      </h3>
      <Card class="mb-3">
        <template #content>
          <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs text-surface-500 mb-1">Администратор</label>
              <div class="text-surface-900">
                Admin
              </div>
            </div>
            <div>
              <label class="block text-xs text-surface-500 mb-1">Telegram</label>
              <div class="text-surface-900">
                <template v-if="adminTelegramId">
                  {{ adminTelegramUsername ? `@${adminTelegramUsername}` : adminTelegramId }}
                </template>
                <template v-else>
                  —
                </template>
              </div>
            </div>
            <div>
              <label class="block text-xs text-surface-500 mb-1">Email</label>
              <div class="text-surface-900">
                {{ adminEmail || '—' }}
              </div>
            </div>
          </div>
        </template>
      </Card>
      <div
        v-if="svc.loading"
        class="text-surface-500"
      >
        Загрузка…
      </div>
      <Message
        v-else-if="svc.error"
        severity="error"
      >
        {{ svc.error }}
      </Message>
      <div v-else class="space-y-3">
        <Card
          v-for="a in items"
          :key="a.id"
        >
          <template #content>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Тип</label>
                <Select
                  :model-value="a.type"
                  :options="[
                    { label: 'CP-1', value: 'CP-1' },
                    { label: 'CP-2', value: 'CP-2' },
                    { label: 'Admin', value: 'Admin' },
                  ]"
                  option-label="label"
                  option-value="value"
                  class="w-full"
                  @update:model-value="(val: ServiceAccountType) => updateAccount(a, 'type', val)"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Telegram ID</label>
                <InputText
                  :model-value="a.telegram_id ? String(a.telegram_id) : ''"
                  class="w-full"
                  @update:model-value="(val: string | undefined) => updateAccount(a, 'telegram_id', val ? Number(val) || null : null)"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Email</label>
                <InputText
                  :model-value="a.email ?? ''"
                  type="email"
                  class="w-full"
                  @update:model-value="(val: string | undefined) => updateAccount(a, 'email', val || null)"
                />
              </div>
              <div class="flex justify-end items-end">
                <Button
                  label="Удалить"
                  icon="pi pi-trash"
                  severity="danger"
                  size="small"
                  @click="removeAccount(a.id)"
                />
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>
