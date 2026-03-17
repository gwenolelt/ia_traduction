# 🌐 Traducteur Technique EN → FR

Outil de traduction technique anglais → français utilisant **Mistral AI** avec :
- **Glossaire intégré** — termes techniques imposés dans chaque traduction
- **Mémoire de traduction (RAG)** — réutilisation automatique des traductions similaires (≥ 90%)
- **Isolation intelligente du code** — Mistral détecte et préserve les blocs de code, SQL, markdown technique

---

## Architecture

```
ia_traduction/
├── server/                          # Back-end Express.js
│   ├── server.js                    # API REST (traduction, glossaire)
│   ├── markdownParser.js            # Extracteur regex (legacy, non utilisé)
│   ├── glossary.json                # Glossaire de termes imposés
│   ├── translation_memory.json      # Mémoire de traduction (RAG)
│   ├── .env                         # Variables d'environnement
│   └── package.json
├── client/                          # Front-end Vue.js 3 + Vite
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   └── components/
│   │       ├── TranslationPanel.vue # Zone de traduction
│   │       └── GlossaryManager.vue  # Gestion du glossaire
│   ├── index.html
│   ├── vite.config.js               # Proxy API → localhost:3000
│   └── package.json
└── README.md
```

## Pipeline de traduction

Le serveur utilise un pipeline en **2 phases** via Mistral AI :

```
Texte source
    │
    ▼
┌─────────────────────────────────────┐
│ PHASE 1 — Analyse (Mistral)        │
│ Sépare le texte du code/markdown   │
│ → JSON structuré { parts: [...] }  │
└─────────────────────────────────────┘
    │
    ├── type: "code"  →  conservé tel quel
    │
    └── type: "text"  →  traduction :
                          │
                          ├── RAG (similarité ≥ 90%)
                          │   + vérification glossaire
                          │
                          └── Mistral AI (si pas de match)
                              + glossaire injecté dans le prompt
```

---

## Prérequis

- **Node.js** ≥ 18
- Une **clé API Mistral** ([console.mistral.ai](https://console.mistral.ai))

---

## Installation

### 1. Cloner le dépôt

```bash
git clone <url-du-repo>
cd ia_traduction
```

### 2. Configurer le back-end

```bash
cd server
npm install
```

Créer ou éditer le fichier `.env` :

```env
# Configuration Mistral AI
MISTRAL_API_KEY=<ta-clé-api-mistral>
MISTRAL_MODEL=mistral-large-latest

# Port du serveur
PORT=3000
```

### 3. Configurer le front-end

```bash
cd ../client
npm install
```

---

## Lancement

Ouvrir **deux terminaux** :

**Terminal 1 — Serveur Express (port 3000) :**

```bash
cd server
npm run dev
```

**Terminal 2 — Client Vue.js (port 5173) :**

```bash
cd client
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

---

## Utilisation

### Traduire un texte

1. Coller le texte anglais dans la zone **« Texte source »**
2. Cliquer sur **🔄 Traduire**
3. La traduction apparaît dans la zone inférieure avec un badge indiquant la source :
   - ⚡ **Mémoire de traduction** — récupéré du RAG
   - 🤖 **Mistral AI** — traduit par l'IA
   - 🔄 **Mixte** — certains segments du RAG, d'autres de l'IA

### Gérer le glossaire

Le panneau latéral droit permet de gérer les termes imposés :

- **Ajouter un terme** : saisir le terme source (EN) et sa traduction (FR), puis cliquer sur « Ajouter »
- **Supprimer un terme** : cliquer sur le bouton ✕ à côté du terme

> **Priorité du glossaire** : le glossaire prime toujours sur la mémoire de traduction. Si un résultat RAG ne respecte pas le glossaire, il est rejeté et Mistral retraduit avec le glossaire injecté.

### Mémoire de traduction (RAG)

- Chaque traduction effectuée par Mistral est **automatiquement enregistrée** dans `translation_memory.json`
- Lors d'une future traduction, si un segment est **similaire à ≥ 90%** (coefficient de Dice) à un segment déjà traduit, la traduction existante est réutilisée
- Cela accélère les traductions répétitives et assure la cohérence

### Code et markdown

Le code est **automatiquement détecté et préservé** :

- Blocs de code (``` ... ```)
- Code SQL, JavaScript, Python brut (sans backticks)
- Le code en ligne (`code`) est conservé dans le contexte du texte

---

## API Endpoints

| Méthode  | Route                   | Description                                    |
|----------|-------------------------|------------------------------------------------|
| `GET`    | `/`                     | Diagnostic — vérifie que le serveur tourne     |
| `GET`    | `/api/glossary`         | Récupérer le glossaire complet                 |
| `POST`   | `/api/glossary`         | Ajouter/modifier un terme                      |
| `DELETE` | `/api/glossary/:source` | Supprimer un terme                             |
| `POST`   | `/api/translate`        | Traduire un texte EN → FR                      |

### Exemples d'appels API

**Traduire un texte :**

```bash
curl -X POST http://localhost:3000/api/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Cloud computing is revolutionizing the industry."}'
```

Réponse :

```json
{
  "translation": "L'informatique en nuage révolutionne l'industrie.",
  "source": "ai"
}
```

**Ajouter un terme au glossaire :**

```bash
curl -X POST http://localhost:3000/api/glossary \
  -H "Content-Type: application/json" \
  -d '{"source": "machine learning", "target": "apprentissage automatique"}'
```

---

## Technologies utilisées

| Composant   | Technologie                              |
|-------------|------------------------------------------|
| Back-end    | Node.js, Express.js                      |
| Front-end   | Vue.js 3, Vite                           |
| IA          | Mistral AI (via SDK OpenAI)              |
| RAG         | string-similarity (coefficient de Dice)  |
| Stockage    | Fichiers JSON (glossaire, TM)            |