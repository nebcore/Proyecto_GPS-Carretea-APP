import { Alert } from "@/components/ui/AppAlert";
import { supabase } from "@/lib/supabase";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

interface Props {
  telefono: string;
  onVerificado: () => void;
}

export function PasoVerificarTelefono({ telefono, onVerificado }: Props) {
  const [codigo, setCodigo] = useState("");
  const [loading, setLoading] = useState(false);
  const [segundos, setSegundos] = useState(60);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = setInterval(() => setSegundos((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [segundos]);

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
        type: "phone_change",
      });
      if (error) throw error;
      onVerificado();
    } catch (error: any) {
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const reenviarCodigo = async () => {
    try {
      const { error } = await supabase.auth.updateUser({ phone: telefono });
      if (error) throw error;
      setSegundos(60);
      Alert.alert("Código reenviado", "Revisa tus mensajes.");
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View>
      <Text style={styles.title}>Verifica tu número</Text>
      <Text style={styles.subtitle}>
        Ingresa el código que enviamos a {telefono}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="······"
        placeholderTextColor="#555"
        value={codigo}
        onChangeText={setCodigo}
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="sms-otp"
        textContentType="oneTimeCode"
      />

      <TouchableOpacity
        style={styles.button}
        onPress={handleVerificar}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#000" />
        ) : (
          <Text style={styles.buttonText}>Verificar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={reenviarCodigo} disabled={segundos > 0}>
        <Text style={[styles.link, segundos > 0 && styles.linkDisabled]}>
          {segundos > 0
            ? `Reenviar código en 0:${String(segundos).padStart(2, "0")}`
            : "¿No recibiste el código? Reenviar"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    color: "#888",
    fontSize: 14,
    marginBottom: 32,
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
  linkDisabled: { color: "#555" },
});
