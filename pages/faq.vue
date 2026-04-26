<script setup lang="ts">
import { faqSections as faqSectionsData } from "@/data/faq-sections";
// Page metadata
useHead({
  title: "Часто задаваемые вопросы - Innopolis TourBooking",
  meta: [
    { name: "description", content: "Инструкции и ответы на частые вопросы для агентств" },
  ],
});

// FAQ data with collapsible sections
const faqSections = ref(faqSectionsData);

// Active section tracking
const activeSection = ref<string | null>(null);
const expandedQuestions = ref<Set<string>>(new Set());

// Toggle section
function toggleSection(sectionId: string) {
  activeSection.value = activeSection.value === sectionId ? null : sectionId;
}

// Toggle question
function toggleQuestion(questionKey: string) {
  const newExpanded = new Set(expandedQuestions.value);
  if (newExpanded.has(questionKey)) {
    newExpanded.delete(questionKey);
  }
  else {
    newExpanded.add(questionKey);
  }
  expandedQuestions.value = newExpanded;
}

// Expand all questions in section
function _expandAllInSection(sectionId: string) {
  const section = faqSections.value.find(s => s.id === sectionId);
  if (!section)
    return;

  const newExpanded = new Set(expandedQuestions.value);
  section.questions.forEach((_, index) => {
    newExpanded.add(`${sectionId}-${index}`);
  });
  expandedQuestions.value = newExpanded;
}

// Collapse all questions in section
function _collapseAllInSection(sectionId: string) {
  const newExpanded = new Set(expandedQuestions.value);
  faqSections.value.forEach((section) => {
    if (section.id === sectionId) {
      section.questions.forEach((_, index) => {
        newExpanded.delete(`${sectionId}-${index}`);
      });
    }
  });
  expandedQuestions.value = newExpanded;
}
</script>

<template>
  <div class="w-full bg-surface-ground py-8 px-4 sm:px-6 md:px-8">
    <div class="max-w-6xl mx-auto">
      <!-- Header -->
      <header class="mb-8">
        <h1 class="text-3xl font-semibold text-surface-900 mb-2">
          Часто задаваемые вопросы
        </h1>
        <p class="text-sm text-surface-600">
          Подробные инструкции и ответы на вопросы для туристических агентств
        </p>
      </header>

      <!-- FAQ Sections -->
      <div class="space-y-6">
        <Card
          v-for="section in faqSections"
          :key="section.id"
          class="overflow-hidden"
        >
          <!-- Section Header -->
          <template #title>
            <div class="flex items-center gap-3 cursor-pointer" @click="toggleSection(section.id)">
              <i :class="section.icon" class="text-xl text-primary-600" />
              <div class="flex-1">
                <span class="text-xl font-semibold text-surface-900">{{ section.title }}</span>
                <p class="text-sm text-surface-500 mt-1">
                  {{ section.questions.length }} {{ section.questions.length === 1 ? 'вопрос' : section.questions.length < 5 ? 'вопроса' : 'вопросов' }}
                </p>
              </div>
            </div>
          </template>

          <template #content>
            <transition
              name="section-content"
              enter-active-class="transition-all duration-300 ease-out"
              enter-from-class="max-h-0 opacity-0"
              enter-to-class="max-h-screen opacity-100"
              leave-active-class="transition-all duration-300 ease-in"
              leave-from-class="max-h-screen opacity-100"
              leave-to-class="max-h-0 opacity-0"
            >
              <div
                v-if="activeSection === section.id"
                class="divide-y divide-surface-200"
              >
                <div
                  v-for="(question, index) in section.questions"
                  :key="index"
                  class="border-b border-surface-200 last:border-b-0"
                >
                  <!-- Question -->
                  <div
                    class="p-6 cursor-pointer hover:bg-surface-50 transition-colors"
                    @click="toggleQuestion(`${section.id}-${index}`)"
                  >
                    <div class="flex items-start justify-between gap-4">
                      <div class="flex-1">
                        <div class="flex items-start gap-3">
                          <i class="pi pi-question text-primary-600 mt-0.5" />
                          <h3 class="text-lg font-medium text-surface-900 leading-relaxed">
                            {{ question.question }}
                          </h3>
                        </div>
                      </div>
                      <i
                        class="pi transition-transform duration-300 text-surface-600 mt-1"
                        :class="expandedQuestions.has(`${section.id}-${index}`) ? 'pi-chevron-up' : 'pi-chevron-down'"
                      />
                    </div>
                  </div>

                  <!-- Answer -->
                  <transition
                    name="answer-content"
                    enter-active-class="transition-all duration-300 ease-out"
                    enter-from-class="max-h-0 opacity-0"
                    enter-to-class="max-h-screen opacity-100"
                    leave-active-class="transition-all duration-300 ease-in"
                    leave-from-class="max-h-screen opacity-100"
                    leave-to-class="max-h-0 opacity-0"
                  >
                    <div
                      v-if="expandedQuestions.has(`${section.id}-${index}`)"
                      class="px-6 pb-6 overflow-hidden"
                    >
                      <div class="bg-surface-50 rounded-lg p-6">
                        <!-- Answer Text -->
                        <div class="whitespace-pre-line text-surface-700 mb-4 leading-relaxed" v-html="question.answer" />

                        <!-- Link if present -->
                        <div v-if="question.link && question.link !== 'undefined'" class="mt-4">
                          <Button
                            :href="question.link"
                            target="_blank"
                            label="Скачать шаблон списка гостей"
                            icon="pi pi-download"
                            severity="primary"
                            class="w-full sm:w-auto"
                          />
                        </div>
                      </div>
                    </div>
                  </transition>
                </div>
              </div>
            </transition>
          </template>
        </Card>
      </div>

      <!-- Contact Support -->
      <Card class="mt-8 pb-20">
        <template #content>
          <div class="text-center">
            <div class="inline-flex items-center justify-center w-16 h-16 bg-primary-100 rounded-full mb-4">
              <i class="pi pi-question-circle text-3xl text-primary-600" />
            </div>
            <h2 class="text-2xl font-bold text-surface-900 mb-3">
              Остались вопросы?
            </h2>
            <p class="text-lg text-surface-700 mb-8">
              Наша команда поддержки всегда готова помочь вам.
            </p>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto mb-8">
              <div class="bg-surface-50 p-6 rounded-lg">
                <div class="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-full mb-4 mx-auto">
                  <i class="pi pi-telegram text-xl text-blue-600" />
                </div>
                <h3 class="font-semibold text-surface-900 mb-2 text-lg">
                  Telegram
                </h3>
                <p class="text-surface-600 mb-3">
                  @NPggL
                </p>
                <p class="text-sm text-surface-500">
                  Быстрая поддержка в мессенджере
                </p>
              </div>

              <div class="bg-surface-50 p-6 rounded-lg">
                <div class="flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-4 mx-auto">
                  <i class="pi pi-clock text-xl text-green-600" />
                </div>
                <h3 class="font-semibold text-surface-900 mb-2 text-lg">
                  Время работы
                </h3>
                <p class="text-surface-600 mb-3">
                  Пн-Пт: 10:00 - 18:00
                </p>
                <p class="text-sm text-surface-500">
                  Ответим в течение рабочего дня
                </p>
              </div>
            </div>

            <div class="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://t.me/NPggL" target="_blank">
                <Button
                  label="Написать в Telegram"
                  icon="pi pi-telegram"
                  size="large"
                />
              </a>
            </div>
          </div>
        </template>
      </Card>
    </div>
  </div>
</template>

<style scoped>
/* Transition classes for smooth animations */
.section-content-enter-active,
.section-content-leave-active {
  overflow: hidden;
}

.answer-content-enter-active,
.answer-content-leave-active {
  overflow: hidden;
}
</style>
