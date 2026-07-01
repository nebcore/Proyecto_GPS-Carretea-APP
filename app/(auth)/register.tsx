import { PasoBarra } from "@/components/auth/PasoBarra";
import { PasoVerificarTelefono } from "@/components/auth/PasoVerificarTelefono";
import { PantallaConTeclado } from "@/components/ui/PantallaConTeclado";
import { verificarDuplicados } from "@/lib/api/auth";
import { supabase } from "@/lib/supabase";
import { esTelefonoValido, normalizarTelefono } from "@/lib/utils/telefono";
import { useSignupStore } from "@/store/signup";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setRegistroEnProceso } from "../_layout";

export default function RegisterScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const setDatos = useSignupStore((s) => s.setDatos);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const translateX = useRef(new Animated.Value(0)).current;

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [numero, setNumero] = useState("");
  const [telefono, setTelefono] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: -(paso - 1) * width,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [paso, width]);

  useEffect(() => {
    return () => setRegistroEnProceso(false);
  }, []);

  // Arrastrar hacia la derecha retrocede un paso (no memoizado: los
  // handlers necesitan leer siempre el `paso`/`width` del render actual).
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) =>
      !loading &&
      paso > 1 &&
      gesture.dx > 10 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => {
      if (paso === 1 || gesture.dx <= 0) return;
      const offset = -(paso - 1) * width;
      translateX.setValue(offset + Math.min(gesture.dx, width));
    },
    onPanResponderRelease: (_, gesture) => {
      if (paso > 1 && gesture.dx > width * 0.25) {
        setPaso((paso - 1) as 1 | 2 | 3);
      } else {
        Animated.timing(translateX, {
          toValue: -(paso - 1) * width,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.timing(translateX, {
        toValue: -(paso - 1) * width,
        duration: 200,
        useNativeDriver: true,
      }).start();
    },
  });

  const irAPaso2 = async () => {
    if (!nombre || !email || !password) {
      Alert.alert("Error", "Completa todos los campos");
      return;
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!emailOk) {
      Alert.alert("Error", "Ingresa un email válido");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "La contraseña debe tener al menos 6 caracteres");
      return;
    }
    try {
      setLoading(true);
      const emailNormalizado = email.trim().toLowerCase();

      // Si ya creamos la cuenta en una pasada anterior por este mismo
      // paso (ej. el usuario retrocedió y volvió a avanzar sin cambiar
      // el email), no hay que llamar signUp() de nuevo: ya existe.
      const { data: { session: sesionActual } } = await supabase.auth.getSession();
      if (sesionActual?.user?.email === emailNormalizado) {
        setDatos({ nombre: nombre.trim(), email: emailNormalizado, password });
        setPaso(2);
        return;
      }

      const dup = await verificarDuplicados(emailNormalizado, '');
      if (dup.email_existe) {
        Alert.alert("Error", "Este correo ya está registrado.");
        return;
      }

      // Bloqueamos el AuthGate ANTES de crear la cuenta: si el email
      // queda confirmado automáticamente, signUp() deja sesión activa
      // al toque y el AuthGate saltaría a verificarTelefono creyendo
      // que se retoma un registro abandonado.
      setRegistroEnProceso(true);

      const { error } = await supabase.auth.signUp({
        email: emailNormalizado,
        password,
        options: { data: { nombre: nombre.trim() } },
      });
      if (error) throw error;

      setDatos({ nombre: nombre.trim(), email: emailNormalizado, password });
      setPaso(2);
    } catch (error: any) {
      setRegistroEnProceso(false);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const enviarCodigo = async () => {
    const telefonoNormalizado = normalizarTelefono(numero);
    if (!esTelefonoValido(telefonoNormalizado)) {
      Alert.alert("Error", "Ingresa un teléfono válido, ej: 912345678");
      return;
    }
    try {
      setLoading(true);
      const dup = await verificarDuplicados('', telefonoNormalizado);
      if (dup.telefono_existe) {
        Alert.alert("Error", "Este teléfono ya está registrado.");
        return;
      }

      setRegistroEnProceso(true);

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Email not confirmed')) {
          Alert.alert(
            'Email no confirmado',
            'Debes confirmar tu email antes de continuar. Revisa tu bandeja de entrada.',
          );
          setRegistroEnProceso(false);
          return;
        }
        throw signInError;
      }

      const { error: otpError } = await supabase.auth.updateUser({
        phone: telefonoNormalizado,
      });
      if (otpError) throw otpError;

      setTelefono(telefonoNormalizado);
      setPaso(3);
    } catch (error: any) {
      setRegistroEnProceso(false);
      Alert.alert("Error", error.message);
    } finally {
      setLoading(false);
    }
  };

  const onVerificado = () => {
    setRegistroEnProceso(false);
    Alert.alert("¡Listo!", "Tu cuenta fue creada con éxito.", [
      {
        text: "OK",
        onPress: async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase
              .from('usuarios')
              .update({ telefono: telefono })
              .eq('id', user.id);
          }
          Alert.alert(
            "Verifica tu email",
            "Puedes confirmar tu email más tarde desde Configuración.",
            [{ text: "Entendido", onPress: () => router.replace("/(tabs)") }],
          );
        },
      },
    ]);
  };

  return (
    <PantallaConTeclado style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={{ paddingTop: insets.top + 24, paddingHorizontal: 32 }}>
        <PasoBarra paso={paso} total={3} />
      </View>

      <View style={styles.viewport} {...panResponder.panHandlers}>
        <Animated.View
          style={[
            styles.carrusel,
            { width: width * 3, transform: [{ translateX }] },
          ]}
        >
          {/* PASO 1 — Datos */}
          <View style={[styles.paso, { width }]}>
            <Text style={styles.title}>Crea tu cuenta</Text>
            <Text style={styles.subtitle}>Paso 1 de 3 · Tus datos</Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre"
              placeholderTextColor="#888"
              value={nombre}
              onChangeText={setNombre}
            />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#888"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Contraseña"
              placeholderTextColor="#888"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <TouchableOpacity
              style={styles.button}
              onPress={irAPaso2}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.buttonText}>Continuar</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
            </TouchableOpacity>
          </View>

          {/* PASO 2 — Teléfono */}
          <View style={[styles.paso, { width }]}>
            <Text style={styles.title}>Tu teléfono</Text>
            <Text style={styles.subtitle}>
              Paso 2 de 3 · Te enviaremos un código por SMS
            </Text>

            <View style={styles.row}>
              <View style={styles.prefijo}>
                <Text style={styles.prefijoText}>+56</Text>
              </View>
              <TextInput
                style={[styles.input, styles.inputNumero]}
                placeholder="9 1234 5678"
                placeholderTextColor="#888"
                value={numero}
                onChangeText={setNumero}
                keyboardType="phone-pad"
              />
            </View>
            <Text style={styles.hint}>Formato internacional (E.164)</Text>

            <TouchableOpacity
              style={styles.button}
              onPress={enviarCodigo}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={styles.buttonText}>Enviar código</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setPaso(1)}>
              <Text style={styles.link}>Volver</Text>
            </TouchableOpacity>
          </View>

          {/* PASO 3 — Verificar SMS */}
          <View style={[styles.paso, { width }]}>
            <PasoVerificarTelefono telefono={telefono} onVerificado={onVerificado} />
          </View>
        </Animated.View>
      </View>
    </PantallaConTeclado>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  scroll: {
    flexGrow: 1,
  },
  viewport: {
    flex: 1,
    overflow: "hidden",
  },
  carrusel: {
    flex: 1,
    flexDirection: "row",
  },
  paso: {
    justifyContent: "center",
    paddingHorizontal: 32,
  },
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
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  prefijo: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  prefijoText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  inputNumero: { flex: 1, marginBottom: 0 },
  hint: { color: "#666", fontSize: 12, marginBottom: 24 },
  button: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  buttonText: {
    color: "#000",
    fontSize: 16,
    fontWeight: "bold",
  },
  link: {
    color: "#888",
    textAlign: "center",
    fontSize: 14,
  },
});
