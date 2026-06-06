import { signOut } from "@/lib/api/auth";
import Feather from "@expo/vector-icons/Feather";
import { router } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Header from "@/components/ui/Header";

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();

  const handleCerrarSesion = async () => {
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.root}>
      <Header />
      <View style={[styles.container, { paddingBottom: insets.bottom }]}>
        <Text style={styles.texto}>Próximamente</Text>

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
});
