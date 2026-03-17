require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const stringSimilarity = require("string-similarity");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Chemin vers le fichier glossaire ---
const GLOSSARY_PATH = path.join(__dirname, "glossary.json");
const TM_PATH = path.join(__dirname, "translation_memory.json");

// --- Client Mistral (via SDK OpenAI) ---
const client = new OpenAI({
  apiKey: process.env.MISTRAL_API_KEY,
  baseURL: "https://api.mistral.ai/v1",
});
const MISTRAL_MODEL = process.env.MISTRAL_MODEL || "mistral-large-latest";

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
// ROUTE TRADUCTION — Pipeline en 2 phases
// =============================================

/**
 * PHASE 1 : Analyse du texte par Mistral
 *
 * Envoie le texte brut à Mistral et lui demande de retourner un JSON
 * structuré séparant les parties texte des parties code/markdown.
 *
 * @param {string} text — Le texte source complet
 * @returns {Array<{type: string, content: string}>} — Tableau de parts
 */
async function analyzeText(text) {
  console.log("[PHASE 1] Analyse du texte par Mistral...");

  const response = await client.chat.completions.create({
    model: MISTRAL_MODEL,
    messages: [
      {
        role: "system",
        content: `Tu es un analyseur de texte technique. Ta tâche est de séparer un texte en parties distinctes : le texte en langage naturel et le code/markdown technique.

RÈGLES STRICTES :
1. Tu dois retourner UNIQUEMENT un JSON valide, sans aucun commentaire ni texte autour.
2. Le JSON doit avoir exactement cette structure : { "parts": [...] }
3. Chaque élément du tableau "parts" doit avoir :
   - "type" : soit "text" (texte en langage naturel à traduire), soit "code" (code ou markdown technique à conserver tel quel)
   - "content" : le contenu exact de cette partie, caractère pour caractère
4. Les blocs de code délimités par des backticks (\`\`\` ... \`\`\`) sont de type "code".
5. Le code en ligne entouré de backticks simples (\`...\`) fait partie du texte qui l'entoure — garde-le dans le segment "text" avec son contexte.
6. Les lignes qui ressemblent à du code brut (SQL, JavaScript, Python, etc.) sans backticks sont de type "code".
7. Les titres Markdown (#, ##, etc.), listes, gras (**), italique (*) sont de type "text" — c'est du formatage de texte, pas du code.
8. IMPORTANT : la concaténation de tous les "content" dans l'ordre doit redonner EXACTEMENT le texte original, octet par octet. Ne perds aucun caractère, aucun espace, aucun saut de ligne.
9. Ne fusionne PAS les blocs de code consécutifs s'ils sont séparés par du texte.
10. Si le texte ne contient aucun code, renvoie un seul élément de type "text".

Exemple d'entrée :
Here is an example:
\`\`\`sql
SELECT * FROM users;
\`\`\`
This query returns all users.

Exemple de sortie attendue :
{"parts":[{"type":"text","content":"Here is an example:\\n"},{"type":"code","content":"\`\`\`sql\\nSELECT * FROM users;\\n\`\`\`"},{"type":"text","content":"\\nThis query returns all users."}]}`
      },
      {
        role: "user",
        content: text,
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0].message.content.trim();
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error("[PHASE 1] Échec du parsing JSON, fallback texte intégral.", e.message);
    // Fallback : tout le texte est considéré comme du texte à traduire
    return [{ type: "text", content: text }];
  }

  if (!parsed.parts || !Array.isArray(parsed.parts)) {
    console.warn("[PHASE 1] Format inattendu, fallback texte intégral.");
    return [{ type: "text", content: text }];
  }

  console.log(`[PHASE 1] ${parsed.parts.length} parties détectées (${parsed.parts.filter(p => p.type === "code").length} code, ${parsed.parts.filter(p => p.type === "text").length} texte).`);
  return parsed.parts;
}

/**
 * PHASE 2 : Traduction d'un segment de texte
 *
 * 1. Cherche dans le RAG (TM) un segment similaire (> 0.9)
 * 2. Si trouvé ET conforme au glossaire → utilise la traduction RAG
 * 3. Sinon → traduit via Mistral avec le glossaire injecté
 *
 * @param {string} segment — Le segment de texte à traduire
 * @param {Object} glossary — Le glossaire {source: target}
 * @param {Array} tmModel — La mémoire de traduction
 * @param {Array} tmSources — Les sources de la TM (pour la recherche de similarité)
 * @returns {{ translated: string, source: string, newEntry: {source, target}|null }}
 */
async function translateSegment(segment, glossary, tmModel, tmSources) {
  const glossaryEntries = Object.entries(glossary);

  // --- RAG : chercher dans la Mémoire de Traduction ---
  let bestMatch = null;
  let matchScore = 0;
  if (tmSources.length > 0) {
    const match = stringSimilarity.findBestMatch(segment, tmSources);
    matchScore = match.bestMatch.rating;
    if (matchScore >= 0.9) {
      bestMatch = tmModel.find(entry => entry.source === match.bestMatch.target);
    }
  }

  // --- Vérification du glossaire sur le résultat RAG ---
  if (bestMatch && glossaryEntries.length > 0) {
    let glossaryRespected = true;
    for (const [source, target] of glossaryEntries) {
      const escapedSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const sourceRegex = new RegExp(`\\b(${escapedSource})\\b`, "gi");

      if (sourceRegex.test(segment)) {
        if (!bestMatch.target.toLowerCase().includes(target.toLowerCase())) {
          glossaryRespected = false;
          console.log(`  [GLOSSAIRE] Conflit détecté, le glossaire annule le RAG pour "${source}"`);
          break;
        }
      }
    }
    if (!glossaryRespected) {
      bestMatch = null;
    }
  }

  // --- Si RAG accepté ---
  if (bestMatch) {
    console.log(`  [RAG] Traduction récupérée (Score: ${matchScore.toFixed(2)})`);
    return { translated: bestMatch.target, source: "memory", newEntry: null };
  }

  // --- Sinon : traduction Mistral avec glossaire ---
  console.log(`  [MISTRAL] Traduction par IA...`);

  // Construire les instructions du glossaire
  let glossaryInstructions = "";
  if (glossaryEntries.length > 0) {
    const rules = glossaryEntries
      .map(([source, target]) => `  - "${source}" → "${target}"`)
      .join("\n");

    glossaryInstructions = `
GLOSSAIRE — Traductions OBLIGATOIRES :
${rules}

Dans le texte source, les mots du glossaire sont balisés avec <term translation="...">mot</term>.
Applique TOUJOURS la traduction indiquée dans l'attribut "translation" pour ces mots.
- Ne conserve JAMAIS aucune balise <term> ni </term> dans ta réponse finale.`;
  }

  // Injecter les tags <term> du glossaire dans le segment
  let segmentForMistral = segment;
  if (glossaryEntries.length > 0) {
    for (const [source, target] of glossaryEntries) {
      const escapedSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const regex = new RegExp(`\\b(${escapedSource})\\b`, "gi");
      segmentForMistral = segmentForMistral.replace(regex, `<term translation="${target}">$1</term>`);
    }
  }

  const response = await client.chat.completions.create({
    model: MISTRAL_MODEL,
    messages: [
      {
        role: "system",
        content: `Tu es un traducteur technique automatisé anglais → français.
TA TÂCHE EST DE FOURNIR UNIQUEMENT LA TRADUCTION FINALE.
RÈGLE STRICTE : NE DIS JAMAIS "Voici la traduction", "Voici le texte", etc. Renvoie uniquement le texte traduit, SANS aucun commentaire.

FORMATAGE MARKDOWN — Préserve intégralement la structure Markdown (titres #, listes -, gras **, etc.).
Le code en ligne entouré de backticks (\`...\`) doit être conservé tel quel, sans modification.
${glossaryInstructions}`
      },
      {
        role: "user",
        content: segmentForMistral,
      },
    ],
    temperature: 0.1,
  });

  let translated = response.choices[0].message.content.trim();

  // Nettoyage de sécurité
  translated = translated.replace(/^Voici la traduction.*?:?\n+/i, '');
  translated = translated.replace(/^Voici le texte.*?:?\n+/i, '');
  translated = translated.replace(/<term[^>]*>|<\/term>/gi, '');

  return {
    translated,
    source: "ai",
    newEntry: { source: segment, target: translated },
  };
}

/**
 * POST /api/translate
 * Traduit un texte anglais → français en respectant le glossaire.
 * Body attendu : { "text": "texte à traduire" }
 *
 * Pipeline en 2 phases :
 *   Phase 1 — Mistral analyse le texte et isole le code/markdown
 *   Phase 2 — Traduction des segments textuels (RAG puis Mistral + glossaire)
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

    // 2. Charger la Mémoire de Traduction (TM)
    let tmModel = [];
    if (fs.existsSync(TM_PATH)) {
      tmModel = JSON.parse(fs.readFileSync(TM_PATH, "utf-8"));
    }
    const tmSources = tmModel.map(entry => entry.source);

    // 3. PHASE 1 — Analyse du texte par Mistral (isolation code/markdown)
    const parts = await analyzeText(text);

    // 4. PHASE 2 — Traduction segment par segment
    const translatedParts = [];
    let hasNewTranslations = false;
    let tmCount = 0;
    let aiCount = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part.type === "code") {
        // Le code est conservé tel quel — aucune modification
        console.log(`[Part ${i + 1}/${parts.length}] CODE — conservé intact.`);
        translatedParts.push(part.content);
        continue;
      }

      // Type "text" — à traduire
      const content = part.content;

      // Si le segment est vide ou que des espaces/sauts de ligne
      if (!content.trim()) {
        translatedParts.push(content);
        continue;
      }

      console.log(`[Part ${i + 1}/${parts.length}] TEXTE — traduction en cours...`);

      const result = await translateSegment(content, glossary, tmModel, tmSources);
      translatedParts.push(result.translated);

      if (result.source === "memory") {
        tmCount++;
      } else {
        aiCount++;
      }

      // Apprentissage : enregistrer le nouveau segment dans la TM
      if (result.newEntry) {
        tmModel.push(result.newEntry);
        tmSources.push(result.newEntry.source);
        hasNewTranslations = true;
      }
    }

    // 5. Sauvegarder la TM si de nouvelles traductions ont été ajoutées
    if (hasNewTranslations) {
      fs.writeFileSync(TM_PATH, JSON.stringify(tmModel, null, 2), "utf-8");
    }

    // 6. Reconstruire le texte complet
    const translation = translatedParts.join("");

    // 7. Déterminer la source globale
    let overallSource = "none";
    if (aiCount > 0 && tmCount > 0) overallSource = "mixed";
    else if (aiCount > 0) overallSource = "ai";
    else if (tmCount > 0) overallSource = "memory";

    console.log(`[RÉSULTAT] Source: ${overallSource} | IA: ${aiCount} | RAG: ${tmCount}`);

    res.json({ translation, source: overallSource });
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
