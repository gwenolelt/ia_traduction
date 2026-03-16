<script setup>
import { ref } from "vue";

// --- État ---
const sourceText = ref("");
const translatedText = ref("");
const translationSource = ref(""); // "memory", "ai" ou "mixed"
const translationTime = ref(null); // Temps de réponse en ms/s
const isLoading = ref(false);
const errorMessage = ref("");

// --- Traduction ---
async function translate() {
  if (!sourceText.value.trim()) return;

  isLoading.value = true;
  errorMessage.value = "";
  translatedText.value = "";
  translationSource.value = "";
  translationTime.value = null;

  const startTime = performance.now();

  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: sourceText.value }),
    });

    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("Réponse invalide du serveur.");
    }

    if (!response.ok) {
      throw new Error(data.error || "Erreur serveur");
    }

    translatedText.value = data.translation;
    translationSource.value = data.source;
    translationTime.value = ((performance.now() - startTime) / 1000).toFixed(2);
  } catch (err) {
    errorMessage.value = err.message;
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <section class="translation-panel">
    <h2>Traduction</h2>

    <!-- Zone de texte source -->
    <div class="textarea-group">
      <label for="source">Texte source (anglais)</label>
      <textarea
        id="source"
        v-model="sourceText"
        placeholder="Colle ici le texte technique en anglais à traduire..."
        rows="10"
      ></textarea>
    </div>

    <!-- Bouton traduire -->
    <button class="btn-primary" :disabled="isLoading || !sourceText.trim()" @click="translate">
      <span v-if="isLoading">⏳ Traduction en cours...</span>
      <span v-else>🔄 Traduire</span>
    </button>

    <!-- Erreur éventuelle -->
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <!-- Zone de texte traduit -->
    <div class="textarea-group">
      <label for="result">Traduction (français)</label>
      <textarea
        id="result"
        :value="translatedText"
        placeholder="La traduction apparaîtra ici..."
        rows="10"
        readonly
      ></textarea>
    </div>

    <!-- Feedback Source & Temps -->
    <div v-if="translatedText && !isLoading" class="feedback-stats">
      <span
        v-if="translationSource === 'memory'"
        class="badge badge-success"
      >
        ⚡ Source : Mémoire de traduction
      </span>
      <span
        v-else-if="translationSource === 'ai'"
        class="badge badge-info"
      >
        🤖 Source : Mistral AI
      </span>
      <span
        v-else-if="translationSource === 'mixed'"
        class="badge badge-warning"
      >
        🔄 Source : Mixte (Mémoire + IA)
      </span>
      <span class="time-info" v-if="translationTime">
        Temps de réponse : {{ translationTime }} s
      </span>
    </div>
  </section>
</template>

<style scoped>
.translation-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 24px;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 16px;
}

.textarea-group {
  margin-bottom: 16px;
}

.textarea-group label {
  display: block;
  font-weight: 600;
  font-size: 0.85rem;
  margin-bottom: 6px;
  color: var(--color-text-light);
}

textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-family: inherit;
  font-size: 0.95rem;
  resize: vertical;
  line-height: 1.5;
}

textarea:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

textarea[readonly] {
  background: #f8fafc;
}

.btn-primary {
  display: inline-block;
  padding: 10px 24px;
  margin-bottom: 16px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: var(--color-danger);
  font-size: 0.9rem;
  margin-bottom: 12px;
}

/* --- Feedback Stats --- */
.feedback-stats {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
  font-size: 0.85rem;
}

.badge {
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 600;
}

.badge-success {
  background-color: #dcfce7;
  color: #166534;
}

.badge-info {
  background-color: #dbeafe;
  color: #1e40af;
}

.badge-warning {
  background-color: #fef9c3;
  color: #854d0e;
}

.time-info {
  color: var(--color-text-light);
}
</style>
