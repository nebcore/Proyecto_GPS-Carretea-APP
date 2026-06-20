import { supabase } from "@/lib/supabase";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function VerificarTelefonoScreen() {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [telefono, setTelefono] = useState("");

  useEffect(() => {
    const obtenerTelefono = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const tel = session?.user?.user_metadata?.telefono;
      setTelefono(tel ?? '');
    };
    obtenerTelefono();
  }, []);

  const handleVerificar = async () => {
    if (!codigo || codigo.length < 6) {
      Alert.alert("Error", "Ingresa el código de 6 dígitos.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.verifyOtp({
        phone: telefono,
        token: codigo,
        type: 'phone_change',
      });
      if (error) throw error;
      Alert.alert("¡Listo!", "Teléfono verificado correctamente.", [
        { text: "OK", onPress: () => router.replace("/(tabs)") },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: telefono });
      if (error) throw error;
      Alert.alert("Código reenviado", "Revisa tus mensajes.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verificar teléfono</Text>
      <Text style={styles.subtitle}>
        Ingresa el código que enviamos a {telefono}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Código de 6 dígitos"
        placeholderTextColor="#888"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        maxLength={6}
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleVerificar}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#000" />
          : <Text style={styles.buttonText}>Verificar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity onPress={reenviarCodigo}>
        <Text style={styles.link}>¿No recibiste el código? Reenviar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: "#888",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 40,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    padding: 16,
    color: "#fff",
    fontSize: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    textAlign: "center",
    letterSpacing: 8,
  },
  button: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: { color: "#000", fontSize: 16, fontWeight: "bold" },
  link: { color: "#888", textAlign: "center", fontSize: 14 },
});