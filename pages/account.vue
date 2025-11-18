<script setup lang="ts">
import { useAgenciesStore } from "~/stores/agencies";
import { useGuidesStore } from "~/stores/guides";

definePageMeta({
  middleware: "auth",
  name: "account",
});

const auth = useAuthStore();
const isAdmin = computed(() => auth.role === "admin");
const isAgency = computed(() => auth.role !== "admin");

const oldPassword = ref("");
const newPassword = ref("");
const email = ref("");
const name = ref("");
const guideLastName = ref("");
const guideFirstName = ref("");
const guideSearchQuery = ref("");

const passwordSuccess = ref(false);
const passwordError = ref("");
const agencySuccess = ref(false);
const agencyError = ref("");
const guideSuccess = ref(false);
const guideError = ref("");

async function changePassword() {
  passwordSuccess.value = false;
  passwordError.value = "";

  try {
    await useApi("/users/change-password", {
      method: "POST",
      body: {
        old_password: oldPassword.value,
        new_password: newPassword.value,
      },
    });
    passwordSuccess.value = true;
    oldPassword.value = "";
    newPassword.value = "";
  }
  catch (err: any) {
    passwordError.value = err?.data?.message || "Ошибка смены пароля";
  }
}

async function createAgency() {
  agencySuccess.value = false;
  agencyError.value = "";

  try {
    await useApi("/users/create-agency", {
      method: "POST",
      body: { email: email.value, agency_name: name.value },
    });
    agencySuccess.value = true;
    email.value = "";
    name.value = "";
  }
  catch (err: any) {
    agencyError.value = err?.data?.message || "Не удалось создать агентство";
  }
}

const agencies = useAgenciesStore();
const guides = useGuidesStore();

onMounted(() => {
  if (isAdmin.value) {
    agencies.fetchAgencies();
  }
  if (isAgency.value) {
    guides.fetchGuides();
  }
});

watch(() => auth.role, (role) => {
  if (role === "agent") {
    guides.fetchGuides();
  }
});

type EditRow = { name: string; email: string };
const editing: Record<string, EditRow> = reactive({});
const saving: Record<string, boolean> = reactive({});
const rowError: Record<string, string> = reactive({});
const rowSuccess: Record<string, string> = reactive({});

type GuideEditRow = { name: string; lastname: string };
const guideEditing: Record<string, GuideEditRow> = reactive({});
const guideSaving: Record<string, boolean> = reactive({});
const guideRowError: Record<string, string> = reactive({});
const guideRowSuccess: Record<string, string> = reactive({});

function startEdit(a: { agency_id: string; name: string; email: string }) {
  editing[a.agency_id] = { name: a.name, email: a.email };
  rowError[a.agency_id] = "";
  rowSuccess[a.agency_id] = "";
}

function cancelEdit(id: string) {
  delete editing[id];
  rowError[id] = "";
  rowSuccess[id] = "";
}

function isValidEmail(v: string) {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(v);
}

async function saveRow(a: { agency_id: string; name: string; email: string }) {
  const id = a.agency_id;
  const draft = editing[id];
  if (!draft) {
    return;
  }

  rowError[id] = "";
  rowSuccess[id] = "";
  saving[id] = true;

  try {
    if (!draft.name || draft.name.length > 100) {
      throw new Error("Имя должно быть от 1 до 100 символов");
    }
    if (!isValidEmail(draft.email)) {
      throw new Error("Некорректный email");
    }

    if (draft.name !== a.name) {
      await agencies.changeAgencyName(id, draft.name);
    }
    if (draft.email !== a.email) {
      await agencies.changeAgencyEmail(id, draft.email);
    }

    rowSuccess[id] = "Сохранено";
    delete editing[id];
  }
  catch (e: any) {
    rowError[id] = e?.data?.detail || e?.message || "Не удалось сохранить изменения";
  }
  finally {
    saving[id] = false;
  }
}

async function deleteAgency(id: string) {
  rowError[id] = "";
  rowSuccess[id] = "";
  try {
    await agencies.removeAgency(id);
    rowSuccess[id] = "Удалено";
  }
  catch (e: any) {
    rowError[id] = e?.data?.detail || e?.message || "Не удалось удалить агентство";
  }
}

watch(() => agencySuccess.value, (ok) => {
  if (ok && isAdmin.value) {
    agencies.fetchAgencies();
  }
});

function startGuideEdit(g: { id: string; name: string; lastname: string }) {
  guideEditing[g.id] = { name: g.name, lastname: g.lastname };
  guideRowError[g.id] = "";
  guideRowSuccess[g.id] = "";
}

function cancelGuideEdit(id: string) {
  delete guideEditing[id];
  guideRowError[id] = "";
  guideRowSuccess[id] = "";
}

async function saveGuideRow(g: { id: string; name: string; lastname: string }) {
  const id = g.id;
  const draft = guideEditing[id];
  if (!draft) {
    return;
  }
  guideRowError[id] = "";
  guideRowSuccess[id] = "";
  guideSaving[id] = true;
  try {
    if (!draft.name || draft.name.length > 100) {
      throw new Error("Имя должно быть от 1 до 100 символов");
    }
    if (!draft.lastname || draft.lastname.length > 100) {
      throw new Error("Фамилия должна быть от 1 до 100 символов");
    }
    if (draft.name !== g.name || draft.lastname !== g.lastname) {
      await guides.updateGuide(id, draft.name, draft.lastname);
    }
    guideRowSuccess[id] = "Сохранено";
    delete guideEditing[id];
  }
  catch (e: any) {
    guideRowError[id] = e?.data?.detail || e?.message || "Не удалось сохранить изменения";
  }
  finally {
    guideSaving[id] = false;
  }
}

async function createGuide() {
  guideSuccess.value = false;
  guideError.value = "";
  try {
    const firstName = guideFirstName.value.trim();
    const lastName = guideLastName.value.trim();

    if (!firstName || firstName.length > 100) {
      throw new Error("Имя должно быть от 1 до 100 символов");
    }
    if (!lastName || lastName.length > 100) {
      throw new Error("Фамилия должна быть от 1 до 100 символов");
    }
    await guides.createGuide(firstName, lastName);
    guideSuccess.value = true;
    guideLastName.value = "";
    guideFirstName.value = "";
  }
  catch (e: any) {
    guideError.value = e?.data?.detail || e?.message || "Не удалось создать гида";
  }
}

async function deleteGuide(id: string) {
  guideRowError[id] = "";
  guideRowSuccess[id] = "";
  try {
    await guides.deleteGuide(id);
    guideRowSuccess[id] = "Удалено";
  }
  catch (e: any) {
    guideRowError[id] = e?.data?.detail || e?.message || "Не удалось удалить гида";
  }
}

const filteredGuides = computed(() => {
  if (!guideSearchQuery.value.trim()) {
    return guides.items;
  }
  const query = guideSearchQuery.value.trim().toLowerCase();
  return guides.items.filter(g =>
    g.lastname.toLowerCase().includes(query) || g.name.toLowerCase().includes(query),
  );
});
</script>

<template>
  <div class="w-full min-h-screen bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
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
          v-if="isAdmin"
        >
          <template #title>
            <span class="text-xl font-semibold">Создать агентство</span>
          </template>
          <template #content>
            <div class="space-y-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Email агентства</label>
                <InputText
                  v-model="email"
                  type="email"
                  class="w-full"
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Название агентства</label>
                <InputText
                  v-model="name"
                  type="text"
                  class="w-full"
                />
              </div>
              <div class="flex items-center gap-3">
                <Button
                  label="Создать агентство"
                  icon="pi pi-plus"
                  severity="secondary"
                  @click="createAgency"
                />
                <Message
                  v-if="agencySuccess"
                  severity="success"
                  class="m-0"
                >
                  Успех
                </Message>
                <Message
                  v-if="agencyError"
                  severity="error"
                  class="m-0"
                >
                  {{ agencyError }}
                </Message>
              </div>
            </div>
          </template>
        </Card>

        <Card
          v-if="isAdmin"
        >
          <template #title>
            <span class="text-xl font-semibold">Все агентства</span>
          </template>
          <template #content>
            <ProgressSpinner
              v-if="agencies.loading"
              class="mx-auto"
            />
            <Message
              v-else-if="agencies.error"
              severity="error"
            >
              {{ agencies.error }}
            </Message>
            <div
              v-else
              class="rounded-lg overflow-hidden flex flex-col"
              style="max-height: 24rem; border: 1px solid rgb(243 244 246);"
            >
              <div class="overflow-y-auto flex-1">
                <div
                  v-if="!agencies.items.length"
                  class="p-4 text-center text-surface-500"
                >
                  Нет агентств.
                </div>
                <div
                  v-for="a in agencies.items"
                  :key="a.agency_id"
                  class="p-3 hover:bg-surface-50 transition-colors"
                  :style="a !== agencies.items[agencies.items.length - 1] ? 'border-bottom: 1px solid rgb(243 244 246);' : ''"
                >
                  <template v-if="editing[a.agency_id]">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-surface-600">Название</label>
                        <InputText
                          v-model="editing[a.agency_id].name"
                          type="text"
                          size="small"
                          class="w-full"
                          :disabled="saving[a.agency_id]"
                        />
                      </div>
                      <div class="flex flex-col gap-1">
                        <label class="text-xs font-medium text-surface-600">Email</label>
                        <InputText
                          v-model="editing[a.agency_id].email"
                          type="email"
                          size="small"
                          class="w-full"
                          :disabled="saving[a.agency_id]"
                        />
                      </div>
                    </div>
                    <div class="flex gap-2 justify-end">
                      <Button
                        label="Сохранить"
                        icon="pi pi-check"
                        size="small"
                        :loading="saving[a.agency_id]"
                        :disabled="saving[a.agency_id]"
                        @click="saveRow(a)"
                      />
                      <Button
                        label="Отмена"
                        icon="pi pi-times"
                        text
                        severity="secondary"
                        size="small"
                        :disabled="saving[a.agency_id]"
                        @click="cancelEdit(a.agency_id)"
                      />
                    </div>
                    <Message
                      v-if="rowSuccess[a.agency_id]"
                      severity="success"
                      class="mt-2 text-xs"
                    >
                      {{ rowSuccess[a.agency_id] }}
                    </Message>
                    <Message
                      v-else-if="rowError[a.agency_id]"
                      severity="error"
                      class="mt-2 text-xs"
                    >
                      {{ rowError[a.agency_id] }}
                    </Message>
                  </template>
                  <template v-else>
                    <div class="flex items-center justify-between gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="font-medium text-surface-900 truncate">
                          {{ a.name }}
                        </div>
                        <div class="text-sm text-surface-600 truncate">
                          {{ a.email }}
                        </div>
                      </div>
                      <div class="flex gap-2 flex-shrink-0">
                        <Button
                          icon="pi pi-pencil"
                          text
                          rounded
                          size="small"
                          @click="startEdit(a)"
                        />
                        <Button
                          icon="pi pi-trash"
                          text
                          rounded
                          severity="danger"
                          size="small"
                          @click="deleteAgency(a.agency_id)"
                        />
                      </div>
                    </div>
                    <Message
                      v-if="rowSuccess[a.agency_id]"
                      severity="success"
                      class="mt-2 text-xs"
                    >
                      {{ rowSuccess[a.agency_id] }}
                    </Message>
                    <Message
                      v-else-if="rowError[a.agency_id]"
                      severity="error"
                      class="mt-2 text-xs"
                    >
                      {{ rowError[a.agency_id] }}
                    </Message>
                  </template>
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>

      <Card
        v-if="isAgency"
        class="mt-6"
      >
        <template #title>
          <span class="text-xl font-semibold">Гиды агентства</span>
        </template>
        <template #content>
          <div class="grid md:grid-cols-2 gap-6 md:gap-8">
            <div class="space-y-4 max-w-md w-full">
              <h3 class="text-lg font-medium">
                Добавить гида
              </h3>
              <div class="grid grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-surface-700">Фамилия</label>
                  <InputText
                    v-model="guideLastName"
                    type="text"
                    placeholder="Фамилия"
                    class="w-full"
                  />
                </div>
                <div class="flex flex-col gap-2">
                  <label class="text-sm font-medium text-surface-700">Имя</label>
                  <InputText
                    v-model="guideFirstName"
                    type="text"
                    placeholder="Имя"
                    class="w-full"
                  />
                </div>
              </div>
              <div class="flex items-center gap-3">
                <Button
                  label="Добавить"
                  icon="pi pi-plus"
                  severity="secondary"
                  size="small"
                  @click="createGuide"
                />
                <Message
                  v-if="guideSuccess"
                  severity="success"
                  class="m-0"
                >
                  Успех
                </Message>
                <Message
                  v-if="guideError"
                  severity="error"
                  class="m-0"
                >
                  {{ guideError }}
                </Message>
              </div>
            </div>

            <div class="flex flex-col gap-3 min-w-0">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-surface-700">Поиск по фамилии</label>
                <IconField icon-position="left">
                  <InputIcon>
                    <i class="pi pi-search" />
                  </InputIcon>
                  <InputText
                    v-model="guideSearchQuery"
                    type="text"
                    placeholder="Введите фамилию..."
                    class="w-full"
                  />
                </IconField>
              </div>

              <ProgressSpinner
                v-if="guides.loading"
                class="mx-auto"
              />
              <Message
                v-else-if="guides.error"
                severity="error"
              >
                {{ guides.error }}
              </Message>
              <div
                v-else
                class="rounded-lg overflow-hidden flex flex-col"
                style="max-height: 24rem; border: 1px solid rgb(243 244 246);"
              >
                <div class="overflow-y-auto flex-1">
                  <div
                    v-if="filteredGuides.length === 0"
                    class="p-4 text-center text-surface-500"
                  >
                    {{ guideSearchQuery ? 'Гиды не найдены' : 'Нет гидов' }}
                  </div>
                  <div
                    v-for="g in filteredGuides"
                    :key="g.id"
                    class="p-3 hover:bg-surface-50 transition-colors"
                    style="border-bottom: 1px solid rgb(243 244 246);"
                  >
                    <template v-if="guideEditing[g.id]">
                      <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-surface-600">Фамилия</label>
                          <InputText
                            v-model="guideEditing[g.id].lastname"
                            type="text"
                            size="small"
                            class="w-full"
                            :disabled="guideSaving[g.id]"
                          />
                        </div>
                        <div class="flex flex-col gap-1">
                          <label class="text-xs font-medium text-surface-600">Имя</label>
                          <InputText
                            v-model="guideEditing[g.id].name"
                            type="text"
                            size="small"
                            class="w-full"
                            :disabled="guideSaving[g.id]"
                          />
                        </div>
                      </div>
                      <div class="flex gap-2 justify-end">
                        <Button
                          label="Сохранить"
                          icon="pi pi-check"
                          size="small"
                          :loading="guideSaving[g.id]"
                          :disabled="guideSaving[g.id]"
                          @click="saveGuideRow(g)"
                        />
                        <Button
                          label="Отмена"
                          icon="pi pi-times"
                          text
                          severity="secondary"
                          size="small"
                          :disabled="guideSaving[g.id]"
                          @click="cancelGuideEdit(g.id)"
                        />
                      </div>
                      <Message
                        v-if="guideRowSuccess[g.id]"
                        severity="success"
                        class="mt-2 text-xs"
                      >
                        {{ guideRowSuccess[g.id] }}
                      </Message>
                      <Message
                        v-else-if="guideRowError[g.id]"
                        severity="error"
                        class="mt-2 text-xs"
                      >
                        {{ guideRowError[g.id] }}
                      </Message>
                    </template>
                    <template v-else>
                      <div class="flex items-center justify-between">
                        <div class="flex-1">
                          <div class="font-medium text-surface-900">
                            {{ g.lastname }} {{ g.name }}
                          </div>
                        </div>
                        <div class="flex gap-2">
                          <Button
                            icon="pi pi-pencil"
                            text
                            rounded
                            size="small"
                            @click="startGuideEdit(g)"
                          />
                          <Button
                            icon="pi pi-trash"
                            text
                            rounded
                            severity="danger"
                            size="small"
                            @click="deleteGuide(g.id)"
                          />
                        </div>
                      </div>
                      <Message
                        v-if="guideRowSuccess[g.id]"
                        severity="success"
                        class="mt-2 text-xs"
                      >
                        {{ guideRowSuccess[g.id] }}
                      </Message>
                      <Message
                        v-else-if="guideRowError[g.id]"
                        severity="error"
                        class="mt-2 text-xs"
                      >
                        {{ guideRowError[g.id] }}
                      </Message>
                    </template>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>
