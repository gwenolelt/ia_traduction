/**
 * markdownParser.js
 *
 * Utilitaire de pré-traitement et post-traitement pour protéger
 * les blocs de code et le code en ligne lors de la traduction.
 *
 * Stratégie :
 *   1. extractCode()  — Remplace tout le code par des placeholders uniques.
 *   2. restoreCode()  — Réinjecte le code original à la place des placeholders.
 *
 * Les placeholders utilisent le format [[CODE_BLOCK_0]] / [[INLINE_CODE_0]]
 * (crochets doubles) pour éviter toute confusion avec la syntaxe Markdown
 * (les underscores ___ étaient interprétés comme gras/italique par l'IA).
 */

// ─────────────────────────────────────────────
// Format des placeholders : [[TYPE_N]]
// Les crochets doubles ne sont pas significatifs en Markdown,
// l'IA n'a donc aucune raison de les modifier.
// ─────────────────────────────────────────────
const CODE_BLOCK_TAG = "CODE_BLOCK";
const INLINE_CODE_TAG = "INLINE_CODE";

/**
 * Génère un placeholder au format [[TAG_N]]
 */
function makePlaceholder(tag, index) {
  return `[[${tag}_${index}]]`;
}

/**
 * extractCode(text)
 *
 * Parcourt le texte Markdown et remplace :
 *   - Les blocs de code multi-lignes (``` ... ```) par [[CODE_BLOCK_N]]
 *   - Le code en ligne (` ... `)                   par [[INLINE_CODE_N]]
 *
 * L'ordre est important : on traite d'abord les blocs multi-lignes
 * pour éviter qu'un backtick simple à l'intérieur d'un bloc ne soit
 * capturé par la regex du code en ligne.
 *
 * @param  {string} text  — Le texte Markdown source.
 * @return {{ cleanedText: string, codeMap: Object<string, string> }}
 *         cleanedText : le texte avec les placeholders.
 *         codeMap     : objet { placeholder: code_original }.
 */
function extractCode(text) {
  // On utilise un objet simple (plus fiable pour la sérialisation/debug qu'une Map)
  const codeMap = {};
  let counter = 0;

  // ── 1. Blocs de code multi-lignes ──────────────────────────
  // Regex : capture les blocs  ```[langage] ... ```
  //   - ```            → triple backtick d'ouverture
  //   - [\s\S]*?       → tout caractère, incluant les sauts de ligne (non-gourmand)
  //   - ```            → triple backtick de fermeture
  // Le flag `g` permet de capturer tous les blocs du texte.
  const codeBlockRegex = /(```[\s\S]*?```)/g;

  let cleanedText = text.replace(codeBlockRegex, (match) => {
    const placeholder = makePlaceholder(CODE_BLOCK_TAG, counter);
    codeMap[placeholder] = match;
    counter++;
    return placeholder;
  });

  // ── 2. Code en ligne ───────────────────────────────────────
  // Regex : capture le code entre backticks simples ` ... `
  //   - `              → backtick d'ouverture
  //   - ([^`]+)        → un ou plusieurs caractères qui ne sont pas un backtick
  //   - `              → backtick de fermeture
  // Note : on traite ceci APRÈS les blocs multi-lignes, donc il
  // ne reste plus que du vrai code en ligne à ce stade.
  const inlineCodeRegex = /(`[^`]+`)/g;

  cleanedText = cleanedText.replace(inlineCodeRegex, (match) => {
    const placeholder = makePlaceholder(INLINE_CODE_TAG, counter);
    codeMap[placeholder] = match;
    counter++;
    return placeholder;
  });

  return { cleanedText, codeMap };
}

/**
 * restoreCode(translatedText, codeMap)
 *
 * Remplace chaque placeholder dans le texte traduit par le code
 * original correspondant stocké dans la codeMap.
 *
 * Robustesse : l'IA peut légèrement altérer les placeholders
 * (espaces en trop, crochets modifiés…). On utilise donc une
 * regex souple pour chaque type de placeholder, en plus du
 * remplacement exact.
 *
 * @param  {string}              translatedText — Texte traduit contenant les placeholders.
 * @param  {Object<string,string>} codeMap      — { placeholder: code_original }.
 * @return {string}              Le texte final avec le code restauré.
 */
function restoreCode(translatedText, codeMap) {
  let result = translatedText;

  for (const [placeholder, originalCode] of Object.entries(codeMap)) {
    // ── Tentative 1 : remplacement exact (split/join, rapide) ──
    if (result.includes(placeholder)) {
      result = result.split(placeholder).join(originalCode);
      continue;
    }

    // ── Tentative 2 : regex souple (tolère les altérations de l'IA) ──
    // Extrait le type (CODE_BLOCK ou INLINE_CODE) et le numéro depuis le placeholder
    const tagMatch = placeholder.match(/\[\[(CODE_BLOCK|INLINE_CODE)_(\d+)\]\]/);
    if (tagMatch) {
      const [, tag, num] = tagMatch;
      // Regex tolérante :
      //   - \[{1,2}\s*  → 1 ou 2 crochets ouvrants + espaces optionnels
      //   - _?           → underscore optionnel (l'IA peut le supprimer)
      //   - \s*\]{1,2}  → espaces optionnels + 1 ou 2 crochets fermants
      // On accepte aussi les variantes avec underscores autour (___TAG_N___)
      const fuzzyPattern = new RegExp(
        `(?:\\[{1,2}|_{1,3})\\s*${tag}[_\\s]*${num}\\s*(?:\\]{1,2}|_{1,3})`,
        "g"
      );
      result = result.replace(fuzzyPattern, originalCode);
    }
  }

  return result;
}

module.exports = { extractCode, restoreCode };
