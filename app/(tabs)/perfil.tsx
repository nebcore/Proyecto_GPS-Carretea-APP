import Header from "@/components/ui/Header";
import { signOut } from "@/lib/api/auth";
import { guardarGoogleToken } from "@/lib/api/usuarios";
import { supabase } from "@/lib/supabase";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import * as WebBrowser from 'expo-web-browser';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

WebBrowser.maybeCompleteAuthSession();
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();

  const handleCerrarSesion = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  const handleConectarGoogle = async () => {
  try {
    const redirectUrl = 'carretea://';

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar',
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

    if (result.type === 'success' && result.url) {
      const params = new URLSearchParams(result.url.split('#')[1]);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const providerToken = params.get('provider_token');

      if (providerToken) {
  await guardarGoogleToken(providerToken);
  Alert.alert('¡Listo!', 'Google Calendar conectado correctamente.');
}
  } 
  } catch (error: any) {
    console.log('Error:', error);
    Alert.alert('Error', error.message);
  }
};



  return (
    <View style={styles.root}>
      <Header />
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <Text style={styles.texto}>Próximamente</Text>
        <TouchableOpacity style={styles.botonGoogle} onPress={handleConectarGoogle}>
          <Feather name="calendar" size={18} color="#4285F4" />
          <Text style={styles.botonGoogleText}>Conectar Google Calendar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.boton} onPress={handleCerrarSesion}>
          <Feather name="log-out" size={18} color="#FF5252" />
          <Text style={styles.botonText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 32,
  },
  texto: { color: "rgba(255,255,255,0.4)", fontSize: 16 },
  boton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,82,82,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  botonText: { color: "#FF5252", fontWeight: "bold", fontSize: 15 },
  botonGoogle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(66,133,244,0.1)",
    borderWidth: 1,
    borderColor: "rgba(66,133,244,0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  botonGoogleText: { color: "#4285F4", fontWeight: "bold", fontSize: 15 },
});
