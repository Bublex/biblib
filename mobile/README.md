# Biblib pour iPhone

Scannez le code-barres d'un livre, chez un ami ou en librairie : Biblib vous dit s'il est dans vos bibliothèques, s'il est disponible et dans quelle annexe. La caméra lit les codes en continu, ce qui permet de scanner une étagère livre après livre ; la liste se remplit au fur et à mesure que les catalogues répondent.

App Expo (React Native), SDK 58. Les routes sont dans `src/app/` (Expo Router).

## Ce qui vient de l'extension

L'app n'a pas sa propre copie des connecteurs : elle importe `../extension/lib/` (recherche, connecteurs Syracuse, inMedia, Web2 et Encore, registre des bibliothèques) et le résumé de disponibilité de `../extension/content/ui.js`. Une correction faite pour l'extension profite donc aussi à l'app.

- `metro.config.js` : Metro compile aussi `../extension`.
- `src/polyfills.js` : comble les écarts entre le moteur JavaScript de l'app et un navigateur :
  - décodage ISO-8859-1 pour Toulouse ;
  - `crypto.randomUUID` pour inMedia ;
  - erreurs de `fetch` qui suivent le comportement d'un navigateur, pour que les messages « catalogue injoignable » et « trop long » restent justes.
- `app.config.js` : lit `extension/lib/libraries.js` pour autoriser sur iOS les catalogues encore servis en HTTP (Toulouse, SITPI).

Ce qui est propre à l'app :

- `src/search.js` : l'orchestration des recherches. Un code-barres ne donne que l'ISBN ; quand une bibliothèque n'a pas cette édition, le titre est demandé à la BnF (`src/bnf.js`), à défaut repris d'une notice trouvée ailleurs, puis cherché dans ce catalogue (« Autre édition »).
- `src/store.js` : les réglages, les favoris et la liste des livres scannés, enregistrés sur le téléphone.

Les tests (`npm test` à la racine du dépôt) couvrent l'orchestration, la lecture des réponses de la BnF et le décodage ISO-8859-1.

## Essayer sur votre iPhone

```bash
cd mobile
npm install
```

**Avec Expo Go** (le plus rapide) : installez Expo Go depuis l'App Store, lancez `npx expo start`, puis scannez le QR code avec l'appareil photo de l'iPhone (Mac et iPhone sur le même Wi-Fi). Limite : Expo Go n'applique pas les exceptions HTTP de l'app, donc Toulouse et le SITPI n'y répondent pas.

**Version native, sur l'iPhone branché au Mac** : `npx expo run:ios --device`. Il faut Xcode, et choisir votre équipe de développement à la première compilation (Xcode → Signing & Capabilities).

## Publier sur l'App Store

1. **Identifiant de l'app** : `com.bublex.biblib` dans `app.json` (`ios.bundleIdentifier`). Changez-le avant la première publication si vous préférez un autre identifiant : il ne pourra plus changer ensuite.
2. **Compte Expo** : `npx eas-cli@latest login`, puis `npx eas-cli@latest init` (ajoute l'identifiant du projet à `app.json`).
3. **Compilation** : `npx eas-cli@latest build --platform ios --profile production`. EAS se connecte à votre compte Apple Developer et crée les certificats et profils. Le numéro de build est incrémenté automatiquement.
4. **Envoi** : `npx eas-cli@latest submit --platform ios`. La build arrive dans App Store Connect, testable dans TestFlight en quelques minutes.
5. **Fiche App Store** (App Store Connect) :
   - catégorie Livres (ou Références), âge 4+ ;
   - confidentialité : « Données non collectées » (rien n'est envoyé au développeur) ;
   - URL de la politique de confidentialité : [PRIVACY.md](../PRIVACY.md) sur GitHub, section « L'app iPhone » ;
   - captures d'écran iPhone 6,9 pouces, faites sur l'iPhone ou dans le simulateur ;
   - note pour la revue : *« L'app interroge les catalogues publics des bibliothèques municipales choisies par l'utilisateur, comme le ferait un navigateur. Aucun compte n'est nécessaire. Pour tester : Réglages → cocher Paris ou Mérignac, puis scanner le code-barres d'un livre, ou saisir l'ISBN 9782070612758. »*

Sans EAS, avec Xcode : `npx expo prebuild --platform ios`, ouvrir `ios/Biblib.xcworkspace`, puis Product → Archive → Distribute App. Le dossier `ios/` est généré : ne le modifiez pas à la main, il est ignoré par git.

## À vérifier sur un vrai iPhone

Le code des catalogues est celui de l'extension, mais l'app n'a encore été testée qu'avec des catalogues simulés :

- **Bordeaux** : le pare-feu coupe les clients qui imitent Chrome. L'app se présente comme une app iOS, ce qui devrait passer, comme `LIVE_UA=node` pour `check:live`.
- **Toulouse** : la page anti-robot pose un cookie puis redirige en JavaScript, et le connecteur suit cette redirection ; il faut confirmer que le cookie est bien conservé par iOS.
- **BnF** : la réponse réelle à la recherche par ISBN (`bib.fuzzyISBN`), lue avec `src/bnf.js`.
- **Scan** : distance et lumière (bouton Lampe), codes-barres abîmés ou courbés.
