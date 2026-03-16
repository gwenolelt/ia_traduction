require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const stringSimilarity = require("string-similarity");
const { extractCode, restoreCode } = require("./markdownParser");

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Chemin vers le fichier glossaire ---
const GLOSSARY_PATH = path.join(__dirname, "glossary.json");
const TM_PATH = path.join(__dirname, "translation_memory.json");

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
    // 1. Pré-traitement : extraction du code (blocs + inline) → placeholders
    const { cleanedText, codeMap } = extractCode(text);

    // 2. Charger le glossaire
    const glossaryData = fs.readFileSync(GLOSSARY_PATH, "utf-8");
    const glossary = JSON.parse(glossaryData);

    // 3. Charger la Mémoire de Traduction (TM)
    let tmModel = [];
    if (fs.existsSync(TM_PATH)) {
      tmModel = JSON.parse(fs.readFileSync(TM_PATH, "utf-8"));
    }
    const tmSources = tmModel.map(entry => entry.source);

    // 4. Construire les règles du glossaire pour le prompt
    const glossaryEntries = Object.entries(glossary);
    let glossaryInstructions = "";
    if (glossaryEntries.length > 0) {
      const rules = glossaryEntries
        .map(([source, target]) => `  - "${source}" → "${target}"`)
        .join("\n");

      glossaryInstructions = `
GLOSSAIRE (PRIORITÉ SECONDAIRE PAR RAPPORT AU CODE) :
Voici les traductions de référence :
${rules}

IMPORTANT : Dans le texte source, certains mots de ce glossaire ont été mis en évidence avec des balises <term translation="..."></term>.
HIÉRARCHIE DES RÈGLES : La règle de NON-TRADUCTION DU CODE est TOUJOURS prioritaire !
- Si le mot étiqueté par <term> fait manifestement partie d'une requête SQL (ex: "DELETE" dans "DELETE * FROM"), d'une ligne de code ou du nom d'une variable technique : CONSERVE LE MOT D'ORIGINE ET IGNORE LE GLOSSAIRE. Ne le traduis pas !
- Si le mot étiqueté fait partie d'une phrase en contexte de langage naturel classique : Applique la traduction indiquée dans l'attribut "translation".
- Ne conserve JAMAIS aucune balise <term> ni </term> dans ta réponse finale.`;
    }

    // 5. Configurer le client OpenAI
    const client = new OpenAI({
      apiKey: process.env.MISTRAL_API_KEY,
      baseURL: "https://api.mistral.ai/v1",
    });

    // 6. Segmentation et Traduction segment par segment
    // Split par double saut de ligne (paragraphes) pour préserver le contexte du code/SQL.
    // L'expression régulière conserve les séparateurs ((\r?\n\r?\n+)) dans le tableau de segments.
    const segments = cleanedText.split(/(\r?\n\r?\n+)/);
    const translatedSegments = [];
    let hasNewTranslations = false;
    let tmCount = 0;
    let aiCount = 0;

    // Pour optimiser, nous traitons segment par segment de façon séquentielle
    for (const segment of segments) {
      if (!segment.trim()) {
        translatedSegments.push(segment); // Conserver les sauts de ligne exacts
        continue;
      }

      // ==========================================
      // 🥇 PRIORITÉ 1 : PROTECTION DU CODE & MARKDOWN
      // ==========================================
      // Si le segment est entièrement composé de code (placeholders) ou de caractères non alphabétiques,
      // on bloque immédiatement : on ne fait ni glossaire, ni RAG, ni IA.
      const onlyPlaceholdersRegex = /^([\s]*\[\[(CODE_BLOCK|INLINE_CODE)_\d+\]\][\s]*)+$/;
      if (onlyPlaceholdersRegex.test(segment)) {
        console.log(`[PRIORITÉ 1 - CODE] Segment 100% code détecté, conservation absolue.`);
        translatedSegments.push(segment);
        continue; // On passe au segment suivant
      }

      // ==========================================
      // 🥈 PRIORITÉ 2 & 3 : GLOSSAIRE D'ABORD, RAG ENSUITE
      // ==========================================
      let bestMatch = null;
      let matchScore = 0;
      if (tmSources.length > 0) {
        const match = stringSimilarity.findBestMatch(segment, tmSources);
        matchScore = match.bestMatch.rating;
        if (matchScore > 0.9) {
          bestMatch = tmModel.find(entry => entry.source === match.bestMatch.target);
        }
      }

      // Vérification absolue du glossaire sur le résultat du RAG :
      // Le Glossaire Prime sur la mémoire de traduction.
      if (bestMatch && glossaryEntries.length > 0) {
        let glossaryRespected = true;
        for (const [source, target] of glossaryEntries) {
          const escapedSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const sourceRegex = new RegExp(`\\b(${escapedSource})\\b`, "gi");
          
          if (sourceRegex.test(segment)) {
            // Le RAG doit obligatoirement contenir la traduction officielle du glossaire
            if (!bestMatch.target.toLowerCase().includes(target.toLowerCase())) {
              glossaryRespected = false;
              console.log(`[PRIORITÉ 2 - GLOSSAIRE] Conflit détecté, le glossaire annule le RAG pour le terme "${source}"`);
              break;
            }
          }
        }
        
        if (!glossaryRespected) {
          bestMatch = null; // RAG refusé car il ne respecte pas la Priorité 2
        }
      }

      if (bestMatch) {
         console.log(`[PRIORITÉ 3 - RAG] Récupération acceptée (Score: ${matchScore.toFixed(2)})`);
         translatedSegments.push(bestMatch.target);
         tmCount++;
      } else {
         console.log(`[MISTRAL] Appel API (Glossaire et Code sécurisés en amont)`);
         // 6.b Préparer le segment pour Mistral (avec les tags du glossaire)
         let segmentForMistral = segment;
         if (glossaryEntries.length > 0) {
            for (const [source, target] of glossaryEntries) {
              const escapedSource = source.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
              const regex = new RegExp(`\\b(${escapedSource})\\b`, "gi");
              segmentForMistral = segmentForMistral.replace(regex, `<term translation="${target}">$1</term>`);
            }
         }

         // 6.c Appel Mistral
         const response = await client.chat.completions.create({
            model: process.env.MISTRAL_MODEL || "mistral-large-latest",
            messages: [
              {
                role: "system",
                content: `Tu es un traducteur technique automatisé.
TA TÂCHE EST DE FOURNIR UNIQUEMENT LA TRADUCTION FINALE.
RÈGLE STRICTE N°1 : NE DIS JAMAIS "Voici la traduction", "Voici le texte", etc. N'inclus ABSOLUMENT AUCUNE phrase d'introduction ou de conclusion. Renvoie 100% de code brut/texte traduit, SANS aucun commentaire humain autour.

RÈGLES STRICTES POUR LE CODE ET LES NOMS TECHNIQUES NON MARQUÉS :
Même si le code n'est pas dans un bloc Markdown, TU NE DOIS JAMAIS TRADUIRE :
- Les requêtes SQL (ex: laisse absolument les mots comme SELECT, FROM, WHERE, etc. intacts). Si la phrase entière est du code SQL, recopie-la telle quelle.
- Les mots clés de langages de programmation (function, const, return, etc.).
- Les noms de variables, de colonnes, de tables ou de fonctions (ex: Country, CustomerName, Customers, etc.)
- La casse des noms techniques (CamelCase, PascalCase, snake_case) doit être préservée.
- Les identifiants entre guillemets présents dans les exemples de code (ex: "Spain", 'G%').

PLACEHOLDERS DE CODE — Le texte contient des marqueurs spéciaux entre doubles crochets (ex: [[CODE_BLOCK_0]], [[INLINE_CODE_1]]).
Tu DOIS les recopier EXACTEMENT tels quels. Ne les modifie pas.

FORMATAGE MARKDOWN — Préserve intégralement la structure Markdown (titres #, listes -, gras **, etc.).
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
         
         // Nettoyage de sécurité : Retirer les "Voici la traduction :" si Mistral s'entête
         translated = translated.replace(/^Voici la traduction.*?:?\n+/i, '');
         translated = translated.replace(/^Voici le texte.*?:?\n+/i, '');
         
         // Nettoyage de sécurité : Retirer les balises <term> si Mistral les a laissées
         translated = translated.replace(/<term[^>]*>|<\/term>/gi, '');

         translatedSegments.push(translated);
         aiCount++;
         
         // 6.d Apprentissage : enregistrer le segment
         tmModel.push({ source: segment, target: translated });
         tmSources.push(segment);
         hasNewTranslations = true;
      }
    }

    // 7. Sauvegarder la TM si de nouvelles traductions ont été ajoutées
    if (hasNewTranslations) {
      fs.writeFileSync(TM_PATH, JSON.stringify(tmModel, null, 2), "utf-8");
    }

    // 8. Reconstruire le texte complet
    // Les espacements/sauts de lignes sont conservés dans les segments, on met juste ""
    const rawTranslation = translatedSegments.join("");

    // 9. Post-traitement : réinjection du code original à la place des placeholders
    const translation = restoreCode(rawTranslation, codeMap);

    // 10. Déterminer la source globale
    let overallSource = "none";
    if (aiCount > 0 && tmCount > 0) overallSource = "mixed";
    else if (aiCount > 0) overallSource = "ai";
    else if (tmCount > 0) overallSource = "memory";

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
