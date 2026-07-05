import { Alert, AppAlertProvider } from "@/components/ui/AppAlert";
import { registrarParaNotificacionesPush } from "@/lib/api/pushNotifications";
import { useNotificationRouter } from "@/lib/hooks/useNotificationRouter";
import { useAppRealtime } from "@/lib/realtime/useAppRealtime";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/auth";
import { DarkTheme, ThemeProvider } from "@react-navigation/native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { ImageBackground, View } from "react-native";
import "react-native-reanimated";

const queryClient = new QueryClient();
let registroEnProceso = false;

export const setRegistroEnProceso = (valor: boolean) => {
  registroEnProceso = valor;
};
const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: "transparent",
    card: "transparent",
  },
};

function AppRealtimeBridge({ usuarioId }: { usuarioId: string | undefined }) {
  useAppRealtime(usuarioId);
  return null;
}

// --- MANEJADOR DE RUTAS (AUTH GATE) ---
function AuthGate() {
  const { session, loading } = useAuthStore();
  const segments = useSegments() as string[];
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inVerificarTelefono = segments[1] === "verificarTelefono";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup && !inVerificarTelefono) {
      if (registroEnProceso) return;
      const telefonoVerificado = session.user?.phone_confirmed_at;
      if (!telefonoVerificado) {
        const telefono =
          session.user?.user_metadata?.telefono ?? session.user?.phone;
        router.replace({
          pathname: "/(auth)/verificarTelefono",
          params: { telefono },
        });
      } else {
        router.replace("/(tabs)");
      }
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
  const loading = useAuthStore((s) => s.loading);
  const miUsuarioId = session?.user?.id;

  // Enganchamos la escucha de clics en notificaciones push pasando el estado de la sesión
  useNotificationRouter(!!session, loading);

  useEscucharBroadcast(miUsuarioId);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // EFECTO DE REGISTRO PUSH
  useEffect(() => {
    if (miUsuarioId) {
      registrarParaNotificacionesPush(miUsuarioId);
    }
  }, [miUsuarioId]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppRealtimeBridge usuarioId={miUsuarioId} />
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
            <AppAlertProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "transparent" },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ headerShown: false }} />
              </Stack>
            </AppAlertProvider>
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

    // Nos conectamos a una "radio" global para toda la app
    const canalGlobal = supabase.channel("radio_invitaciones");

    canalGlobal
      .on("broadcast", { event: "nueva_invitacion" }, (payload) => {
        // Revisamos si el mensaje es para nosotros
        if (payload.payload.destinatario_id === miUsuarioId) {
          Alert.alert(payload.payload.titulo, payload.payload.mensaje);
        }
      })
      .subscribe();

    // Apagamos la radio si el usuario cierra sesión o sale
    return () => {
      supabase.removeChannel(canalGlobal);
    };
  }, [miUsuarioId]);
}
