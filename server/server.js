require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Chemin vers le fichier glossaire ---
const GLOSSARY_PATH = path.join(__dirname, "glossary.json");

// =============================================
// ROUTE RACINE (diagnostic)
// =============================================
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "Serveur de traduction opérationnel.", routes: ["/api/glossary", "/api/translate"] });
});

// =============================================
// ROUTES GLOSSAIRE (CRUD)
// =============================================

/**
 * GET /api/glossary
 * Renvoie le glossaire complet sous forme d'objet JSON.
 */
app.get("/api/glossary", (req, res) => {
  try {
    const data = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const glossary = JSON.parse(data);
    res.json(glossary);
  } catch (err) {
    console.error("Erreur lecture glossaire :", err.message);
    res.status(500).json({ error: "Impossible de lire le glossaire." });
  }
});

/**
 * POST /api/glossary
 * Ajoute ou met à jour une entrée dans le glossaire.
 * Body attendu : { "source": "terme EN", "target": "terme FR" }
 */
app.post("/api/glossary", (req, res) => {
  const { source, target } = req.body;

  if (!source || !target) {
    return res.status(400).json({ error: "Les champs 'source' et 'target' sont requis." });
  }

  try {
    const data = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const glossary = JSON.parse(data);

    // Ajout / mise à jour du terme
    glossary[source.trim()] = target.trim();

    fs.writeFileSync(GLOSSARY_PATH, JSON.stringify(glossary, null, 2), "utf-8");
    res.json({ message: "Terme ajouté avec succès.", glossary });
  } catch (err) {
    console.error("Erreur écriture glossaire :", err.message);
    res.status(500).json({ error: "Impossible de mettre à jour le glossaire." });
  }
});

/**
 * DELETE /api/glossary/:source
 * Supprime une entrée du glossaire par son terme source.
 */
app.delete("/api/glossary/:source", (req, res) => {
  const source = req.params.source;

  try {
    const data = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const glossary = JSON.parse(data);

    if (!(source in glossary)) {
      return res.status(404).json({ error: `Terme "${source}" introuvable dans le glossaire.` });
    }

    delete glossary[source];
    fs.writeFileSync(GLOSSARY_PATH, JSON.stringify(glossary, null, 2), "utf-8");
    res.json({ message: "Terme supprimé.", glossary });
  } catch (err) {
    console.error("Erreur suppression glossaire :", err.message);
    res.status(500).json({ error: "Impossible de supprimer le terme." });
  }
});

// =============================================
// ROUTE TRADUCTION
// =============================================

/**
 * POST /api/translate
 * Traduit un texte anglais → français en respectant le glossaire.
 * Body attendu : { "text": "texte à traduire" }
 */
app.post("/api/translate", async (req, res) => {
  const { text } = req.body;

  if (!text || !text.trim()) {
    return res.status(400).json({ error: "Le champ 'text' est requis." });
  }

  try {
    // 1. Charger le glossaire
    const glossaryData = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const glossary = JSON.parse(glossaryData);

    // 2. Construire les règles du glossaire pour le prompt
    const glossaryEntries = Object.entries(glossary);
    let glossaryInstructions = "";

    if (glossaryEntries.length > 0) {
      const rules = glossaryEntries
        .map(([source, target]) => `  - "${source}" → "${target}"`)
        .join("\n");

      glossaryInstructions = `
GLOSSAIRE OBLIGATOIRE — Tu DOIS utiliser ces traductions exactes chaque fois que ces termes apparaissent dans le texte source :
${rules}

Si un terme du glossaire apparaît dans le texte, utilise TOUJOURS la traduction indiquée ci-dessus, sans exception.`;
    }

    // 3. Appeler Mistral AI avec le prompt enrichi du glossaire
    const client = new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: "https://api.mistral.ai/v1",
    });

    const response = await client.chat.completions.create({
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      messages: [
        {
          role: "system",
          content: `Tu es un traducteur technique professionnel anglais → français.
Traduis le texte fourni par l'utilisateur de l'anglais vers le français.
Respecte le sens, le ton et le niveau technique du texte original.
Ne rajoute aucune explication, aucun commentaire. Renvoie uniquement la traduction.
${glossaryInstructions}`,
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3, // Basse température pour plus de cohérence/fidélité
    });

    const translation = response.choices[0].message.content.trim();
    res.json({ translation });
  } catch (err) {
    // Log complet pour faciliter le débogage côté serveur
    console.error("Erreur traduction :", err.message);
    if (err.status) console.error("  Status HTTP :", err.status);
    if (err.error) console.error("  Détail Mistral :", JSON.stringify(err.error, null, 2));

    // Renvoi du message d'erreur réel au front pour affichage
    const detail = err.error?.message || err.message || "Erreur inconnue";
    res.status(500).json({ error: `Erreur Mistral : ${detail}` });
  }
});

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================
app.listen(PORT, () => {
  console.log(`Serveur démarré sur http://localhost:${PORT}`);
});
