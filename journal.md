LE THOER GWENOLE

                Traducteur technique avec mémoire de traduction (Num°8)

    Je choisis le projet 8. Le but de ce projet est de traduire une page internet, par exemple de l’anglais au français avec une traduction spécifique pour certains mots techniques ou certains caractères techniques. Si nous avons un document dans lequel on trouve le mot « Co2 », et que pour ce mot nous choisissons que sa traduction sera « dioxyde de carbone » alors la traduction se fera automatiquement. Nous rentrons sa traduction dans un glossaire donc on peut modifier a tout moment sa traduction. A chaque fois qu’on détecte le mot « Co2 », que ce soit dans le même document ou dans un autre alors on le traduit automatiquement par son terme cible définit dans le glossaire. Le reste du document, c’est-à-dire tout ce qui n’est pas de la documentation technique sera traduit automatiquement dans la langue choisie. On ne doit pas traduire le code et le garder sous format Markdown.

    Choix techniques :
        Front-end : Vue.js 3 car c’est simple et je connais.

        Back-end : Node.js avec Express.js. API REST pour gérer les requêtes du front.     Technologie que je connais également.

        Stockage du Glossaire : Un simple fichier local glossary.json sur le serveur.
        
        IA (Traduction) : Utilisation de l'API Mistral.

	Je ne vais surement pas traduire chaque langue, j’imagine qu’il doit exister des mot techniques différents dans chaque langue. Par exemple je pense que le mot « Co2 » ne doit pas signifier grand-chose en mandarin. Je ne traduirais que les langues que je peux comprendre ou a minima celles qui ont le même alphabet que le francais.

	Une des difficultés que je pense rencontrer sera de maintenir à jour le glossaire. En effet je vais rencontrer de plus en plus de mots techniques que je devrais traduire à mesure que je donne à l’IA des documents. Je pense également rencontrer des difficultés quant à l’efficacité de la mémoire, il me parait compliqué de réussir à bien la réutiliser.

    Adresse du depot gitHub :
    https://github.com/gwenolelt/ia_traduction.git


Session 1 — Objectif : initialisation du projet et architecture du projet
Prompt : 
"Contexte du projet
Je suis en train de créer un outil de traduction technique : un "Traducteur avec mémoire de traduction". L'objectif final est de traduire de la documentation technique de l'anglais vers le français, tout en assurant une cohérence parfaite grâce à un glossaire et une mémoire des traductions passées.
Je veux procéder étape par étape. Pour cette Étape 1, nous allons nous concentrer uniquement sur les bases : l'architecture, l'interface de traduction simple, et l'intégration du glossaire.
ATTENTION : Pour l'instant, ignore toutes les complexités liées au formatage Markdown (ne t'occupe pas de préserver les blocs de code) et ignore totalement la partie "Mémoire de traduction" (RAG).

Architecture (Étape 1)
Front-end : Vue.js 3 (Composition API). Interface simple pour saisir le texte et gérer le glossaire.
Back-end : Node.js avec Express.js. API REST pour gérer les requêtes du front.
Stockage du Glossaire : Un simple fichier local glossary.json sur le serveur (format : {"terme source": "terme cible"}).
IA (Traduction) : Utilisation de l'API Azure OpenAI avec le modèle gpt-4o (en utilisant les crédits Azure) pour effectuer la traduction.

Fonctionnalités attendues pour cette Étape 1
Gestion du Glossaire (CRUD simple) :
Le back-end doit pouvoir lire le fichier glossary.json et le renvoyer au front.
Le front-end doit avoir un petit formulaire pour ajouter de nouvelles paires "terme source" -> "terme cible" (ex: "CO2" -> "dioxyde de carbone").
Le back-end doit pouvoir mettre à jour le fichier glossary.json.

Traduction avec Glossaire (Le cœur du système actuel) :
Le front-end a une zone de texte (textarea) pour coller le texte source en anglais, et un bouton "Traduire".
Au clic, le texte est envoyé au back-end.
Le back-end lit le glossary.json actuel.
Le back-end construit un prompt pour l'IA (technique de Few-shot prompting ou System Instructions) qui inclut le texte à traduire ET les règles du glossaire. Il est crucial que l'IA comprenne qu'elle doit utiliser les termes du glossaire s'ils apparaissent dans le texte.
Le back-end renvoie le texte traduit au front-end qui l'affiche.

Ce que j'attends de toi pour commencer
Génère-moi la structure de base du projet et le code pour cette Étape 1 :
La structure des dossiers (comment organiser le projet Vue.js et Express).
Le code du serveur Express (server.js ou similaire) incluant :
Les routes pour lire/écrire le glossary.json.
La route /translate qui appelle l'API Azure OpenAI (montre comment faire l'appel à gpt-4o via Azure avec le endpoint et la clé) en y injectant le contenu du glossaire.
Le code d'un composant Vue.js (App.vue ou similaire) qui intègre :
La liste du glossaire et le formulaire pour ajouter un terme.
Les textareas pour le texte source et le texte traduit, avec le bouton d'action.
Garde le code simple, lisible et bien commenté. Ne sur-optimise pas l'UI pour le moment."

Problème : l'API Azure OpenIA ne fonctionnait pas, j'ai perdu du temps sur cette partie.

Solution : je suis passé sur mistral et fait les changements nécessaires dans le .env. L'API de Mistral a fonctionné directement, la traduction de l’anglais vers le français se fait correctement juste avec du texte simple (sans code), je crois que la traduction se fait correctement aussi depuis n’importe quelle langue vers le français même si ce n’était pas le but du projet.

Apprentissage : je n’ai pas réellement appris quelque chose pour l’instant.


Session 2 — Objectif : préserver le formatage (code, markdown)
Prompt : " Contexte du projet (Étape 2)
Nous continuons le développement de mon "Traducteur technique". L'Étape 1 (traduction basique avec intégration stricte d'un glossaire JSON via Mistral AI sur un stack Vue.js/Express) est fonctionnelle.
Pour cette Étape 2, nous devons implémenter un critère spécifique strict : Le code n'est jamais traduit et le formatage Markdown est préservé.
(Note : On ignore toujours la partie RAG/Mémoire pour le moment).

Le Problème à résoudre
Les LLM ont tendance à traduire les commentaires, les noms de variables ou à casser la syntaxe des blocs de code Markdown (```). Nous devons garantir à 100% l'intégrité du code.
Stratégie technique exigée (Parsing & Placeholders)
Je veux implémenter un système d'extraction et de réinjection côté Backend (Express) :
Pré-traitement (Pre-processing) : Avant d'envoyer le texte à Mistral, le backend utilise des expressions régulières (Regex) pour trouver tous les blocs de code multi-lignes (...) et le code en ligne (...).
Il stocke ce code dans un tableau/dictionnaire temporaire.
Il remplace le code dans le texte source par des placeholders uniques (ex: ___CODE_BLOCK_0___, ___INLINE_CODE_1___).
Appel IA : Il envoie le texte avec les placeholders à Mistral AI. Le prompt système doit préciser à l'IA de conserver ces placeholders tels quels et de respecter le reste du formatage Markdown (titres, listes, gras).
Post-traitement (Post-processing) : Une fois la traduction reçue, le backend remplace les placeholders par le code original stocké à l'étape 2.

Ce que j'attends de toi
Génère le code nécessaire pour mettre à jour mon backend Node.js/Express :
Crée une fonction utilitaire (ex: markdownParser.js) qui contient la logique de pré-traitement (extraction via Regex) et de post-traitement (réinjection).

Mets à jour la route /translate de mon server.js pour utiliser ce parser avant et après l'appel à l'API Mistral.
Mets à jour le Prompt Système envoyé à Mistral pour lui expliquer la présence des placeholders et lui ordonner de conserver la structure Markdown classique (titres, listes, etc.).
Garde le code robuste, ajoute des commentaires pour expliquer les Regex utilisées."

Problème : Le pré-traitement (extraction) fonctionne, l'IA traduit bien et garde les placeholders, mais le post-traitement (la réinjection) échoue complètement.

Solution : il fallait s’assurer que l’objet qui stocke les codeMap ne se soit pas perdu et qu’il est bien passé à la fonction de réinjection. La logique qui cherche les ___CODE_BLOCK_X___ dans le texte traduit pour les remplacer par le code original ne fonctionne pas.

Apprentissage : j’ai vu rapidement ce qu’était les placeholders même s’il m’ont causé des problèmes que je détaille ensuite.


Session 3 — Objectif : implémenter la fonctionnalité de RAG
Prompt : " Contexte du projet (Étape 3)
Mon traducteur technique (Vue.js + Express + Mistral AI + Glossaire + Protection Markdown et Code) fonctionne bien. Maintenant, je veux implémenter la Mémoire de Traduction (RAG) pour éviter de traduire et de payer plusieurs fois pour les mêmes segments.

Objectif technique : La Mémoire de Traduction (TM)
Je veux mettre en place un système qui stocke les segments déjà traduits et les réutilise automatiquement si une phrase similaire à plus de 90% est détectée.
Stratégie de mise en œuvre (Backend Express)
Stockage : Crée un fichier translation_memory.json qui stockera un tableau d'objets : [{ "source": "...", "target": "..." }].
Segmentation : Avant la traduction, le backend doit découper le texte source (après extraction du code) en segments (phrases ou lignes).

Recherche de similarité (Le RAG) :
Pour chaque segment, compare-le avec les entrées "source" dans translation_memory.json.
Utilise une bibliothèque comme string-similarity (Dice's Coefficient) ou calcule la distance de Levenshtein pour trouver le meilleur match.
Règle stricte : Si le score de similarité est > 0.9 (90%), utilise la traduction stockée au lieu d'appeler l'API Mistral.

Appel IA & Apprentissage :
Si aucun match n'est trouvé, appelle l'API Mistral pour traduire le segment (en respectant le glossaire).
Une fois traduit, enregistre la nouvelle paire { source, target } dans translation_memory.json pour la prochaine fois.
Reconstruction : Réassemble tous les segments (provenant de la mémoire ou de l'IA) dans l'ordre original avant de réinjecter les blocs de code.

Ce que j'attends de toi
Propose une mise à jour de server.js qui intègre cette logique de "Segmenter -> Chercher -> Traduire -> Apprendre".
Suggère une bibliothèque légère (ex: string-similarity ou natural) pour calculer le score de 90% de match.
Assure-toi que cette logique s'intègre bien AVANT le post-traitement des placeholders de code Markdown.
Garde le code simple, performant et n'oublie pas de gérer la lecture/écriture du fichier JSON de mémoire de manière asynchrone."

Problème : je ne savais pas quand la mémoire était utilisé ni quand c’était Mistral.

Solution : j'ai demandé d’ajouter des logs pour bien faire la différence entre les deux.

Apprentissage : j’ai appris à utiliser la bibliothèque « string-similarity ». Je trouve aussi que le 90% de match est peut être trop strict car il suffit de changer un mot dans la phrase et on est déjà sous les 90%. Le problème c’est que si on met par exemple 75% ou 80% alors parfois des phrases différentes sont traduit identiquement alors que leurs significations diffèrent. Cette restriction devient plus souple à mesure que la phrase s’allonge. Par exemple il est plus difficile de garder un match >90% quand la phrase ne contient que 3 ou 4 mots mais pour une phrase plus longue (1 ou plusieurs lignes) alors le match > 90% est plus simple à garder.


Session 4 — Objectif : correction apporté par rapport au glossaire
Prompt : "Je veux que le glossaire soit toujours respecté, je veux donc que la première chose qui soit regardé soit le glossaire et ensuite le RAG."

Problème : le glossaire était regarder en premier mais donc le code était traduit.

Solution : j'ai donc demandé de regarder le code et le markdown en premier, ensuite le glossaire et en dernier le RAG. On commence par isoler le code et markdown pour les mettre dans des placeholders pour ne jamais les envoyer au glossaire ni à Mistral. On applique le glossaire que sur le texte restant et on utilise le RAG ou Mistral pour traduire le reste. On termine par réassembler le texte traduit avec le code ou le markdown.

Apprentissage : penser à respecter une architecture bien définie et un ordre bien précis.


Session 5 — Objectif : Changement de stratégie
Prompt : " je vais changer de stratégie, je veux utiliser Mistral pour regarder dans la zone de texte à traduire, s'il y a du code et/ou du markdown alors je veux que Mistral isole à part cette partie du texte, ensuite Mistral doit faire la traduction du texte tout en respectant impérativement le glossaire, je veux que la traduction se fasse par rapport au RAG, si on trouve des chaines de caractères déjà traduit auparavant alors on les traduit avec le RAG sinon avec Mistral toujours en respectant impérativement le glossaire »

Problème : a la base j’utilisais un fichier que j’ai supprimé depuis dans lequel je vérifiais si on trouvait un mot de code (SELECT, WHERE, DELETE, etc) pour ensuite isoler le code mais le code se faisait traduire quand meme.

Solution : j’ai demandé d’utiliser Mistral pour détecter les parties de code et/ou markdown parce que je pense que Mistral est meilleur pour détecter les bouts de code qu’un simple fichier avec une liste de  « mot de code », le but était de vraiment isoler le code et le markdown pour être certain qu’ils n’allaient pas être traduits. Par exemple, si je mettais dans le glossaire que « WHERE » devait être égal à « ou » alors parfois le mot WHERE était remplacé par « ou » même quand c’était du code. La traduction prend un peu plus de temps depuis que je demande a Mistral d’isoler le code. Par ailleurs je ne stocke plus des segments (phrases) mais tout ce que a été mis dans la zone de texte à traduire. J’ai conscience que ce n’est plus optimal pour le RAG car la mémoire ne sera utilisé que quand le texte entier est assez similaire. Je viens également de remarqué que lorsque je mets trop de texte (plus de 3 lignes) dans la zone de texte à traduire alors Mistral m’indique un overflow.


Conclusion :
Pour conclure, j’ai trouvé difficile parfois de réussir à utiliser copilot dans ce projet. Je me rends compte que souvent mes prompts ne sont pas très efficace même si j’ai utilisé l’IA en début de projet pour générer des prompts que je pourrais envoyer par la suite à copilot. J’ai eu des problèmes avec le respect du format du code, il était souvent renvoyé comme étant traduit car ma détection des morceaux de codes n’était pas efficaces. C’est pourquoi j’ai décidé de changer de stratégie et de demander à Mistral de détecter le code et le markdown, le problème avec cette stratégie c’est que la traduction met plus de temps à se faire mais c’est la solution la plus optimale que j’ai trouvé pour réussir à ne jamais traduire le code ni le markdown. Sinon je n’ai rencontré aucune difficulté avec le glossaire, la traduction se faisait bien et même trop bien car il était respecté en toute circonstance et traduisait parfois le code.