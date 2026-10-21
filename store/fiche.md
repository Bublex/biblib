# Publication sur le Chrome Web Store

Tout ce qu'il faut copier-coller dans le [tableau de bord développeur](https://chrome.google.com/webstore/devconsole), onglet par onglet. (Chrome interdit aux extensions et aux navigateurs automatisés d'agir sur ces pages : le formulaire se remplit à la main.)

## Ordre des étapes

1. **Compte** (menu de gauche) : renseigner et **valider l'adresse e-mail de contact** (un lien de confirmation est envoyé), et répondre à la déclaration « professionnel / non professionnel » (*trader*) : pour un projet personnel gratuit, « non professionnel ».
2. **Nouvel élément** → importer `biblib.zip`.
3. Onglet **Fiche** : textes et visuels ci-dessous.
4. Onglet **Pratiques de confidentialité** : réponses ci-dessous.
5. Onglet **Distribution** : visibilité et régions.
6. **Envoyer pour examen** (quelques jours en général ; un e-mail annonce le résultat).

## Fichiers à envoyer

| Élément | Fichier |
|---|---|
| Paquet | `biblib.zip` (généré par `npm run zip`) |
| Icône de la fiche (128×128) | `extension/icons/icon128.png` |
| Vignette promotionnelle (440×280, obligatoire) | `store/vignette-440x280.png` |
| Bannière (1400×560, facultative) | `store/banniere-1400x560.png` |
| Captures d'écran (1280×800, de 1 à 5) | `store/captures/1.png` à `5.png` |

Les visuels se régénèrent avec `node tools/store-assets.mjs` (voir le README).

## Onglet « Fiche Play Store » (Store listing)

**Nom** (repris du manifeste) : Biblib : ce livre est-il dans ma bibliothèque ?

**Résumé** (repris du manifeste, 109 caractères sur 132 ; sans nom de site, comme la description) :
Sur la fiche d'un livre en ligne, voyez s'il est dans vos bibliothèques, s'il est disponible, et réservez-le.

**Catégorie** : Outils

**Langue** : Français

**Description** (pas d'énumération de sites ni de villes : un premier envoi a été refusé pour « spam dans les mots clés » à cause de la liste des sites de livres) :

```
Ce livre est-il à la bibliothèque ? Biblib vous répond directement sur la fiche du livre, sans quitter la page.

Chez votre libraire en ligne ou sur votre site de lecture habituel, une pastille indique en quelques secondes si le livre est dans vos bibliothèques municipales, s'il est disponible et dans quelle annexe. Un clic ouvre la notice du catalogue pour le réserver avec votre compte lecteur.

CE QUE BIBLIB VOUS MONTRE
• Disponible, emprunté, en transit, date de retour prévue : annexe par annexe, avec la cote et le rayon.
• Les autres éditions aussi : recherche par ISBN, toutes éditions connues confondues (poche, grand format…), puis par titre et auteur. Les autres éditions sont clairement signalées.
• Vos bibliothèques favorites : une étoile sur votre annexe, elle passe en premier et la pastille vous dit si le livre y est.
• Une recherche manuelle par ISBN ou par titre depuis l'icône de l'extension.

VOS BIBLIOTHÈQUES
Biblib interroge les catalogues de grands réseaux de bibliothèques publiques en France. Leur liste figure dans les réglages de l'extension : cochez ceux où vous êtes inscrit·e, Biblib n'interroge que ceux-là.

VOS DONNÉES RESTENT SUR VOTRE APPAREIL
• Aucun compte, aucun serveur Biblib, aucune statistique, aucun traceur.
• Vos réglages et favoris sont enregistrés uniquement sur cet appareil.
• Seuls l'ISBN, le titre et l'auteur du livre consulté sont envoyés, et uniquement aux catalogues des bibliothèques que vous avez choisies.
• L'accès à chaque catalogue est demandé au moment où vous cochez la bibliothèque, et retiré quand vous la décochez.
• La réservation se fait sur le site de votre bibliothèque : Biblib ne voit ni votre carte ni votre mot de passe.

POUR COMMENCER
1. Installez l'extension : la page de réglages s'ouvre.
2. Cochez les bibliothèques où vous êtes inscrit·e.
3. Ouvrez la fiche d'un livre sur votre site habituel.

Biblib est un projet indépendant, qui n'est affilié à aucune bibliothèque ni à aucun site de livres. La disponibilité affichée est celle que publie le catalogue de chaque bibliothèque au moment de la recherche.
```

**Site officiel** : https://github.com/Bublex/biblib

**URL d'assistance** : https://github.com/Bublex/biblib/issues

## Onglet « Pratiques de confidentialité » (Privacy)

**Objectif unique** :

```
Afficher, sur la fiche d'un livre consultée en ligne, si ce livre est présent et disponible dans les bibliothèques publiques choisies par l'utilisateur, avec un lien vers la notice du catalogue pour le réserver.
```

**Justification de « storage »** :

```
Enregistrer sur l'appareil, et seulement sur l'appareil, les bibliothèques choisies par l'utilisateur, ses annexes favorites et ses préférences d'affichage. Aucune synchronisation, aucun envoi.
```

**Justification des autorisations d'hôte** (sites de livres et catalogues) :

```
Sites de livres (Amazon, Babelio, Bedetheque, Fnac…) : le script de contenu lit l'ISBN, le titre et l'auteur du livre affiché et affiche la pastille de disponibilité. Il ne lit rien d'autre et n'envoie rien tant qu'aucun livre n'est détecté.
Catalogues de bibliothèques (autorisations optionnelles) : interroger le catalogue public de chaque bibliothèque cochée par l'utilisateur (recherche par ISBN ou titre, disponibilité des exemplaires). Chaque autorisation est demandée au moment où l'utilisateur coche la bibliothèque et retirée quand il la décoche.
```

**Code distant** : Non, je n'utilise pas de code distant.

**Utilisation des données** : cocher uniquement « Contenu des sites Web ». Explication si demandée :

```
L'ISBN, le titre et l'auteur du livre affiché sont transmis, depuis le navigateur, aux seuls catalogues des bibliothèques choisies par l'utilisateur, pour vérifier la disponibilité. Rien n'est transmis au développeur.
```

Cocher les trois certifications (pas de vente à des tiers, pas d'usage sans rapport avec l'objectif unique, pas d'usage pour évaluer la solvabilité).

**URL des règles de confidentialité** : https://github.com/Bublex/biblib/blob/main/PRIVACY.md

## Onglet « Distribution »

- **Visibilité** : commencer en « Non répertorié » pour tester avec quelques proches, puis passer en « Public ».
- **Régions** : France (ou toutes : l'extension ne sert qu'aux bibliothèques listées).
- **Tarif** : gratuit.

## Note pour l'examen (si un champ le permet)

```
Pour tester : ouvrez les réglages de l'extension, cochez « Lyon » (autorisez l'accès), puis ouvrez https://www.babelio.com/livres/Damasio-La-Horde-du-Contrevent/5420. Une pastille apparaît en bas à droite ; cliquez dessus pour voir les exemplaires.
```

## Avant chaque mise à jour

1. `npm test` et `LIVE_UA=node npm run check:live` (catalogues toujours joignables).
2. Augmenter `version` dans `extension/manifest.json`.
3. `npm run zip`, puis « Importer un nouveau package » dans le tableau de bord.
