import { PasoBarra } from "@/components/auth/PasoBarra";
import { PasoVerificarTelefono } from "@/components/auth/PasoVerificarTelefono";
import { PantallaConTeclado } from "@/components/ui/PantallaConTeclado";
import { supabase } from "@/lib/supabase";
import { normalizarTelefono } from "@/lib/utils/telefono";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Ruta independiente: solo se usa cuando el AuthGate retoma una verificación
// pendiente (ej. la app se cerró a medio registro). El wizard normal
// (app/(auth)/register.tsx) resuelve este mismo paso internamente.
export default function VerificarTelefonoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ telefono?: string }>();
  const [telefono, setTelefono] = useState(params.telefono ?? "");

  useEffect(() => {
    if (telefono) return;
    const obtenerTelefono = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const tel = session?.user?.user_metadata?.telefono ?? session?.user?.phone;
      setTelefono(tel ?? "");
    };
    obtenerTelefono();
  }, [telefono]);

  return (
    <PantallaConTeclado style={styles.container} contentContainerStyle={styles.scroll}>
      <View style={{ paddingTop: insets.top + 24, paddingHorizontal: 32 }}>
        <PasoBarra paso={3} total={3} />
      </View>
      <View style={styles.content}>
        <PasoVerificarTelefono
          telefono={telefono}
          onVerificado={async () => {
            const telefonoNormalizado = normalizarTelefono(telefono);
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (user && telefonoNormalizado) {
              await supabase
                .from("usuarios")
                .update({ telefono: telefonoNormalizado })
                .eq("id", user.id);
            }
            router.replace("/(tabs)");
          }}
        />
      </View>
    </PantallaConTeclado>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  scroll: { flexGrow: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
});
