<script setup lang="ts">
import { extractErrorMessage } from "@/types/errors";

definePageMeta({
  middleware: "auth",
  name: "agencies",
});

const agencies = useAgenciesStore();
const users = useUsersStore();

const email = ref("");
const name = ref("");

const agencySuccess = ref(false);
const agencyError = ref("");

async function createAgency() {
  agencySuccess.value = false;
  agencyError.value = "";

  try {
    await users.createAgency({ email: email.value, agency_name: name.value });
    agencySuccess.value = true;
    email.value = "";
    name.value = "";
  }
  catch (err: unknown) {
    agencyError.value = extractErrorMessage(err, "Не удалось создать агентство");
  }
}

onMounted(() => {
  agencies.fetchAgencies();
});

watch(() => agencySuccess.value, (ok) => {
  if (ok) {
    agencies.fetchAgencies();
  }
});

type EditRow = { name: string; email: string };
const editing: Record<string, EditRow> = reactive({});
const saving: Record<string, boolean> = reactive({});
const rowError: Record<string, string> = reactive({});
const rowSuccess: Record<string, string> = reactive({});

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
  catch (e: unknown) {
    rowError[id] = extractErrorMessage(e, "Не удалось сохранить изменения");
  }
  finally {
    saving[id] = false;
  }
}

const showDeleteConfirm = ref(false);
const agencyToDelete = ref<{ id: string; name: string } | null>(null);

async function deleteAgency(id: string, agencyName: string) {
  agencyToDelete.value = { id, name: agencyName };
  showDeleteConfirm.value = true;
}

async function confirmDelete() {
  if (!agencyToDelete.value) {
    return;
  }
  const { id } = agencyToDelete.value;
  rowError[id] = "";
  rowSuccess[id] = "";
  try {
    await agencies.removeAgency(id);
    rowSuccess[id] = "Удалено";
  }
  catch (e: unknown) {
    rowError[id] = extractErrorMessage(e, "Не удалось удалить агентство");
  }
  finally {
    showDeleteConfirm.value = false;
    agencyToDelete.value = null;
  }
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  agencyToDelete.value = null;
}
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Агентства
        </h1>
      </header>

      <div class="grid md:grid-cols-2 gap-6">
        <Card>
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

        <Card>
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
                          @click="deleteAgency(a.agency_id, a.name)"
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

      <div
        v-if="showDeleteConfirm"
        class="fixed inset-0 flex items-center justify-center z-50"
        style="
          background-color: rgba(0, 0, 0, 0.5);
        "
      >
        <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <div class="flex items-center mb-4">
            <i class="pi pi-exclamation-triangle text-yellow-500 text-2xl mr-3" />
            <h3 class="text-lg font-semibold text-gray-900">
              Подтверждение удаления
            </h3>
          </div>
          <p class="text-gray-600 mb-6">
            Вы уверены, что хотите удалить агентство "{{ agencyToDelete?.name }}"? Все данные, в том числе записи об экскурсиях и бронированих будут удалены!
          </p>
          <div class="flex justify-end gap-3">
            <Button
              label="Отмена"
              severity="secondary"
              class="p-button-secondary"
              @click="cancelDelete"
            />
            <Button
              label="Удалить"
              severity="danger"
              class="p-button-danger"
              @click="confirmDelete"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
