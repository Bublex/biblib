// Fiche d'un livre : disponibilité dans chaque réseau, exemplaire par exemplaire.
// Même lecture des résultats que le panneau de l'extension (content/ui.js).
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatShortDate } from '../../../../extension/lib/availability.js';
import { Button, Card, Chip, LinkText, ToneDot, openUrl, plural } from '../../components.js';
import { runLookup, summarize, toggleFavorite, useStore } from '../../store.js';
import { toneColors, useColors } from '../../theme.js';

const STATUS_ORDER = { available: 0, unavailable: 1, unknown: 2, loading: 3, absent: 4, error: 6 };
const VISIBLE_ITEMS = 4;

const isFavorite = (settings, libId, branch) => (settings.favorites[libId] || []).includes(branch);

function earliestReturn(items) {
  const today = new Date().toISOString().slice(0, 10);
  return items.filter((i) => i.available === false && i.dueDate && i.dueDate >= today).map((i) => i.dueDate).sort()[0] || null;
}

function itemStatus(item) {
  if (item.available === true) return item.onSiteOnly ? 'Sur place' : 'Disponible';
  if (item.dueDate) return `Retour ${formatShortDate(item.dueDate)}`;
  return item.status.replace(/\s*[–-]\s*retour prévu le.*$/i, '');
}

function chip(result, records) {
  switch (result?.status) {
    case undefined: return ['load', 'Recherche…'];
    case 'available': {
      const n = records.filter((r) => !r.digital).reduce((s, r) => s + (r.availableCount || 0), 0);
      return ['ok', n ? plural(n, 'disponible', 'disponibles') : 'En numérique'];
    }
    case 'unavailable': return ['wait', 'Emprunté'];
    case 'unknown': return ['info', 'À vérifier'];
    case 'absent': return ['none', 'Absent'];
    default: return ['err', 'Injoignable'];
  }
}

function Item({ lib, item, settings }) {
  const c = useColors();
  const fav = isFavorite(settings, lib.id, item.branch);
  const tone = item.available === true ? 'ok' : item.available === false ? 'wait' : 'none';
  const where = lib.showGroups && item.group && !item.branch.includes(item.group) ? `${item.group} — ${item.branch}` : item.branch;
  const details = [item.callNumber && `Cote ${item.callNumber}`, item.location].filter(Boolean).join(' · ');
  return (
    <View style={[styles.item, { borderColor: c.line }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${fav ? 'Retirer' : 'Ajouter'} ${item.branch} ${fav ? 'des' : 'aux'} favorites`}
        accessibilityState={{ selected: fav }}
        hitSlop={8}
        onPress={() => toggleFavorite(lib.id, item.branch)}
      >
        <Text style={[styles.star, { color: fav ? c.star : c.line }]}>{fav ? '★' : '☆'}</Text>
      </Pressable>
      <View style={styles.itemMain}>
        <View style={styles.itemLine}>
          <Text style={[styles.branch, { color: c.fg }, fav && { fontWeight: '700' }]} numberOfLines={2}>{where}</Text>
          <Text style={[styles.itemStatus, { color: toneColors(c, tone).fg }]}>{`● ${itemStatus(item)}`}</Text>
        </View>
        {details ? <Text style={[styles.small, { color: c.muted }]} numberOfLines={1}>{details}</Text> : null}
      </View>
    </View>
  );
}

function Pickup({ items }) {
  const c = useColors();
  const places = new Set(items.filter((i) => i.available === true).map((i) => i.branch)).size;
  const back = earliestReturn(items);
  const [tone, text] = places ? ['ok', `Disponible dans ${plural(places, 'bibliothèque', 'bibliothèques')} du réseau`]
    : items.some((i) => i.available === false) ? ['wait', back ? `Emprunté, retour prévu le ${formatShortDate(back)}` : 'Indisponible pour le moment']
      : ['none', 'Disponibilité à vérifier'];
  return (
    <View style={styles.block}>
      <Text style={[styles.itemStatus, { color: toneColors(c, tone).fg }]}>{`● ${text}`}</Text>
      <Text style={[styles.small, { color: c.muted }]}>Sur réservation, retrait dans la bibliothèque de votre choix</Text>
    </View>
  );
}

function Record({ lib, record, settings, book }) {
  const c = useColors();
  const [expanded, setExpanded] = useState(false);
  const items = [...(record.items || [])].sort((a, b) => Number(isFavorite(settings, lib.id, b.branch)) - Number(isFavorite(settings, lib.id, a.branch)));
  // Réseau avec retrait au choix : détail replié, sauf vos bibliothèques favorites.
  const folded = lib.pickupAnywhere ? items.filter((i) => isFavorite(settings, lib.id, i.branch)) : items.slice(0, VISIBLE_ITEMS);
  const visible = expanded ? items : folded;
  const meta = [record.year, record.type].filter(Boolean).join(' · ');
  const tag = record.digital ? 'Version numérique' : record.sameEdition === false ? (record.match === 'title' ? 'Autre édition (même titre)' : 'Autre édition') : null;
  let note = null;
  if (record.holdingsError) note = `Disponibilité non communiquée : ${record.holdingsError}`;
  else if (!items.length && record.counts) note = `${plural(record.counts.available, 'exemplaire disponible', 'exemplaires disponibles')} sur ${record.counts.total}`;
  else if (!items.length && record.stacksCount) note = 'En réserve uniquement : à demander aux bibliothécaires';
  else if (!items.length) note = 'Aucun exemplaire physique signalé';
  // Même édition que le livre en haut de la fiche : son titre n'apprendrait rien.
  const repeatsBook = record.sameEdition === true && !record.digital && Boolean(book.title);

  return (
    <View style={[styles.record, { borderColor: c.line }]}>
      {repeatsBook ? null : (
        <View>
          <Text style={[styles.recordTitle, { color: c.fg }]}>{record.title || 'Notice sans titre'}</Text>
          {meta || tag ? (
            <View style={styles.recordMeta}>
              {tag ? <Chip tone="wait">{tag}</Chip> : null}
              {meta ? <Text style={[styles.small, { color: c.muted }]}>{meta}</Text> : null}
            </View>
          ) : null}
        </View>
      )}
      {note ? <Text style={[styles.small, { color: c.muted }]}>{note}</Text> : null}
      {lib.pickupAnywhere && items.length ? <Pickup items={items} /> : null}
      {visible.length ? <View>{visible.map((item, i) => <Item key={`${item.branch}-${i}`} lib={lib} item={item} settings={settings} />)}</View> : null}
      {items.length > folded.length ? (
        <LinkText onPress={() => setExpanded(!expanded)} style={styles.small}>
          {expanded ? 'Voir moins'
            : lib.pickupAnywhere ? `Voir le détail par bibliothèque (${plural(items.length, 'exemplaire', 'exemplaires')})`
              : `Voir les ${items.length - folded.length} autres exemplaires`}
        </LinkText>
      ) : null}
      {record.url ? (
        <Button
          kind={record.availableCount > 0 ? 'primary' : 'secondary'}
          title={record.availableCount > 0 ? 'Voir la fiche et réserver' : 'Réserver sur le catalogue'}
          onPress={() => openUrl(record.url)}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
}

function Library({ lib, result, settings, book, onRetry }) {
  const c = useColors();
  const records = result?.records || [];
  const [tone, label] = chip(result, records);
  let note = null;
  if (result?.status === 'absent') {
    const searched = result.searchedBy || [];
    const what = searched.includes('isbn') && searched.includes('title') ? 'Ni cette édition, ni une autre trouvée par titre.'
      : searched.includes('isbn') ? 'Cette édition n’est pas au catalogue.'
        : 'Aucun livre de ce titre au catalogue.';
    note = <Text style={[styles.small, { color: c.muted }]}>{`${what} `}{result.searchUrl ? <LinkText onPress={() => openUrl(result.searchUrl)}>Chercher sur le catalogue</LinkText> : null}</Text>;
  } else if (result?.status === 'error') {
    note = <Text style={[styles.small, { color: c.muted }]}>{`${result.error}. `}<LinkText onPress={onRetry}>Réessayer</LinkText></Text>;
  }
  const dim = ['absent', 'error'].includes(result?.status);
  return (
    <Card style={styles.library}>
      <View style={styles.libraryHead}>
        <Text style={[styles.libraryName, { color: dim ? c.muted : c.fg }]}>{lib.name}</Text>
        <Chip tone={tone}>{label}</Chip>
      </View>
      {note}
      {records.map((record) => <Record key={record.id} lib={lib} record={record} settings={settings} book={book} />)}
    </Card>
  );
}

export default function BookScreen() {
  const c = useColors();
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const book = useStore((s) => s.books.find((b) => b.id === id));
  const lookup = useStore((s) => s.lookups[id]);
  const settings = useStore((s) => s.settings);
  const ready = useStore((s) => s.ready);

  // Livre d'une session précédente : on relance la recherche à l'ouverture.
  useEffect(() => {
    if (book && !lookup) runLookup(id);
  }, [id, book, lookup]);

  if (!book) {
    return (
      <View style={[styles.screen, styles.missing, { backgroundColor: c.bg }]}>
        <Text style={{ color: c.muted }}>{ready ? 'Ce livre n’est plus dans la liste.' : ''}</Text>
      </View>
    );
  }

  const summary = lookup ? summarize(lookup, settings) : null;
  const libs = [...(lookup?.libraries || [])].sort((a, b) =>
    (STATUS_ORDER[lookup.results[a.id]?.status || 'loading'] ?? 9) - (STATUS_ORDER[lookup.results[b.id]?.status || 'loading'] ?? 9));
  const refresh = () => runLookup(id, { force: true });

  return (
    <ScrollView
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={false} onRefresh={refresh} tintColor={c.muted} />}
    >
      <Stack.Screen options={{ title: '' }} />
      <View style={styles.book}>
        <Text style={[styles.bookTitle, { color: c.fg }]}>{book.title || 'Livre scanné'}</Text>
        <Text style={[styles.bookMeta, { color: c.muted }]}>
          {[book.authors?.[0], book.isbn ? `ISBN ${book.isbn}` : 'recherche par titre'].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {summary && !lookup.noLibraries ? (
        <View style={[styles.summary, { backgroundColor: toneColors(c, summary.tone).bg }]}>
          <ToneDot tone={summary.tone} busy={summary.busy} size={30} />
          <View style={styles.summaryText}>
            <Text style={[styles.summaryTitle, { color: c.fg }]}>{summary.title}</Text>
            {summary.detail ? <Text style={[styles.small, { color: c.muted }]}>{summary.detail}</Text> : null}
          </View>
        </View>
      ) : null}

      {lookup?.noLibraries ? (
        <Card style={styles.library}>
          <Text style={[styles.libraryName, { color: c.fg }]}>Choisissez vos bibliothèques</Text>
          <Text style={[styles.small, { color: c.muted }]}>Pour savoir si ce livre y est disponible.</Text>
          <Button title="Choisir mes bibliothèques" onPress={() => router.push('/reglages')} />
        </Card>
      ) : null}

      {libs.map((lib) => (
        <Library key={lib.id} lib={lib} result={lookup.results[lib.id]} settings={settings} book={book} onRetry={refresh} />
      ))}

      {lookup?.done ? <Text style={[styles.footer, { color: c.muted }]}>Tirez vers le bas pour actualiser.</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  book: { gap: 4 },
  bookTitle: { fontSize: 24, fontWeight: '700', lineHeight: 29 },
  bookMeta: { fontSize: 14 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14 },
  summaryText: { flex: 1, gap: 2 },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  library: { gap: 10, padding: 14 },
  libraryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  libraryName: { flex: 1, fontSize: 16, fontWeight: '700' },
  record: { gap: 8, padding: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  recordTitle: { fontSize: 15, fontWeight: '600' },
  recordMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 4 },
  block: { gap: 2 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 7, borderTopWidth: StyleSheet.hairlineWidth },
  star: { fontSize: 18, lineHeight: 20 },
  itemMain: { flex: 1, minWidth: 0 },
  itemLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  branch: { flex: 1, fontSize: 14 },
  itemStatus: { fontSize: 13, fontWeight: '600' },
  small: { fontSize: 13, lineHeight: 18 },
  cta: { marginTop: 4 },
  footer: { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
