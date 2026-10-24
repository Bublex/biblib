# Politique de confidentialité de Biblib

*Dernière mise à jour : 24 octobre 2026*

Biblib est une extension Chrome qui indique, sur la fiche d'un livre consultée en ligne, si ce livre est présent et disponible dans les bibliothèques publiques que vous avez choisies. L'app iPhone Biblib fait de même pour un livre dont vous scannez le code-barres ; elle est décrite [plus bas](#lapp-iphone).

## En résumé

Biblib ne collecte aucune donnée personnelle. Il n'existe ni compte Biblib, ni serveur Biblib, ni statistiques d'utilisation. Vos réglages restent sur votre appareil.

## Ce que l'extension lit

Sur les sites de livres listés dans l'extension (par exemple Amazon, Babelio, Bedetheque, Fnac, Decitre), Biblib lit dans la page l'ISBN, le titre et l'auteur du livre affiché. Rien d'autre n'est lu, et rien n'est lu sur les autres sites.

## Ce que l'extension envoie, et à qui

Quand un livre est détecté, Biblib envoie son ISBN, son titre et son auteur **uniquement aux catalogues des bibliothèques que vous avez cochées** dans les réglages, pour savoir si le livre y est et s'il est disponible. Ces requêtes partent directement de votre navigateur vers le site de la bibliothèque, sans passer par un intermédiaire, et sans indiquer la page d'où vous venez.

Comme pour toute visite d'un site web, la bibliothèque interrogée reçoit votre adresse IP ; ses propres règles de confidentialité s'appliquent. Certains catalogues déposent un cookie technique de session, nécessaire à leur fonctionnement.

Aucune donnée n'est envoyée au développeur de Biblib, ni vendue, ni partagée avec des tiers à des fins publicitaires ou autres.

## Ce que l'extension enregistre

Dans le stockage local de Chrome (`chrome.storage.local`), sur votre appareil uniquement :

- la liste des bibliothèques que vous avez choisies ;
- vos annexes favorites ;
- vos préférences d'affichage et les sites où vous avez masqué Biblib.

Ces réglages ne sont pas synchronisés avec votre compte Google. Les résultats de recherche sont gardés 15 minutes en mémoire de session et effacés à la fermeture du navigateur. Désinstaller l'extension supprime toutes ces données.

## Réservation

La réservation se fait sur le site de la bibliothèque, avec votre compte lecteur. Biblib ne voit ni votre numéro de carte, ni votre mot de passe, ni vos prêts.

## Autorisations

- **Stockage** : mémoriser vos réglages sur votre appareil.
- **Accès aux sites de livres listés** : lire l'ISBN, le titre et l'auteur du livre affiché, et afficher la pastille de disponibilité.
- **Accès aux catalogues des bibliothèques** : demandé une bibliothèque à la fois, au moment où vous la cochez, et retiré quand vous la décochez.

## L'app iPhone

L'app suit les mêmes principes que l'extension : ni compte, ni serveur Biblib, ni statistiques, ni publicité.

- **Appareil photo** : il sert uniquement à lire le code-barres au dos d'un livre. L'image est analysée sur le téléphone ; elle n'est ni enregistrée, ni envoyée.
- **Ce qui est envoyé** : l'ISBN du livre scanné (ou le texte que vous saisissez) part **uniquement vers les catalogues des bibliothèques que vous avez cochées**, directement depuis le téléphone. Si cette édition n'y est pas et que l'option « chercher par titre et auteur » est active, l'ISBN est aussi envoyé au catalogue général de la Bibliothèque nationale de France (catalogue.bnf.fr) pour obtenir le titre et l'auteur, qui sont ensuite cherchés dans vos catalogues.
- **Ce qui est enregistré sur le téléphone** : vos bibliothèques, vos annexes favorites, l'option de recherche par titre, et la liste des livres scannés avec leur dernier résultat. Le bouton « Effacer les livres scannés » des réglages vide cette liste ; supprimer l'app efface tout.
- Comme pour l'extension, chaque catalogue interrogé reçoit votre adresse IP et peut déposer un cookie technique de session ; la réservation se fait sur le site de la bibliothèque, avec votre compte lecteur.

## Indépendance

Biblib n'est affilié à aucune bibliothèque ni à aucun des sites cités.

## Contact

Pour toute question : [ouvrez un ticket sur GitHub](https://github.com/Bublex/biblib/issues). Le code source de l'extension est public : <https://github.com/Bublex/biblib>.

---

## English summary

Biblib collects no personal data: no account, no server, no analytics. Settings are stored locally (`chrome.storage.local`, not synced). On supported book sites, the extension reads the ISBN, title and author of the displayed book and sends them only to the public catalogs of the libraries the user selected, directly from the browser, to check availability. Nothing is sent to the developer, sold, or shared for any other purpose.

The iPhone app uses the camera only to read a book's barcode on the device; images are neither stored nor sent. The scanned ISBN is sent only to the selected library catalogs and, when that edition is missing and title search is enabled, to the French National Library catalog (catalogue.bnf.fr) to get the title and author. Settings, favorites and the list of scanned books are stored on the phone only.
