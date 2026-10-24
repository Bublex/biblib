# Biblib : ce livre est-il dans ma bibliothèque ?

Extension Chrome. Sur la fiche d'un livre (Amazon, Babelio, Bedetheque, Fnac, Decitre, Mollat…), une pastille indique en quelques secondes si le livre est dans vos bibliothèques municipales, s'il est disponible et dans quelle annexe. Un clic ouvre la notice du catalogue pour le réserver.

- **Recherche par ISBN**, en incluant les ISBN des autres éditions quand la page les liste (Babelio).
- **Repli par titre et auteur** quand l'édition consultée n'est pas au catalogue (poche, réédition…). Ces résultats sont signalés « Autre édition ».
- **Disponibilité par exemplaire** : annexe, cote, statut, date de retour prévue.
- **Bibliothèques favorites** : une étoile sur une annexe la fait passer en premier, et la pastille indique si le livre y est.
- **Fenêtre de l'extension** (icône de la barre d'outils) : recherche manuelle par ISBN ou par titre.

## Installation (mode développeur)

1. Ouvrez `chrome://extensions` et activez le **Mode développeur** (en haut à droite).
2. Cliquez sur **Charger l'extension non empaquetée** et choisissez le dossier `extension/` de ce dépôt.
3. La page de réglages s'ouvre : cochez vos bibliothèques. Chrome demande l'autorisation d'accéder au catalogue choisi, et à lui seul.
4. Ouvrez la fiche d'un livre, par exemple [La Horde du Contrevent sur Babelio](https://www.babelio.com/livres/Damasio-La-Horde-du-Contrevent/5420).

Pour une archive à partager : `npm run zip` produit `biblib.zip`.

## Bibliothèques prises en charge

| Réseau | Logiciel du catalogue | Remarques |
|---|---|---|
| Paris | Syracuse (Archimed) | Le 20/10/2026, le service de disponibilité de Paris renvoyait une erreur, y compris sur son propre site : la notice s'affiche, la disponibilité est marquée « à vérifier ». |
| Bordeaux | inMedia (Bibliomondo) | Catalogue commun à la métropole, filtré sur les annexes de la ville. Résumé par réseau : un livre réservé est acheminé vers la bibliothèque choisie. |
| Bordeaux Métropole | inMedia | Toutes les communes, groupées par commune. |
| Lyon | inMedia | |
| Marseille | inMedia | |
| Nantes | inMedia | |
| Toulouse | Web2 (Rosalis) | Catalogue servi uniquement en HTTP, pages HTML analysées. |
| Nice, Montpellier, Strasbourg, Lille, Grenoble | Syracuse | |
| Rennes (Champs Libres) | Encore (Innovative) | Pages HTML analysées. |
| 54 autres réseaux : Dijon, Reims, Saint-Étienne, Toulon, Villeurbanne, Grand Poitiers, La Rochelle, Boulogne-Billancourt, Mérignac, Lormont, Villenave-d'Ornon… | Syracuse | Liste complète dans `extension/lib/libraries.js`. Le catalogue du SITPI (Échirolles, Fontaine, Pont-de-Claix, Saint-Martin-d'Hères) est publié en HTTP. |

La page de réglages propose un champ de recherche par ville ou par réseau. D'autres villes utilisent Syracuse ou inMedia : pour en ajouter une, voir plus bas.

## Sites de livres reconnus

Amazon (.fr, .com, .be, .ca, .co.uk, .de, .es, .it), Babelio, Bedetheque, Fnac, Decitre, Cultura, Leslibraires.fr, Place des Libraires, Mollat, Gibert, Furet du Nord, Chasse aux livres, BDfugue, Goodreads, SensCritique, Open Library.

La détection lit, dans l'ordre : les règles propres au site (Amazon, Babelio, Bedetheque), les données structurées JSON-LD (`Book`, `isbn`, `gtin13`), les microdonnées, les balises `book:isbn`, l'ISBN présent dans l'URL, puis un libellé « ISBN/EAN » dans la page. Les pages listant plusieurs livres (résultats de recherche) sont ignorées.

## Vos données restent sur votre appareil

- Réglages et favoris sont dans `chrome.storage.local` : pas de `chrome.storage.sync`, pas de compte, pas de serveur Biblib, aucune statistique.
- Les seules requêtes sortantes vont **aux catalogues que vous avez cochés** et contiennent l'ISBN, le titre et l'auteur du livre consulté. Elles partent sans en-tête `Referer` : le catalogue ne voit pas la page d'où vous venez.
- Les autorisations d'accès aux catalogues sont **optionnelles** : accordées une à une quand vous cochez une bibliothèque, retirées quand vous la décochez.
- Le panneau est dans un Shadow DOM fermé : le site marchand ne peut pas lire les résultats.
- La réservation se fait sur le site de la bibliothèque avec votre compte lecteur ; l'extension ne manipule ni numéro de carte ni mot de passe.
- Les cookies ne sont envoyés qu'aux catalogues qui en ont besoin pour fonctionner (inMedia : le jeton d'accès public est lié à la session ; Toulouse : cookie anti-robot). Syracuse et Encore sont interrogés sans cookies.
- Les résultats sont gardés 15 minutes en mémoire de session, effacés à la fermeture du navigateur.

## Comment ça marche

```
page de livre ──(content/extract.js)──▶ { ISBN, autres éditions, titre, auteurs }
      │
      ▼  port « biblib-lookup »
background.js ──▶ lib/lookup.js ──▶ connecteur du catalogue (lib/connectors/*)
      │               1. recherche ISBN (toutes éditions en une requête si possible)
      │               2. sinon titre + auteur, avec vérification de la correspondance
      │               3. exemplaires et disponibilité de chaque notice
      ▼
content/ui.js : pastille puis panneau, mis à jour bibliothèque par bibliothèque
```

| Connecteur | Recherche | Exemplaires |
|---|---|---|
| `syracuse` | `POST /Portal/Recherche/Search.svc/Search` | `POST /Portal/Services/ILSClient.svc/GetHoldings` |
| `inmedia` | `POST /in/rest/api/search` (requête signée, jeton lu dans `/in/rest/api/settings.js`) | `GET /in/rest/api/notice?aspect=Stock` |
| `web2` | `GET /web2/tramp2.exe/do_keyword_search/…` (HTML ISO-8859-1) | tableau de la notice détaillée |
| `encore` | `GET /iii/encore/search/C__S…` (HTML) | tableau de chaque notice |

Détail inMedia : chaque appel porte l'en-tête `X-InMedia-Authorization: Bearer null <jeton public> <empreinte>`. Un jeton refusé ne renvoie pas d'erreur HTTP mais une réponse tronquée (sans `queryid`) : le connecteur ouvre alors une nouvelle session et réessaie, plutôt que de conclure à tort que le livre est absent.

### Ajouter une bibliothèque

Si son catalogue tourne sous Syracuse (URL en `/Default/doc/SYRACUSE/…`) ou inMedia (présence de `/in/rest/api/settings.js`) :

1. Ajoutez une entrée dans `extension/lib/libraries.js`. Pour Syracuse, une ligne `syracuse(id, ville, nom, adresse)` suffit ; passez `{ scenario: 'CATALOGUE' }` si la recherche avancée du portail (`form.aspx?SC=…`) propose ce scénario. Pour inMedia, voir les exemples (`isbnSyntax`).
2. Ajoutez son domaine à `optional_host_permissions` dans `extension/manifest.json` (`npm test` signale un oubli).
3. Vérifiez : `node tools/live-check.mjs <id>`.

## App iPhone

Le dossier [`mobile/`](mobile/README.md) contient l'app iPhone (Expo) : on scanne le code-barres d'un livre et l'app indique sa disponibilité dans les bibliothèques choisies. Elle réutilise les connecteurs de `extension/lib/` sans les copier : une correction de connecteur sert aux deux.

## Développement

L'extension n'a aucune dépendance. Les tests demandent Node 22 ou plus.

```bash
npm test
```

Tests unitaires : ISBN, statuts d'exemplaires, correspondance des titres, connecteurs avec réponses simulées, analyse de vraies pages de Toulouse et Rennes (`tests/fixtures/`), et logique de l'app mobile (`tests/mobile-*`).

```bash
npm run check:live
```

Interroge en direct chaque catalogue avec le code de l'extension, à relancer de temps en temps (les portails changent sans prévenir). Le pare-feu de Bordeaux coupe les clients qui se présentent comme Chrome sans en avoir l'empreinte réseau : pour Bordeaux, lancez `LIVE_UA=node npm run check:live`.

```bash
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node tools/e2e.mjs
```

Test de bout en bout : charge l'extension dans Chrome (profil temporaire, headless), active des bibliothèques, ouvre de vraies fiches et enregistre des captures d'écran. Utilisez un Chrome à jour (Bordeaux refuse les versions anciennes).

`npm run icons` régénère les icônes de l'extension et de l'app mobile.

## Publication sur le Chrome Web Store

- `npm run zip` : paquet `biblib.zip` à envoyer.
- `CHROME_PATH=… node tools/store-assets.mjs` : captures 1280×800, vignette 440×280 et bannière 1400×560 dans `store/`, à partir du vrai panneau en action.
- `CHROME_PATH=… node tools/store-video.mjs` : vidéo de présentation `store/biblib-presentation.mp4` (1920×1080, 29 s, sans son ; ffmpeg requis), animée avec la vraie page de réglages et le vrai panneau (`tools/video/`). Le Store n'accepte qu'un lien YouTube : la mettre en ligne sur YouTube, puis coller le lien dans la fiche.
- [store/fiche.md](store/fiche.md) : textes à copier dans le tableau de bord (fiche, justifications des permissions, confidentialité, distribution).
- [PRIVACY.md](PRIVACY.md) : politique de confidentialité, à publier à une adresse publique.

## Limites connues

- Les catalogues ne publient pas d'API officielle : un changement de portail peut casser un connecteur. `check:live` sert à le détecter.
- Les recherches inMedia n'ont pas d'URL stable : le lien « Chercher sur le catalogue » mène à l'accueil du catalogue.
- Quelques sites marchands (Fnac) affichent parfois une page anti-robot ; l'extension n'y voit alors pas de livre.
- La correspondance par titre peut proposer une adaptation (BD, livre audio). Quand la page donne un ISBN, ces résultats sont signalés « Autre édition » ; sans ISBN (certaines pages Kindle), ils ne le sont pas.
