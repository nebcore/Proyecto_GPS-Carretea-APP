import GlassCard from "@/components/ui/GlassCard";
import Header from "@/components/ui/Header";
import {
  getDatosBancarios,
  getUsuarioPerfil,
  signOut,
  updateUsuarioPerfil,
  upsertDatosBancarios,
} from "@/lib/api/auth";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatearTelefono = (text: string) => {
  let cleaned = text.replace(/[^\d+]/g, "");
  if (cleaned === "" || cleaned === "+") return cleaned;
  let digits = cleaned.replace(/^\+?56/, "").replace(/\D/g, "");
  if (cleaned.length <= 3 && !cleaned.includes("56") && cleaned.startsWith("+"))
    return cleaned;
  let result = "+56";
  if (digits.length > 0) result += " " + digits.substring(0, 1);
  if (digits.length > 1) result += " " + digits.substring(1, 5);
  if (digits.length > 5) result += " " + digits.substring(5, 9);
  return result;
};

export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const [editandoBanco, setEditandoBanco] = useState(false);
  const [banco, setBanco] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [rut, setRut] = useState("");

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil"],
    queryFn: getUsuarioPerfil,
  });

  const { data: datosBancarios } = useQuery({
    queryKey: ["datos-bancarios"],
    queryFn: getDatosBancarios,
  });

  const actualizarMutation = useMutation({
    mutationFn: () => updateUsuarioPerfil({ nombre: nombre.trim(), telefono }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil"] });
      setEditando(false);
      Alert.alert("Guardado", "Tu perfil fue actualizado.");
    },
    onError: () => Alert.alert("Error", "No se pudo actualizar el perfil."),
  });

  const guardarBancoMutation = useMutation({
    mutationFn: () =>
      upsertDatosBancarios({
        banco: banco.trim(),
        tipo_cuenta: tipoCuenta.trim(),
        numero_cuenta: numeroCuenta.trim(),
        rut: rut.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datos-bancarios"] });
      setEditandoBanco(false);
      Alert.alert("Guardado", "Datos bancarios actualizados.");
    },
    onError: () => Alert.alert("Error", "No se pudieron guardar los datos bancarios."),
  });

  const iniciarEdicionBanco = () => {
    setBanco(datosBancarios?.banco ?? "");
    setTipoCuenta(datosBancarios?.tipo_cuenta ?? "");
    setNumeroCuenta(datosBancarios?.numero_cuenta ?? "");
    setRut(datosBancarios?.rut ?? "");
    setEditandoBanco(true);
  };

  const handleGuardarBanco = () => {
    if (!banco.trim() || !tipoCuenta.trim() || !numeroCuenta.trim() || !rut.trim()) {
      Alert.alert("Error", "Todos los campos bancarios son obligatorios.");
      return;
    }
    guardarBancoMutation.mutate();
  };

  const iniciarEdicion = () => {
    setNombre(perfil?.nombre ?? "");
    setTelefono(perfil?.telefono ?? "");
    setEditando(true);
  };

  const handleGuardar = () => {
    if (nombre.trim() === "") {
      Alert.alert("Error", "El nombre no puede estar vacío.");
      return;
    }
    actualizarMutation.mutate();
  };

  const handleCerrarSesion = () => {
    Alert.alert("Cerrar sesión", "¿Estás seguro?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  return (
    <View style={styles.root}>
      <Header />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* AVATAR */}
            <View style={styles.avatarContainer}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {perfil?.nombre?.substring(0, 1).toUpperCase() ?? "?"}
                </Text>
              </View>
              <Text style={styles.nombreDisplay}>{perfil?.nombre}</Text>
              <Text style={styles.emailDisplay}>{perfil?.email}</Text>
            </View>

            {/* DATOS */}
            <GlassCard style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Información personal</Text>
                {!editando && (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={iniciarEdicion}
                  >
                    <Feather name="edit-2" size={16} color="#AAAAAA" />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.campo}>
                <View style={styles.campoIcon}>
                  <Feather name="user" size={16} color="#AAAAAA" />
                </View>
                <View style={styles.campoBody}>
                  <Text style={styles.campoLabel}>Nombre</Text>
                  {editando ? (
                    <TextInput
                      style={styles.campoInput}
                      value={nombre}
                      onChangeText={setNombre}
                      placeholder="Tu nombre"
                      placeholderTextColor="#555"
                      autoFocus
                      maxLength={60}
                    />
                  ) : (
                    <Text style={styles.campoValor}>
                      {perfil?.nombre ?? "—"}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.divisor} />

              <View style={styles.campo}>
                <View style={styles.campoIcon}>
                  <Feather name="mail" size={16} color="#AAAAAA" />
                </View>
                <View style={styles.campoBody}>
                  <Text style={styles.campoLabel}>Email</Text>
                  <Text style={styles.campoValor}>{perfil?.email ?? "—"}</Text>
                </View>
              </View>

              <View style={styles.divisor} />

              <View style={styles.campo}>
                <View style={styles.campoIcon}>
                  <Feather name="phone" size={16} color="#AAAAAA" />
                </View>
                <View style={styles.campoBody}>
                  <Text style={styles.campoLabel}>Teléfono</Text>
                  {editando ? (
                    <TextInput
                      style={styles.campoInput}
                      value={telefono}
                      onChangeText={(t) => setTelefono(formatearTelefono(t))}
                      placeholder="+56 9 XXXX XXXX"
                      placeholderTextColor="#555"
                      keyboardType="phone-pad"
                      maxLength={15}
                    />
                  ) : (
                    <Text style={styles.campoValor}>
                      {perfil?.telefono ?? "Sin teléfono"}
                    </Text>
                  )}
                </View>
              </View>

              {editando && (
                <View style={styles.botonesEdicion}>
                  <TouchableOpacity
                    style={styles.btnCancelar}
                    onPress={() => setEditando(false)}
                  >
                    <Text style={styles.btnCancelarText}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.btnGuardar,
                      actualizarMutation.isPending && { opacity: 0.5 },
                    ]}
                    onPress={handleGuardar}
                    disabled={actualizarMutation.isPending}
                  >
                    {actualizarMutation.isPending ? (
                      <ActivityIndicator size="small" color="#000" />
                    ) : (
                      <Text style={styles.btnGuardarText}>Guardar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </GlassCard>

            {/* DATOS BANCARIOS */}
            <GlassCard style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Datos bancarios</Text>
                {!editandoBanco && (
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={iniciarEdicionBanco}
                  >
                    <Feather
                      name={datosBancarios ? "edit-2" : "plus"}
                      size={16}
                      color="#AAAAAA"
                    />
                  </TouchableOpacity>
                )}
              </View>

              {editandoBanco ? (
                <>
                  {[
                    { label: "Banco", value: banco, setter: setBanco, placeholder: "Ej: Banco Estado", icon: "credit-card" as const },
                    { label: "Tipo de cuenta", value: tipoCuenta, setter: setTipoCuenta, placeholder: "Ej: Cuenta Vista", icon: "list" as const },
                    { label: "Número de cuenta", value: numeroCuenta, setter: setNumeroCuenta, placeholder: "Ej: 12345678", icon: "hash" as const, keyboard: "numeric" as const },
                    { label: "RUT", value: rut, setter: setRut, placeholder: "Ej: 12.345.678-9", icon: "user" as const },
                  ].map((campo, i, arr) => (
                    <View key={campo.label}>
                      <View style={styles.campo}>
                        <View style={styles.campoIcon}>
                          <Feather name={campo.icon} size={16} color="#AAAAAA" />
                        </View>
                        <View style={styles.campoBody}>
                          <Text style={styles.campoLabel}>{campo.label}</Text>
                          <TextInput
                            style={styles.campoInput}
                            value={campo.value}
                            onChangeText={campo.setter}
                            placeholder={campo.placeholder}
                            placeholderTextColor="#555"
                            keyboardType={campo.keyboard ?? "default"}
                            autoFocus={i === 0}
                          />
                        </View>
                      </View>
                      {i < arr.length - 1 && <View style={styles.divisor} />}
                    </View>
                  ))}
                  <View style={styles.botonesEdicion}>
                    <TouchableOpacity
                      style={styles.btnCancelar}
                      onPress={() => setEditandoBanco(false)}
                    >
                      <Text style={styles.btnCancelarText}>Cancelar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.btnGuardar,
                        guardarBancoMutation.isPending && { opacity: 0.5 },
                      ]}
                      onPress={handleGuardarBanco}
                      disabled={guardarBancoMutation.isPending}
                    >
                      {guardarBancoMutation.isPending ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <Text style={styles.btnGuardarText}>Guardar</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : datosBancarios ? (
                <>
                  {[
                    { label: "Banco", valor: datosBancarios.banco, icon: "credit-card" as const },
                    { label: "Tipo de cuenta", valor: datosBancarios.tipo_cuenta, icon: "list" as const },
                    { label: "Número de cuenta", valor: datosBancarios.numero_cuenta, icon: "hash" as const },
                    { label: "RUT", valor: datosBancarios.rut, icon: "user" as const },
                  ].map((campo, i, arr) => (
                    <View key={campo.label}>
                      <View style={styles.campo}>
                        <View style={styles.campoIcon}>
                          <Feather name={campo.icon} size={16} color="#AAAAAA" />
                        </View>
                        <View style={styles.campoBody}>
                          <Text style={styles.campoLabel}>{campo.label}</Text>
                          <Text style={styles.campoValor}>{campo.valor}</Text>
                        </View>
                      </View>
                      {i < arr.length - 1 && <View style={styles.divisor} />}
                    </View>
                  ))}
                </>
              ) : (
                <Text style={styles.sinDatos}>
                  Sin datos bancarios. Toca + para agregar.
                </Text>
              )}
            </GlassCard>

            {/* CONFIGURACIÓN */}
            <GlassCard style={styles.card}>
              <Text style={styles.cardTitle}>Configuración</Text>
              <View style={{ marginTop: 16 }}>
                <TouchableOpacity style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Feather name="bell" size={18} color="#AAAAAA" />
                    <Text style={styles.settingLabel}>Notificaciones</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#444444" />
                </TouchableOpacity>
                <View style={styles.divisor} />
                <TouchableOpacity style={styles.settingRow}>
                  <View style={styles.settingLeft}>
                    <Feather name="info" size={18} color="#AAAAAA" />
                    <Text style={styles.settingLabel}>Acerca de</Text>
                  </View>
                  <Feather name="chevron-right" size={18} color="#444444" />
                </TouchableOpacity>
              </View>
            </GlassCard>

            {/* CERRAR SESIÓN */}
            <TouchableOpacity
              style={styles.btnLogout}
              onPress={handleCerrarSesion}
            >
              <Feather name="log-out" size={18} color="#FF5252" />
              <Text style={styles.btnLogoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 24, paddingTop: 16 },

  avatarContainer: { alignItems: "center", marginBottom: 24, marginTop: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#FFFFFF", fontSize: 32, fontWeight: "bold" },
  nombreDisplay: { color: "#FFFFFF", fontSize: 20, fontWeight: "bold" },
  emailDisplay: { color: "#AAAAAA", fontSize: 13, marginTop: 4 },

  card: { borderRadius: 20, padding: 20, marginBottom: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  cardTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  editBtn: {
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
  },

  campo: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  campoIcon: { marginTop: 2 },
  campoBody: { flex: 1 },
  campoLabel: {
    color: "#666666",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 3,
  },
  campoValor: { color: "#FFFFFF", fontSize: 15 },
  campoInput: {
    color: "#FFFFFF",
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.2)",
    paddingVertical: 4,
  },
  divisor: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginVertical: 16,
  },

  botonesEdicion: { flexDirection: "row", gap: 10, marginTop: 20 },
  btnCancelar: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnCancelarText: { color: "#AAAAAA", fontWeight: "600" },
  btnGuardar: {
    flex: 1,
    padding: 13,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  btnGuardarText: { color: "#000000", fontWeight: "700" },

  btnLogout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,82,82,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,82,82,0.3)",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginTop: 8,
  },
  btnLogoutText: { color: "#FF5252", fontWeight: "bold", fontSize: 15 },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingLabel: { color: "#FFFFFF", fontSize: 15 },

  sinDatos: {
    color: "#555555",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },
});
