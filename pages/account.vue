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
const guideBadge = ref("");

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

type GuideEditRow = { name: string; lastname: string; badge_number: string };
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

function startGuideEdit(g: { id: string; name: string; lastname: string; badge_number: string }) {
  guideEditing[g.id] = { name: g.name, lastname: g.lastname, badge_number: g.badge_number };
  guideRowError[g.id] = "";
  guideRowSuccess[g.id] = "";
}

function cancelGuideEdit(id: string) {
  delete guideEditing[id];
  guideRowError[id] = "";
  guideRowSuccess[id] = "";
}

async function saveGuideRow(g: { id: string; name: string; lastname: string; badge_number: string }) {
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
    if (!draft.badge_number || draft.badge_number.length > 100) {
      throw new Error("Номер бейджа обязателен и до 100 символов");
    }
    if (draft.name !== g.name || draft.lastname !== g.lastname || draft.badge_number !== g.badge_number) {
      await guides.updateGuide(id, draft.name, draft.lastname, draft.badge_number);
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
    if (!guideBadge.value || guideBadge.value.length > 100) {
      throw new Error("Номер бейджа обязателен и до 100 символов");
    }
    await guides.createGuide(firstName, lastName, guideBadge.value);
    guideSuccess.value = true;
    guideLastName.value = "";
    guideFirstName.value = "";
    guideBadge.value = "";
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
</script>

<template>
  <div class="w-full min-h-screen bg-gray-50 py-16 px-6 md:px-12">
    <div class="max-w-6xl mx-auto">
      <header class="mb-12 text-center">
        <h1 class="text-3xl font-semibold text-gray-900">
          Настройки аккаунта
        </h1>
        <p class="text-sm text-gray-500 mt-2">
          Управляйте вашим паролем{{ isAdmin ? " и агентствами" : "" }} ниже.
        </p>
      </header>

      <div class="grid md:grid-cols-2 gap-16">
        <section class="flex-1 space-y-6 max-w-md w-full">
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2">
            Сменить пароль
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Старый пароль</label>
              <input
                v-model="oldPassword"
                type="password"
                class="input input-bordered w-full"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">Новый пароль</label>
              <input
                v-model="newPassword"
                type="password"
                class="input input-bordered w-full"
              >
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn btn-primary" @click="changePassword">
              Обновить пароль
            </button>
            <span v-if="passwordSuccess" class="text-green-600 text-sm">✓ Успех</span>
            <span v-if="passwordError" class="text-red-600 text-sm">⚠ {{ passwordError }}</span>
          </div>
        </section>

        <section
          v-if="isAdmin"
          class="flex-1 space-y-6 max-w-md w-full"
        >
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2">
            Создать агентство
          </h2>
          <div class="space-y-4">
            <div>
              <label class="block text-sm text-gray-600 mb-1">Email агентства</label>
              <input
                v-model="email"
                type="email"
                class="input input-bordered w-full"
              >
            </div>
            <div>
              <label class="block text-sm text-gray-600 mb-1">Название агентства</label>
              <input
                v-model="name"
                type="text"
                class="input input-bordered w-full"
              >
            </div>
          </div>
          <div class="flex items-center gap-3">
            <button class="btn btn-secondary" @click="createAgency">
              Создать агентство
            </button>
            <span v-if="agencySuccess" class="text-green-600 text-sm">✓ Успех</span>
            <span v-if="agencyError" class="text-red-600 text-sm">⚠ {{ agencyError }}</span>
          </div>
        </section>
        <section v-if="isAdmin" class="mt-16">
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2 mb-4">
            Все агентства
          </h2>

          <div v-if="agencies.loading" class="text-gray-500">
            Загрузка…
          </div>
          <div v-else-if="agencies.error" class="text-red-600">
            ⚠ {{ agencies.error }}
          </div>

          <div v-else class="space-y-3">
            <div
              v-for="a in agencies.items"
              :key="a.agency_id"
              class="bg-white rounded-lg border p-4 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-center"
            >
              <div>
                <label class="block text-xs text-gray-500 mb-1">Название</label>
                <template v-if="editing[a.agency_id]">
                  <input
                    v-model="editing[a.agency_id].name"
                    type="text"
                    class="input input-bordered w-full"
                    :disabled="saving[a.agency_id]"
                  >
                </template>
                <template v-else>
                  <div class="text-gray-900">
                    {{ a.name }}
                  </div>
                </template>
              </div>

              <div>
                <label class="block text-xs text-gray-500 mb-1">Email</label>
                <template v-if="editing[a.agency_id]">
                  <input
                    v-model="editing[a.agency_id].email"
                    type="email"
                    class="input input-bordered w-full"
                    :disabled="saving[a.agency_id]"
                  >
                </template>
                <template v-else>
                  <div class="text-gray-900 break-all">
                    {{ a.email }}
                  </div>
                </template>
              </div>

              <div class="flex gap-2 justify-start md:justify-end">
                <template v-if="editing[a.agency_id]">
                  <button
                    class="btn btn-sm btn-primary"
                    :disabled="saving[a.agency_id]"
                    @click="saveRow(a)"
                  >
                    {{ saving[a.agency_id] ? 'Сохранение…' : 'Сохранить' }}
                  </button>
                  <button
                    class="btn btn-sm"
                    :disabled="saving[a.agency_id]"
                    @click="cancelEdit(a.agency_id)"
                  >
                    Отмена
                  </button>
                </template>
                <template v-else>
                  <button class="btn btn-sm" @click="startEdit(a)">
                    Редактировать
                  </button>
                  <button class="btn btn-sm btn-error" @click="deleteAgency(a.agency_id)">
                    Удалить
                  </button>
                </template>
              </div>

              <div class="md:col-span-3 -mt-1">
                <span v-if="rowSuccess[a.agency_id]" class="text-green-600 text-sm">
                  ✓ {{ rowSuccess[a.agency_id] }}
                </span>
                <span v-else-if="rowError[a.agency_id]" class="text-red-600 text-sm">
                  ⚠ {{ rowError[a.agency_id] }}
                </span>
              </div>
            </div>

            <div v-if="!agencies.items.length" class="text-gray-500">
              Нет агентств.
            </div>
          </div>
        </section>

        <section v-if="isAgency" class="md:col-span-2">
          <h2 class="text-xl font-medium text-gray-800 border-b pb-2 mb-4">
            Гиды агентства
          </h2>

          <div class="grid md:grid-cols-2 gap-8">
            <div class="space-y-4 max-w-md w-full">
              <h3 class="text-lg font-medium">
                Добавить гида
              </h3>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm text-gray-600 mb-1">Фамилия</label>
                  <input
                    v-model="guideLastName"
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="Фамилия"
                  >
                </div>
                <div>
                  <label class="block text-sm text-gray-600 mb-1">Имя</label>
                  <input
                    v-model="guideFirstName"
                    type="text"
                    class="input input-bordered w-full"
                    placeholder="Имя"
                  >
                </div>
              </div>
              <div>
                <label class="block text-sm text-gray-600 mb-1">Номер бейджа</label>
                <input
                  v-model="guideBadge"
                  type="text"
                  class="input input-bordered w-full"
                >
              </div>
              <div class="flex items-center gap-3">
                <button class="btn btn-secondary" @click="createGuide">
                  Добавить
                </button>
                <span v-if="guideSuccess" class="text-green-600 text-sm">✓ Успех</span>
                <span v-if="guideError" class="text-red-600 text-sm">⚠ {{ guideError }}</span>
              </div>
            </div>

            <div>
              <div v-if="guides.loading" class="text-gray-500">
                Загрузка…
              </div>
              <div v-else-if="guides.error" class="text-red-600">
                ⚠ {{ guides.error }}
              </div>
              <div v-else class="space-y-3">
                <div
                  v-for="g in guides.items"
                  :key="g.id"
                  class="bg-white rounded-lg border p-4 grid gap-3"
                >
                  <template v-if="guideEditing[g.id]">
                    <div class="grid grid-cols-2 gap-3">
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Фамилия</label>
                        <input
                          v-model="guideEditing[g.id].lastname"
                          type="text"
                          class="input input-bordered w-full"
                          :disabled="guideSaving[g.id]"
                        >
                      </div>
                      <div>
                        <label class="block text-xs text-gray-500 mb-1">Имя</label>
                        <input
                          v-model="guideEditing[g.id].name"
                          type="text"
                          class="input input-bordered w-full"
                          :disabled="guideSaving[g.id]"
                        >
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Бейдж</label>
                      <input
                        v-model="guideEditing[g.id].badge_number"
                        type="text"
                        class="input input-bordered w-full"
                        :disabled="guideSaving[g.id]"
                      >
                    </div>
                  </template>
                  <template v-else>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">ФИО</label>
                      <div class="text-gray-900">
                        {{ g.lastname }} {{ g.name }}
                      </div>
                    </div>
                    <div>
                      <label class="block text-xs text-gray-500 mb-1">Бейдж</label>
                      <div class="text-gray-900 break-all">
                        {{ g.badge_number }}
                      </div>
                    </div>
                  </template>

                  <div class="flex gap-2 justify-start md:justify-end">
                    <template v-if="guideEditing[g.id]">
                      <button
                        class="btn btn-sm btn-primary"
                        :disabled="guideSaving[g.id]"
                        @click="saveGuideRow(g)"
                      >
                        {{ guideSaving[g.id] ? 'Сохранение…' : 'Сохранить' }}
                      </button>
                      <button
                        class="btn btn-sm"
                        :disabled="guideSaving[g.id]"
                        @click="cancelGuideEdit(g.id)"
                      >
                        Отмена
                      </button>
                    </template>
                    <template v-else>
                      <button class="btn btn-sm" @click="startGuideEdit(g)">
                        Редактировать
                      </button>
                      <button class="btn btn-sm btn-error" @click="deleteGuide(g.id)">
                        Удалить
                      </button>
                    </template>
                  </div>

                  <div class="md:col-span-3 -mt-1">
                    <span v-if="guideRowSuccess[g.id]" class="text-green-600 text-sm">
                      ✓ {{ guideRowSuccess[g.id] }}
                    </span>
                    <span v-else-if="guideRowError[g.id]" class="text-red-600 text-sm">
                      ⚠ {{ guideRowError[g.id] }}
                    </span>
                  </div>
                </div>

                <div v-if="!guides.items.length" class="text-gray-500">
                  Нет гидов.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
