<script setup>
import GlossaryManager from "./components/GlossaryManager.vue";
import TranslationPanel from "./components/TranslationPanel.vue";
</script>

<template>
  <div class="app-container">
    <header>
      <h1>🌐 Traducteur Technique EN → FR</h1>
      <p class="subtitle">Traduction assistée par IA avec glossaire intégré</p>
    </header>

    <main>
      <div class="panels">
        <!-- Panneau de traduction (zone principale) -->
        <TranslationPanel />

        <!-- Panneau de gestion du glossaire (barre latérale) -->
        <GlossaryManager />
      </div>
    </main>
  </div>
</template>

<style>
/* --- Reset & Variables --- */
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

:root {
  --color-bg: #f5f7fa;
  --color-surface: #ffffff;
  --color-primary: #3b82f6;
  --color-primary-hover: #2563eb;
  --color-danger: #ef4444;
  --color-danger-hover: #dc2626;
  --color-text: #1e293b;
  --color-text-light: #64748b;
  --color-border: #e2e8f0;
  --radius: 8px;
}

body {
  font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
}

/* --- Layout --- */
.app-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}

header {
  text-align: center;
  margin-bottom: 32px;
}

header h1 {
  font-size: 1.8rem;
  margin-bottom: 4px;
}

.subtitle {
  color: var(--color-text-light);
  font-size: 0.95rem;
}

.panels {
  display: grid;
  grid-template-columns: 1fr 360px;
  gap: 24px;
  align-items: start;
}

@media (max-width: 900px) {
  .panels {
    grid-template-columns: 1fr;
  }
}
</style>
