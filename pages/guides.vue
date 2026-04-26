<script setup lang="ts">
import { extractErrorMessage } from "@/types/errors";

definePageMeta({
  middleware: "auth",
  name: "guides",
});

const guides = useGuidesStore();

const guideLastName = ref("");
const guideFirstName = ref("");
const guideSearchQuery = ref("");

const guideSuccess = ref(false);
const guideError = ref("");

type GuideEditRow = { name: string; lastname: string };
const guideEditing: Record<string, GuideEditRow> = reactive({});
const guideSaving: Record<string, boolean> = reactive({});
const guideRowError: Record<string, string> = reactive({});
const guideRowSuccess: Record<string, string> = reactive({});

onMounted(() => {
  guides.fetchGuides();
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
  catch (e: unknown) {
    guideRowError[id] = extractErrorMessage(e, "Не удалось сохранить изменения");
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
  catch (e: unknown) {
    guideError.value = extractErrorMessage(e, "Не удалось создать гида");
  }
}

async function deleteGuide(id: string) {
  guideRowError[id] = "";
  guideRowSuccess[id] = "";
  try {
    await guides.deleteGuide(id);
    guideRowSuccess[id] = "Удалено";
  }
  catch (e: unknown) {
    guideRowError[id] = extractErrorMessage(e, "Не удалось удалить гида");
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
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Гиды
        </h1>
      </header>

      <Card>
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
                    {{ guideSearchQuery ? "Гиды не найдены" : "Нет гидов" }}
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
