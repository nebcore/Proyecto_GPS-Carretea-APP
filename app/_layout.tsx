import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { Alert, ImageBackground, View } from "react-native";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

// --- MANEJADOR DE RUTAS (AUTH GATE) ---
function AuthGate() {
  const { session, loading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, loading, segments, router]);

  return null;
}

export const unstable_settings = {
  anchor: "(tabs)",
};

// --- COMPONENTE PRINCIPAL (ROOT LAYOUT) ---
export default function RootLayout() {
  const initialize = useAuthStore((s) => s.initialize);
  const session = useAuthStore((s) => s.session);
  const miUsuarioId = session?.user?.id;

  useEscucharBroadcast(miUsuarioId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return (
    <QueryClientProvider client={queryClient}>
      <ImageBackground
        source={require("../assets/images/lycoris-fondo.jpeg")}
        style={{ flex: 1 }}
        resizeMode="cover"
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0, 0, 0, 0.35)" }}>
          <ThemeProvider value={AppTheme}>
            <StatusBar
              style="light"
              backgroundColor="#000000"
              translucent={false}
            />
            <AuthGate />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              <Stack.Screen
                name="modal"
                options={{ presentation: "modal", title: "Modal" }}
              />
            </Stack>
          </ThemeProvider>
        </View>
      </ImageBackground>
    </QueryClientProvider>
  );
}

// --- HOOK DE ESCUCHA (BROADCAST) ---
export function useEscucharBroadcast(miUsuarioId: string | undefined) {
  useEffect(() => {
    if (!miUsuarioId) return;

    // 1. Nos conectamos a una "radio" global para toda la app
    const canalGlobal = supabase.channel("radio_invitaciones");

    canalGlobal
      .on("broadcast", { event: "nueva_invitacion" }, (payload) => {
        // 2. Revisamos si el mensaje es para nosotros
        if (payload.payload.destinatario_id === miUsuarioId) {
          Alert.alert(payload.payload.titulo, payload.payload.mensaje);
        }
      })
      .subscribe();

    // 3. Apagamos la radio si el usuario cierra sesión o sale
    return () => {
      supabase.removeChannel(canalGlobal);
    };
  }, [miUsuarioId]);
}