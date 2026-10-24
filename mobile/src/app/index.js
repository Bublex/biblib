// Écran principal : la caméra lit les codes-barres en continu, chaque livre scanné rejoint la liste
// et sa disponibilité s'affiche dès que les catalogues répondent. Pratique devant l'étagère d'un ami.
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Stack, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { toIsbn13 } from '../../../extension/lib/isbn.js';
import { Button, Card, ToneDot } from '../components.js';
import { addBook, getState, removeBook, summarize, useStore } from '../store.js';
import { useColors } from '../theme.js';

const SAME_CODE_DELAY = 4000;

// Dans un navigateur, la caméra n'est accessible qu'en HTTPS (ou sur localhost). Sur http://192.168.x.x,
// navigator.mediaDevices n'existe pas : la demande d'autorisation échoue sans rien afficher.
const webWithoutCamera = Platform.OS === 'web' && !globalThis.isSecureContext;

function Scanner({ onScan }) {
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);

  let content;
  if (webWithoutCamera) {
    content = (
      <View style={styles.cameraMessage}>
        <Text style={styles.cameraText}>Le navigateur n’autorise pas l’appareil photo sur une adresse en http://. Ouvrez Biblib avec l’app Expo Go (QR code du terminal), ou saisissez un ISBN ci-dessous.</Text>
      </View>
    );
  } else if (!permission) {
    content = null;
  } else if (!permission.granted) {
    content = (
      <View style={styles.cameraMessage}>
        <Text style={styles.cameraText}>Biblib lit le code-barres au dos des livres avec l’appareil photo.</Text>
        {permission.canAskAgain
          ? <Button title="Autoriser l’appareil photo" onPress={requestPermission} />
          : <Button title="Ouvrir les réglages de l’iPhone" onPress={() => Linking.openSettings()} />}
      </View>
    );
  } else {
    content = (
      <>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          active={focused}
          enableTorch={torch && focused}
          barcodeScannerSettings={{ barcodeTypes: ['ean13'] }}
          onBarcodeScanned={focused ? onScan : undefined}
        />
        <View pointerEvents="none" style={styles.frame} />
        <Text pointerEvents="none" style={styles.cameraHint}>Visez le code-barres au dos du livre</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
          onPress={() => setTorch(!torch)}
          style={[styles.torch, torch && { backgroundColor: 'rgba(255, 255, 255, 0.9)' }]}
        >
          <Text style={[styles.torchText, torch && { color: '#1d1d1f' }]}>Lampe</Text>
        </Pressable>
      </>
    );
  }
  return <View style={styles.camera}>{content}</View>;
}

function BookRow({ book, lookup, settings, onPress, onLongPress }) {
  const c = useColors();
  const live = lookup ? summarize(lookup, settings) : null;
  const s = live || book.summary || { tone: 'none', title: 'Pas encore cherché' };
  const heading = book.title || `ISBN ${book.isbn}`;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${heading}. ${s.title}${s.detail ? `, ${s.detail}` : ''}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.surface, borderColor: c.line }, pressed && { opacity: 0.7 }]}
    >
      <ToneDot tone={s.tone} busy={live?.busy} />
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: c.fg }]} numberOfLines={2}>{heading}</Text>
        <Text style={[styles.rowStatus, { color: c.fg }]} numberOfLines={1}>
          {s.title}
          {s.detail ? <Text style={{ color: c.muted, fontWeight: '400' }}>{` · ${s.detail}`}</Text> : null}
        </Text>
      </View>
      <Text style={[styles.chevron, { color: c.muted }]}>›</Text>
    </Pressable>
  );
}

export default function Home() {
  const c = useColors();
  const router = useRouter();
  const ready = useStore((s) => s.ready);
  const settings = useStore((s) => s.settings);
  const books = useStore((s) => s.books);
  const lookups = useStore((s) => s.lookups);
  const [query, setQuery] = useState('');
  const last = useRef({ code: null, at: 0 });

  const open = (id) => router.push({ pathname: '/livre/[id]', params: { id } });

  // La caméra signale le même code plusieurs fois par seconde : un seul ajout par livre présenté.
  const onScan = useCallback(({ data }) => {
    const isbn = toIsbn13(data);
    if (!isbn || !/^97[89]/.test(isbn)) return;
    const now = Date.now();
    const repeated = last.current.code === isbn && now - last.current.at < SAME_CODE_DELAY;
    last.current = { code: isbn, at: now };
    if (repeated || getState().books[0]?.id === isbn) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    addBook(isbn);
  }, []);

  const submit = () => {
    const id = addBook(query);
    if (!id) return;
    setQuery('');
    open(id);
  };

  const confirmRemove = (book) => Alert.alert('Retirer ce livre de la liste ?', book.title || `ISBN ${book.isbn}`, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Retirer', style: 'destructive', onPress: () => removeBook(book.id) },
  ]);

  const noLibraries = ready && settings.enabledLibraries.length === 0;

  return (
    <View style={[styles.screen, { backgroundColor: c.bg }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable accessibilityRole="button" hitSlop={10} onPress={() => router.push('/reglages')}>
              <Text style={{ color: c.accent, fontSize: 16 }}>Réglages</Text>
            </Pressable>
          ),
        }}
      />
      <Scanner onScan={onScan} />
      <FlatList
        data={books}
        keyExtractor={(b) => b.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={(
          <View style={styles.header}>
            <TextInput
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={submit}
              placeholder="ISBN, ou titre et auteur"
              placeholderTextColor={c.muted}
              returnKeyType="search"
              autoCorrect={false}
              clearButtonMode="while-editing"
              style={[styles.input, { color: c.fg, backgroundColor: c.surface, borderColor: c.line }]}
            />
            {noLibraries ? (
              <Card style={styles.setup}>
                <Text style={[styles.setupTitle, { color: c.fg }]}>Choisissez vos bibliothèques</Text>
                <Text style={[styles.setupText, { color: c.muted }]}>Paris, Bordeaux, Lyon, Mérignac… Biblib vous dira si les livres scannés y sont, et s’ils sont disponibles.</Text>
                <Button title="Choisir mes bibliothèques" onPress={() => router.push('/reglages')} />
              </Card>
            ) : null}
            {books.length ? <Text style={[styles.section, { color: c.muted }]}>Livres scannés</Text> : null}
          </View>
        )}
        ListEmptyComponent={ready && !noLibraries ? (
          <Text style={[styles.empty, { color: c.muted }]}>Les livres scannés s’affichent ici, avec leur disponibilité dans vos bibliothèques. Appui long sur un livre pour le retirer.</Text>
        ) : null}
        renderItem={({ item }) => (
          <BookRow book={item} lookup={lookups[item.id]} settings={settings} onPress={() => open(item.id)} onLongPress={() => confirmRemove(item)} />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  camera: { height: 230, marginHorizontal: 16, borderRadius: 18, overflow: 'hidden', justifyContent: 'center', backgroundColor: '#000' },
  cameraMessage: { padding: 20, gap: 14 },
  cameraText: { color: '#f1f1f3', fontSize: 15, textAlign: 'center' },
  frame: { position: 'absolute', alignSelf: 'center', width: '72%', height: 92, borderRadius: 12, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.85)' },
  cameraHint: { position: 'absolute', bottom: 12, alignSelf: 'center', color: '#fff', fontSize: 13, fontWeight: '600', textShadowColor: 'rgba(0, 0, 0, 0.6)', textShadowRadius: 4 },
  torch: { position: 'absolute', top: 10, right: 10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  torchText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  header: { paddingTop: 12, gap: 12 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  setup: { gap: 10 },
  setupTitle: { fontSize: 17, fontWeight: '700' },
  setupText: { fontSize: 14, lineHeight: 20 },
  section: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 4 },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowStatus: { fontSize: 13, fontWeight: '600' },
  chevron: { fontSize: 24, marginTop: -2 },
});
