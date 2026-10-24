import '../polyfills.js';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { loadState } from '../store.js';
import { palette } from '../theme.js';

export default function RootLayout() {
  const scheme = useColorScheme();
  const c = palette(scheme);
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;

  useEffect(() => {
    loadState();
  }, []);

  return (
    <ThemeProvider value={{ ...base, colors: { ...base.colors, primary: c.accent, background: c.bg, card: c.bg, text: c.fg, border: c.line } }}>
      <Stack
        screenOptions={{
          headerTintColor: c.accent,
          headerTitleStyle: { color: c.fg },
          headerStyle: { backgroundColor: c.bg },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Biblib' }} />
        <Stack.Screen name="livre/[id]" options={{ title: '' }} />
        <Stack.Screen name="reglages" options={{ title: 'Réglages' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
