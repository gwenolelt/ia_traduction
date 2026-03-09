# Traducteur Technique EN → FR (Étape 1)

Outil de traduction technique anglais → français utilisant Azure OpenAI (GPT-4o) avec glossaire intégré.

## Structure du projet

```
ia_traduction/
├── server/                  # Back-end Express
│   ├── server.js            # API REST (glossaire + traduction)
│   ├── glossary.json        # Glossaire (stockage local)
│   ├── .env                 # Variables d'environnement (Azure OpenAI)
│   └── package.json
├── client/                  # Front-end Vue.js 3
│   ├── src/
│   │   ├── main.js
│   │   ├── App.vue
│   │   └── components/
│   │       ├── TranslationPanel.vue
│   │       └── GlossaryManager.vue
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
└── README.md
```

## Prérequis

- **Node.js** >= 18
- Un **compte Azure OpenAI** avec un déploiement `gpt-4o`

## Installation

### 1. Configurer le back-end

```bash
cd server
npm install
```

Éditer le fichier `.env` avec tes identifiants Azure :

```env
AZURE_OPENAI_ENDPOINT=https://<ton-resource-name>.openai.azure.com
AZURE_OPENAI_API_KEY=<ta-clé-api>
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-10-21
```

### 2. Configurer le front-end

```bash
cd client
npm install
```

## Lancement

**Terminal 1 — Serveur Express :**

```bash
cd server
npm run dev
```

**Terminal 2 — Client Vue.js :**

```bash
cd client
npm run dev
```

Ouvrir **http://localhost:5173** dans le navigateur.

## API Endpoints

| Méthode | Route                      | Description                        |
|---------|----------------------------|------------------------------------|
| GET     | `/api/glossary`            | Récupérer le glossaire complet     |
| POST    | `/api/glossary`            | Ajouter/modifier un terme          |
| DELETE  | `/api/glossary/:source`    | Supprimer un terme                 |
| POST    | `/api/translate`           | Traduire un texte EN → FR          |