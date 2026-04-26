<script setup lang="ts">
import { getCellErrorClass, getColumnErrorText, isMobile } from "@/utils/guest-errors";

type GuestRow = {
  id?: string | number;
  name?: string;
  date_of_birth?: string;
  city?: string;
  phone?: string;
  email?: string;
  errors?: string[];
  row?: number;
};

type SheetError = {
  row: number;
  col: number;
  message: string;
};

const props = defineProps<{
  guests: GuestRow[];
  disabled?: boolean;
  sheetErrors?: SheetError[];
  showRowColumn?: boolean;
  showAgeColumn?: boolean;
  isAdmin?: boolean;
}>();

const emit = defineEmits<{
  (e: "cellEditComplete", payload: { data: GuestRow; field?: string; newValue?: unknown }): void;
  (e: "deleteGuest", guestId: string | number): void;
}>();

type CellEditCompleteEvent = { data?: GuestRow; field?: string; newValue?: unknown };

function onCellEditComplete(event: CellEditCompleteEvent) {
  const data = event?.data;
  const field = event?.field;
  if (!data || !field)
    return;

  const v = event?.newValue;
  if (field === "name")
    data.name = v == null ? "" : String(v);
  else if (field === "date_of_birth")
    data.date_of_birth = v == null ? "" : String(v);
  else if (field === "city")
    data.city = v == null ? "" : String(v);
  else if (field === "phone")
    data.phone = v == null ? "" : String(v);
  else if (field === "email")
    data.email = v == null ? "" : String(v);
  else if (field === "row")
    data.row = typeof v === "number" ? v : Number(v);
  else if (field === "age")
    (data as GuestRow & { age?: number }).age = typeof v === "number" ? v : Number(v);

  emit("cellEditComplete", {
    data,
    field,
    newValue: event?.newValue,
  });
}

function onDeleteGuest(guest: GuestRow) {
  if (!guest.id) {
    return;
  }
  emit("deleteGuest", guest.id);
}
</script>

<template>
  <DataTable
    :value="props.guests"
    class="gl-preview-table"
    :edit-mode="props.isAdmin ? 'none' : 'cell'"
    scrollable
    scroll-height="32rem"
    :row-class="(row: GuestRow) => row?.errors?.length ? 'p-invalid' : ''"
    @cell-edit-complete="onCellEditComplete"
  >
    <Column
      v-if="isAdmin"
      :style="{ width: '4rem' }"
    >
      <template #body="{ data }">
        <Button
          icon="pi pi-trash"
          severity="danger"
          size="small"
          text
          rounded
          :disabled="props.disabled"
          @click="onDeleteGuest(data)"
        />
      </template>
    </Column>

    <Column header="#" :style="{ width: '3rem' }">
      <template #body="{ index }">
        {{ index + 1 }}
      </template>
    </Column>

    <Column
      v-if="showRowColumn"
      field="row"
      header="Строка"
      :style="{ width: '5rem' }"
    />

    <Column
      field="name"
      header="Имя"
      :style="{ width: '16rem' }"
    >
      <template #body="{ data }">
        <div>
          <span
            v-tooltip="!isMobile() && getColumnErrorText(data, 1, props.sheetErrors) ? { value: getColumnErrorText(data, 1, props.sheetErrors), showDelay: 1000 } : ''"
            class="gl-cell"
            :class="getCellErrorClass(data, 1, props.sheetErrors)"
          >
            {{ data.name }}
          </span>
          <div
            v-if="isMobile() && getColumnErrorText(data, 1, props.sheetErrors)"
            class="text-xs text-red-600 mt-1 break-words"
          >
            {{ getColumnErrorText(data, 1, props.sheetErrors) }}
          </div>
        </div>
      </template>
      <template #editor="{ data, field }">
        <InputText
          v-model="data[field]"
          size="small"
          class="w-full"
          :disabled="props.disabled || props.isAdmin"
        />
      </template>
    </Column>

    <Column
      field="date_of_birth"
      header="ДД.ММ.ГГГГ"
      :style="{ width: '10rem' }"
    >
      <template #body="{ data }">
        <div>
          <span
            v-tooltip="!isMobile() && getColumnErrorText(data, 2, props.sheetErrors) ? { value: getColumnErrorText(data, 2, props.sheetErrors), showDelay: 1000 } : ''"
            class="gl-cell"
            :class="getCellErrorClass(data, 2, props.sheetErrors)"
          >
            {{ data.date_of_birth }}
          </span>
          <div
            v-if="isMobile() && getColumnErrorText(data, 2, props.sheetErrors)"
            class="text-xs text-red-600 mt-1 break-words"
          >
            {{ getColumnErrorText(data, 2, props.sheetErrors) }}
          </div>
        </div>
      </template>
      <template #editor="{ data, field }">
        <InputText
          v-model="data[field]"
          size="small"
          class="w-full"
          :disabled="props.disabled || props.isAdmin"
        />
      </template>
    </Column>

    <Column
      v-if="showAgeColumn"
      field="age"
      header="Возраст"
      :style="{ width: '6rem' }"
    />

    <Column
      field="city"
      header="Город"
      :style="{ width: '12rem' }"
    >
      <template #body="{ data }">
        <div>
          <span
            v-tooltip="!isMobile() && getColumnErrorText(data, 3, props.sheetErrors) ? { value: getColumnErrorText(data, 3, props.sheetErrors), showDelay: 1000 } : ''"
            class="gl-cell"
            :class="getCellErrorClass(data, 3, props.sheetErrors)"
          >
            {{ data.city }}
          </span>
          <div
            v-if="isMobile() && getColumnErrorText(data, 3, props.sheetErrors)"
            class="text-xs text-red-600 mt-1 break-words"
          >
            {{ getColumnErrorText(data, 3, props.sheetErrors) }}
          </div>
        </div>
      </template>
      <template #editor="{ data, field }">
        <InputText
          v-model="data[field]"
          size="small"
          class="w-full"
          :disabled="props.disabled || props.isAdmin"
        />
      </template>
    </Column>

    <Column
      field="phone"
      header="Телефон"
      :style="{ width: '12rem' }"
    >
      <template #body="{ data }">
        <div>
          <span
            v-tooltip="!isMobile() && getColumnErrorText(data, 4, props.sheetErrors) ? { value: getColumnErrorText(data, 4, props.sheetErrors), showDelay: 1000 } : ''"
            class="gl-cell"
            :class="getCellErrorClass(data, 4, props.sheetErrors)"
          >
            {{ data.phone }}
          </span>
          <div
            v-if="isMobile() && getColumnErrorText(data, 4, props.sheetErrors)"
            class="text-xs text-red-600 mt-1 break-words"
          >
            {{ getColumnErrorText(data, 4, props.sheetErrors) }}
          </div>
        </div>
      </template>
      <template #editor="{ data, field }">
        <InputText
          v-model="data[field]"
          size="small"
          class="w-full"
          :disabled="props.disabled || props.isAdmin"
        />
      </template>
    </Column>

    <Column
      field="email"
      header="Email"
      :style="{ width: '15rem' }"
    >
      <template #body="{ data }">
        <div>
          <span
            v-tooltip="!isMobile() && getColumnErrorText(data, 5, props.sheetErrors) ? { value: getColumnErrorText(data, 5, props.sheetErrors), showDelay: 1000 } : ''"
            class="gl-cell"
            :class="getCellErrorClass(data, 5, props.sheetErrors)"
          >
            {{ data.email }}
          </span>
          <div
            v-if="isMobile() && getColumnErrorText(data, 5, props.sheetErrors)"
            class="text-xs text-red-600 mt-1 break-words"
          >
            {{ getColumnErrorText(data, 5, props.sheetErrors) }}
          </div>
        </div>
      </template>
      <template #editor="{ data, field }">
        <InputText
          v-model="data[field]"
          size="small"
          class="w-full"
          :disabled="props.disabled || props.isAdmin"
        />
      </template>
    </Column>
  </DataTable>
</template>

<style scoped>
.gl-preview-table :deep(table) {
  table-layout: fixed;
  width: 100%;
}

.gl-preview-table :deep(th),
.gl-preview-table :deep(td) {
  overflow: hidden;
  text-overflow: ellipsis;
}

.gl-preview-table :deep(.p-cell-editor),
.gl-preview-table :deep(.p-inputtext) {
  width: 100%;
  max-width: 100%;
}

.gl-cell {
  display: block;
  width: 100%;
  min-height: 1.75rem;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
}

.gl-cell--error {
  background: rgba(220, 38, 38, 0.08);
  outline: 1px solid rgba(220, 38, 38, 0.35);
}
</style>
