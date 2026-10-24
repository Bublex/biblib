# Scanner un livre avec votre téléphone

Chez un ami ou en librairie, l'extension Chrome ne vous aide pas. Un raccourci sur le téléphone suffit : il scanne le code-barres au dos du livre (c'est son ISBN) et ouvre la recherche de ce livre dans le catalogue de votre bibliothèque. Vous y voyez la notice et les exemplaires disponibles, et vous pouvez réserver avec votre compte lecteur.

Il n'y a rien à installer sur iPhone. Sur Android, il faut une application gratuite. Dans les deux cas, aucun serveur Biblib n'intervient : le téléphone ouvre directement la page du catalogue.

## 1. Récupérer l'adresse de votre catalogue

Dans l'extension, ouvrez la fenêtre Biblib et cliquez sur **Sur téléphone**. C'est aussi la dernière section des réglages, **Sur votre téléphone**. Pour chaque bibliothèque cochée, Biblib affiche son adresse de recherche avec `{RESULT}` à la place de l'ISBN, et un bouton **Copier**.

Pour l'envoyer sur le téléphone : presse-papiers universel entre Mac et iPhone, une note, ou un message à vous-même.

Quelques exemples :

| Réseau | Adresse |
|---|---|
| Mérignac | `https://www.mediatheque.merignac.com/Default/search.aspx?SC=DEFAULT&QUERY={RESULT}` |
| Paris | `https://bibliotheques.paris.fr/Default/search.aspx?SC=CATALOGUE&QUERY={RESULT}` |
| Rennes (Champs Libres) | `https://opac.si.leschampslibres.fr/iii/encore/search/C__S{RESULT}__Orightresult__U?lang=frf` |
| Toulouse | `http://catalogues.toulouse.fr/web2/tramp2.exe/do_keyword_search/log_in?setting_key=BMT1&servers=1home&index=default&query={RESULT}` |

Les autres réseaux Syracuse suivent le même modèle que Mérignac ou Paris. Les catalogues inMedia (Bordeaux, Bordeaux Métropole, Lyon, Marseille, Nantes) n'ont pas d'adresse de recherche directe : le raccourci n'est pas possible pour eux.

## 2. iPhone : app Raccourcis

1. Ouvrez **Raccourcis** et touchez **+**.
2. Ajoutez l'action de scan : cherchez « code-barres » dans les actions et choisissez celle qui scanne un code QR ou un code-barres.
3. Ajoutez l'action **URL**. Collez l'adresse, sélectionnez `{RESULT}` et remplacez-le par la variable produite par le scan, proposée au-dessus du clavier.
4. Ajoutez l'action **Ouvrir les URL**.
5. Renommez le raccourci, par exemple « Biblib ».
6. Pour l'avoir sous la main : ajoutez-le à l'écran d'accueil, au bouton Action si votre iPhone en a un, ou au « Toucher le dos » (Réglages → Accessibilité → Toucher). « Dis Siri, Biblib » fonctionne aussi.

Plusieurs bibliothèques : après le scan, ajoutez l'action **Choisir dans le menu** avec une entrée par réseau et une action **URL** dans chaque entrée, puis une seule action **Ouvrir les URL** après le menu.

## 3. Android : app Binary Eye

[Binary Eye](https://github.com/markusfisch/BinaryEye) est un lecteur de codes-barres gratuit et open source, sur [Google Play](https://play.google.com/store/apps/details?id=de.markusfisch.android.binaryeye) et [F-Droid](https://f-droid.org/packages/de.markusfisch.android.binaryeye/).

1. Installez Binary Eye.
2. Dans ses réglages, section **Contenu**, ouvrez **Actions automatiques** puis **Ajouter une action**.
3. Expression régulière : `97[89][0-9]{10}`. Elle ne reconnaît que les codes-barres de livres (ISBN-13) : les autres codes scannés restent traités normalement.
4. Type d'action : **Ouvrir l'URL**. Modèle d'URL : l'adresse copiée, telle quelle, avec `{RESULT}`.
5. Scannez un livre : le catalogue s'ouvre dans le navigateur.

Une action automatique n'ouvre qu'une adresse : choisissez la bibliothèque où vous empruntez le plus.

Sans **Actions automatiques** (versions anciennes de Binary Eye), utilisez le réglage **Ouvrir les données inconnues avec l'URL** : collez l'adresse sans `{RESULT}`, ce qui ne marche que si l'adresse se termine par `{RESULT}` (Syracuse, Toulouse). Après un scan, touchez **Rechercher sur internet** et choisissez cette adresse.

## Ce que le raccourci ne fait pas

- **Pas de résumé Biblib** : vous voyez la page du catalogue, une bibliothèque à la fois.
- **Recherche par ISBN seulement** : si la bibliothèque a une autre édition (poche, réédition), la recherche peut ne rien trouver. Cherchez alors par titre sur le catalogue, ou avec l'extension.
- **Pas de favoris** ni de tri par annexe.
