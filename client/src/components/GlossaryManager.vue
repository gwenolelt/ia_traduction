<script setup>
import { ref, onMounted } from "vue";

// --- État ---
const glossary = ref({});
const newSource = ref("");
const newTarget = ref("");
const statusMessage = ref("");

// --- Charger le glossaire au montage ---
onMounted(fetchGlossary);

async function fetchGlossary() {
  try {
    const response = await fetch("/api/glossary");
    glossary.value = await response.json();
  } catch (err) {
    console.error("Erreur chargement glossaire :", err);
  }
}

// --- Ajouter un terme ---
async function addTerm() {
  if (!newSource.value.trim() || !newTarget.value.trim()) return;

  try {
    const response = await fetch("/api/glossary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: newSource.value,
        target: newTarget.value,
      }),
    });

    if (!response.ok) throw new Error("Erreur ajout");

    const data = await response.json();
    glossary.value = data.glossary;
    newSource.value = "";
    newTarget.value = "";
    showStatus("Terme ajouté ✓");
  } catch (err) {
    showStatus("Erreur lors de l'ajout");
  }
}

// --- Supprimer un terme ---
async function deleteTerm(source) {
  try {
    const response = await fetch(`/api/glossary/${encodeURIComponent(source)}`, {
      method: "DELETE",
    });

    if (!response.ok) throw new Error("Erreur suppression");

    const data = await response.json();
    glossary.value = data.glossary;
    showStatus("Terme supprimé ✓");
  } catch (err) {
    showStatus("Erreur lors de la suppression");
  }
}

// --- Message de statut temporaire ---
function showStatus(msg) {
  statusMessage.value = msg;
  setTimeout(() => {
    statusMessage.value = "";
  }, 2000);
}
</script>

<template>
  <aside class="glossary-panel">
    <h2>📖 Glossaire</h2>

    <!-- Formulaire d'ajout -->
    <form class="add-form" @submit.prevent="addTerm">
      <input
        v-model="newSource"
        type="text"
        placeholder="Terme anglais"
        required
      />
      <span class="arrow">→</span>
      <input
        v-model="newTarget"
        type="text"
        placeholder="Traduction française"
        required
      />
      <button type="submit" class="btn-add" :disabled="!newSource.trim() || !newTarget.trim()">
        Ajouter
      </button>
    </form>

    <!-- Message de statut -->
    <p v-if="statusMessage" class="status">{{ statusMessage }}</p>

    <!-- Liste des termes -->
    <div class="glossary-list">
      <div
        v-for="(target, source) in glossary"
        :key="source"
        class="glossary-item"
      >
        <div class="term">
          <span class="source">{{ source }}</span>
          <span class="arrow">→</span>
          <span class="target">{{ target }}</span>
        </div>
        <button class="btn-delete" title="Supprimer" @click="deleteTerm(source)">✕</button>
      </div>

      <p v-if="Object.keys(glossary).length === 0" class="empty">
        Aucun terme dans le glossaire.
      </p>
    </div>
  </aside>
</template>

<style scoped>
.glossary-panel {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 24px;
}

h2 {
  font-size: 1.2rem;
  margin-bottom: 16px;
}

/* --- Formulaire d'ajout --- */
.add-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.add-form input {
  flex: 1;
  min-width: 100px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  font-size: 0.85rem;
}

.add-form input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.arrow {
  color: var(--color-text-light);
  font-weight: bold;
}

.btn-add {
  padding: 8px 14px;
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-add:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* --- Statut --- */
.status {
  font-size: 0.8rem;
  color: var(--color-primary);
  margin-bottom: 8px;
}

/* --- Liste --- */
.glossary-list {
  max-height: 400px;
  overflow-y: auto;
}

.glossary-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border);
}

.glossary-item:last-child {
  border-bottom: none;
}

.term {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.88rem;
  flex: 1;
  min-width: 0;
}

.source {
  font-weight: 600;
  color: var(--color-text);
  word-break: break-word;
}

.target {
  color: var(--color-primary);
  word-break: break-word;
}

.btn-delete {
  background: none;
  border: none;
  color: var(--color-danger);
  font-size: 1rem;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  flex-shrink: 0;
}

.btn-delete:hover {
  background: #fef2f2;
}

.empty {
  text-align: center;
  color: var(--color-text-light);
  font-size: 0.85rem;
  padding: 16px 0;
}
</style>
