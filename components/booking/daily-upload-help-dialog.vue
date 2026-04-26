<script setup lang="ts">
defineProps<{
  visible: boolean;
}>();

defineEmits<{
  (e: "close"): void;
}>();

const backdropMousedown = ref(false);
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-[600] p-4"
    @mousedown="backdropMousedown = ($event.target === $event.currentTarget)"
    @click.self="backdropMousedown && $emit('close')"
  >
    <Card
      class="w-full max-w-4xl overflow-hidden relative"
      @click.stop
    >
      <template #header>
        <div class="flex items-center justify-between p-4 pb-2">
          <h3 class="text-lg font-semibold m-0">
            Инструкция: Загрузка единого списка на день
          </h3>
          <Button
            icon="pi pi-times"
            text
            rounded
            size="small"
            @click="$emit('close')"
          />
        </div>
      </template>
      <template #content>
        <div class="space-y-4 max-h-[calc(90vh-8rem)] overflow-y-auto p-4">
          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              📋 Назначение
            </h3>
            <p class="text-sm text-gray-600">
              Единый список на день позволяет загрузить несколько бронирований из одного Excel файла. Каждый лист в файле представляет отдельное бронирование.
            </p>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              📝 Формат файла
            </h3>
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
              <p class="text-sm font-medium mb-2">
                Каждый лист должен содержать:
              </p>
              <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li><strong>Строка 1:</strong> Дата (в формате ДД.ММ.ГГГГ)</li>
                <li><strong>Строка 2:</strong> Время таймслота (в формате ЧЧ:ММ, только :00 или :30)</li>
                <li><strong>Строка 3:</strong> Точное время (в формате ЧЧ:ММ)</li>
                <li><strong>Строка 4:</strong> Радиогиды (да/нет)</li>
                <li><strong>Строка 5:</strong> Сборная (да/нет)</li>
                <li><strong>Строка 6:</strong> Водитель (необязательно)</li>
                <li><strong>Строка 7:</strong> Сопровождающий (необязательно)</li>
                <li><strong>Далее:</strong> Таблица с гостями</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              👥 Таблица гостей
            </h3>
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
              <p class="text-sm font-medium mb-2">
                Таблица должна содержать следующие колонки:
              </p>
              <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li><strong>Имя</strong> - Полное имя гостя</li>
                <li><strong>Дата рождения</strong> - В формате ДД.ММ.ГГГГ (гость должен быть не младше 6 лет)</li>
                <li><strong>Город</strong> - Город проживания</li>
                <li><strong>Телефон</strong> - Номер телефона</li>
                <li><strong>Почта</strong> - Email (необязательно)</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              Процесс загрузки
            </h3>
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
              <ol class="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                <li>Нажмите кнопку "Единый список"</li>
                <li>Выберите подготовленный Excel файл</li>
                <li>Система покажет предпросмотр с возможностью редактирования</li>
                <li>При наличии ошибок - исправьте их прямо в интерфейсе</li>
                <li>Нажмите "Валидировать" для проверки данных</li>
                <li>Подтвердите загрузку для создания бронирований</li>
              </ol>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              📋 Шаблон
            </h3>
            <div class="bg-blue-50 border border-blue-200 rounded p-4">
              <p class="text-sm font-medium mb-3 text-blue-900">
                Готовый шаблон для загрузки:
              </p>
              <a
                href="https://docs.google.com/spreadsheets/d/1uWq-sqEbH5Gq9AFw7xQ2iGhDooZqAHEy/edit?usp=sharing&ouid=112417008209025746946&rtpof=true&sd=true"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <i class="pi pi-external-link" />
                Открыть шаблон
              </a>
              <p class="text-xs text-blue-700 mt-2">
                Скачайте или скопируйте шаблон для правильного форматирования данных
              </p>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              🔄 Работа с ошибками
            </h3>
            <div class="bg-red-50 border border-red-200 rounded p-3">
              <p class="text-sm font-medium mb-2 text-red-900">
                Как работать с ошибками:
              </p>
              <ul class="text-sm text-red-700 space-y-1 list-disc list-inside">
                <li><strong>На ПК:</strong> Наведите курсор на красную ячейку → увидите подробности ошибки</li>
                <li><strong>На мобильных:</strong> Нажмите на красную ячейку → увидите подробности ошибки</li>
              </ul>
            </div>
          </div>

          <div>
            <h3 class="text-lg font-semibold text-amber-700 mb-2">
              ✅ Результат
            </h3>
            <p class="text-sm text-gray-600">
              После загрузки вы увидите отчет о созданных бронированиях и найденных существующих.
              В случае ошибок будет показано подробное описание проблем с указанием строк и колонок.
            </p>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex gap-2 justify-end pt-3 pb-3">
          <Button
            label="Понятно"
            severity="secondary"
            @click="$emit('close')"
          />
        </div>
      </template>
    </Card>
  </div>
</template>
