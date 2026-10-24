// Petits composants partagés par les écrans.
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { toneColors, useColors } from './theme.js';

export const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** Ouvre une page du catalogue dans Safari, où le lecteur est peut-être déjà connecté à son compte. */
export function openUrl(url) {
  if (/^https?:\/\//i.test(String(url || ''))) Linking.openURL(url);
}

/** Rond coloré du résumé : livre, sablier (recherche en cours). */
export function ToneDot({ tone, busy, size = 34 }) {
  const c = useColors();
  const { fg, bg } = toneColors(c, tone);
  return (
    <View style={[styles.dot, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      {busy ? <ActivityIndicator size="small" color={fg} /> : <Text style={[styles.dotGlyph, { color: fg }]}>{tone === 'ok' ? '✓' : tone === 'wait' ? '…' : tone === 'err' ? '!' : '·'}</Text>}
    </View>
  );
}

export function Chip({ tone, children }) {
  const c = useColors();
  const { fg, bg } = toneColors(c, tone);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{children}</Text>
    </View>
  );
}

export function Button({ title, onPress, kind = 'primary', style }) {
  const c = useColors();
  const primary = kind === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: c.accent } : { borderWidth: 1, borderColor: c.line, backgroundColor: c.surface },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, { color: primary ? c.accentFg : c.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function LinkText({ children, onPress, style }) {
  const c = useColors();
  return (
    <Text accessibilityRole="link" onPress={onPress} style={[{ color: c.accent, textDecorationLine: 'underline' }, style]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }) {
  const c = useColors();
  return <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  dot: { alignItems: 'center', justifyContent: 'center' },
  dotGlyph: { fontSize: 17, fontWeight: '700' },
  chip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, alignSelf: 'flex-start' },
  chipText: { fontSize: 12, fontWeight: '600' },
  button: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontSize: 15, fontWeight: '600' },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16 },
});
