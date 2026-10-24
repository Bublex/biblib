// Réglages : bibliothèques interrogées, repli par titre, favoris et données enregistrées.
import Constants from 'expo-constants';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { LIBRARIES, getLibrary } from '../../../extension/lib/libraries.js';
import { stripAccents } from '../../../extension/lib/text.js';
import { Button, Card, LinkText, openUrl } from '../components.js';
import { clearBooks, setLibraryEnabled, setTitleFallback, toggleFavorite, useStore } from '../store.js';
import { useColors } from '../theme.js';

// « merignac » trouve « Mérignac », « baroeul » trouve « Barœul » : comparaison sans accents ni majuscules.
const fold = (s) => stripAccents(s).toLowerCase().replace(/œ/g, 'oe').replace(/’/g, "'");
const BY_CITY = [...LIBRARIES]
  .sort((a, b) => a.city.localeCompare(b.city, 'fr'))
  .map((lib) => ({ lib, host: new URL(lib.base).host, search: fold(`${lib.city} ${lib.name} ${lib.short} ${new URL(lib.base).host}`) }));

function Section({ title, description, children }) {
  const c = useColors();
  return (
    <Card style={styles.section}>
      <Text style={[styles.sectionTitle, { color: c.fg }]}>{title}</Text>
      {description ? <Text style={[styles.text, { color: c.muted }]}>{description}</Text> : null}
      {children}
    </Card>
  );
}

function LibraryRow({ lib, host, enabled }) {
  const c = useColors();
  return (
    <Pressable
      onPress={() => setLibraryEnabled(lib.id, !enabled)}
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled }}
      accessibilityLabel={`${lib.city}, ${lib.name}`}
      style={[styles.lib, { borderColor: enabled ? c.accent : c.line, backgroundColor: enabled ? c.soft : 'transparent' }]}
    >
      <View style={styles.libText}>
        <Text style={[styles.libCity, { color: c.fg }]}>{lib.city}</Text>
        <Text style={[styles.small, { color: c.muted }]}>{lib.name}</Text>
        <Text style={[styles.tiny, { color: c.muted }]}>{host}</Text>
      </View>
      <Switch value={enabled} onValueChange={(on) => setLibraryEnabled(lib.id, on)} trackColor={{ true: c.accent }} />
    </Pressable>
  );
}

export default function Settings() {
  const c = useColors();
  const settings = useStore((s) => s.settings);
  const bookCount = useStore((s) => s.books.length);
  const [filter, setFilter] = useState('');
  const [showAll, setShowAll] = useState(false);

  const words = fold(filter).split(/\s+/).filter(Boolean);
  const enabled = new Set(settings.enabledLibraries);
  // Sans recherche, seulement les bibliothèques cochées : la liste complète compte plus de 60 réseaux.
  const shown = words.length ? BY_CITY.filter((row) => words.every((w) => row.search.includes(w)))
    : showAll ? BY_CITY : BY_CITY.filter((row) => enabled.has(row.lib.id));
  const enabledNames = settings.enabledLibraries.map((id) => getLibrary(id)?.short).filter(Boolean);
  const favorites = useMemo(() => Object.entries(settings.favorites).flatMap(([libId, branches]) => branches.map((branch) => ({ libId, branch }))), [settings.favorites]);

  const confirmClear = () => Alert.alert('Effacer les livres scannés ?', 'La liste est vidée sur ce téléphone. Vos bibliothèques et vos favoris sont conservés.', [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Effacer', style: 'destructive', onPress: clearBooks },
  ]);

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Section
        title="Mes bibliothèques"
        description={enabledNames.length ? `Cochées : ${enabledNames.join(', ')}.` : `Cherchez votre ville parmi les ${LIBRARIES.length} réseaux pris en charge, puis cochez ceux où vous êtes inscrit·e.`}
      >
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="Chercher une ville ou un réseau"
          placeholderTextColor={c.muted}
          autoCorrect={false}
          clearButtonMode="while-editing"
          style={[styles.input, { color: c.fg, borderColor: c.line, backgroundColor: c.bg }]}
        />
        {shown.map(({ lib, host }) => <LibraryRow key={lib.id} lib={lib} host={host} enabled={enabled.has(lib.id)} />)}
        {words.length && !shown.length ? <Text style={[styles.text, { color: c.muted }]}>Aucune bibliothèque ne correspond à cette recherche.</Text> : null}
        {!words.length ? (
          <LinkText onPress={() => setShowAll(!showAll)} style={styles.small}>
            {showAll ? 'Seulement mes bibliothèques' : `Voir les ${LIBRARIES.length} réseaux`}
          </LinkText>
        ) : null}
      </Section>

      <Section title="Recherche">
        <View style={styles.option}>
          <View style={styles.optionText}>
            <Text style={[styles.optionTitle, { color: c.fg }]}>Si l’édition scannée est introuvable, chercher par titre et auteur</Text>
            <Text style={[styles.small, { color: c.muted }]}>Utile quand la bibliothèque possède une autre édition (poche, réédition…). Le titre est demandé à la Bibliothèque nationale de France à partir de l’ISBN.</Text>
          </View>
          <Switch value={settings.titleFallback} onValueChange={setTitleFallback} trackColor={{ true: c.accent }} />
        </View>
      </Section>

      <Section title="Mes bibliothèques favorites" description="Touchez l’étoile d’une bibliothèque dans la fiche d’un livre : elle apparaît en premier, et la liste vous dit si le livre y est disponible.">
        {favorites.length ? (
          <View style={styles.chips}>
            {favorites.map(({ libId, branch }) => (
              <Pressable
                key={`${libId}:${branch}`}
                accessibilityRole="button"
                accessibilityLabel={`Retirer ${branch} des favorites`}
                onPress={() => toggleFavorite(libId, branch)}
                style={[styles.chip, { borderColor: c.line }]}
              >
                <Text style={{ color: c.fg }}>{branch}<Text style={{ color: c.muted }}>{` · ${getLibrary(libId)?.short || libId}  ✕`}</Text></Text>
              </Pressable>
            ))}
          </View>
        ) : <Text style={[styles.text, { color: c.muted }]}>Aucune pour l’instant.</Text>}
      </Section>

      <Section title="Vos données restent sur ce téléphone">
        <Text style={[styles.text, { color: c.fg }]}>• Vos réglages, favoris et livres scannés sont enregistrés uniquement sur ce téléphone : pas de compte, pas de serveur Biblib, aucune statistique.</Text>
        <Text style={[styles.text, { color: c.fg }]}>• L’ISBN du livre scanné est envoyé aux catalogues que vous avez cochés, et à la BnF quand il faut retrouver son titre.</Text>
        <Text style={[styles.text, { color: c.fg }]}>• La réservation se fait sur le site de votre bibliothèque, avec votre compte lecteur : Biblib ne voit ni votre numéro de carte ni votre mot de passe.</Text>
        {bookCount ? <Button kind="secondary" title={`Effacer les livres scannés (${bookCount})`} onPress={confirmClear} /> : null}
      </Section>

      <Text style={[styles.footer, { color: c.muted }]}>
        {`Biblib ${Constants.expoConfig?.version || ''} · `}
        <LinkText onPress={() => openUrl('https://github.com/Bublex/biblib')}>Code source</LinkText>
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  text: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 13, lineHeight: 18 },
  tiny: { fontSize: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 16 },
  lib: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  libText: { flex: 1, minWidth: 0 },
  libCity: { fontSize: 15, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { fontSize: 15, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  footer: { fontSize: 12, textAlign: 'center' },
});
