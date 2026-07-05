import { Alert } from "@/components/ui/AppAlert";
import GlassCard from "@/components/ui/GlassCard";
import {
  enviarCodigoVerificacionEmail,
  getDatosBancarios,
  getEstadoEmail,
  getUsuarioPerfil,
  signOut,
  updateUsuarioPerfil,
  upsertDatosBancarios,
  verificarCodigoEmail,
} from "@/lib/api/auth";
import { guardarGoogleToken, obtenerGoogleToken } from "@/lib/api/usuarios";
import { supabase } from "@/lib/supabase";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
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

WebBrowser.maybeCompleteAuthSession();
export default function PerfilScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();

  const [editando, setEditando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");

  const [panelEmailVisible, setPanelEmailVisible] = useState(false);
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoEmail, setCodigoEmail] = useState("");
  const translateXEmail = useRef(new Animated.Value(width)).current;

  // Estados para el panel de notificaciones
  const [panelNotifVisible, setPanelNotifVisible] = useState(false);
  const translateXNotif = useRef(new Animated.Value(width)).current;

  // Preferencias (En un futuro las puedes guardar en Supabase o AsyncStorage)
  const [prefNotif, setPrefNotif] = useState({
    nuevosGastos: true,
    pagosReportados: true,
    recordatorios: true,
  });

  // Crear la mutación para guardar silenciosamente en la base de datos
  const actualizarPreferenciasMutation = useMutation({
    mutationFn: (nuevasPrefs: any) =>
      updateUsuarioPerfil({ preferencias_notificaciones: nuevasPrefs }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["perfil"] });
    },
    onError: (err) => {
      Alert.alert(
        "Error",
        "No pudimos guardar tus cambios. Revisa tu conexión.",
      );
    },
  });

  // Función auxiliar para manejar el cambio en los switches
  const togglePreferencia = (llave: keyof typeof prefNotif, valor: boolean) => {
    const nuevasPrefs = { ...prefNotif, [llave]: valor };
    setPrefNotif(nuevasPrefs); // Actualiza la UI instantáneamente
    actualizarPreferenciasMutation.mutate(nuevasPrefs); // Guarda en la nube
  };

  const abrirPanelNotif = () => {
    setPanelNotifVisible(true);
    Animated.timing(translateXNotif, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  };

  const cerrarPanelNotif = () => {
    Animated.timing(translateXNotif, {
      toValue: width,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setPanelNotifVisible(false));
  };

  const [editandoBanco, setEditandoBanco] = useState(false);
  const [banco, setBanco] = useState("");
  const [tipoCuenta, setTipoCuenta] = useState("");
  const [numeroCuenta, setNumeroCuenta] = useState("");
  const [rut, setRut] = useState("");

  const { data: perfil, isLoading } = useQuery({
    queryKey: ["perfil"],
    queryFn: getUsuarioPerfil,
  });

  // Sincronizar estado local cuando llegan los datos del perfil
  useEffect(() => {
    if (perfil?.preferencias_notificaciones) {
      setPrefNotif(perfil.preferencias_notificaciones);
    }
  }, [perfil]);

  const { data: datosBancarios } = useQuery({
    queryKey: ["datos-bancarios"],
    queryFn: getDatosBancarios,
  });

  const { data: estadoEmail } = useQuery({
    queryKey: ["estado-email"],
    queryFn: getEstadoEmail,
  });

  const { data: googleCalendarVinculado } = useQuery({
    queryKey: ["google-calendar-vinculado"],
    queryFn: async () => {
      try {
        const token = await obtenerGoogleToken();
        return Boolean(token);
      } catch {
        return false;
      }
    },
  });

  useEffect(() => {
    if (!panelEmailVisible) return;
    translateXEmail.setValue(width);
    Animated.timing(translateXEmail, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [panelEmailVisible]);

  const abrirPanelEmail = () => {
    if (estadoEmail?.verificado) return;
    setCodigoEnviado(false);
    setCodigoEmail("");
    setPanelEmailVisible(true);
  };

  const cerrarPanelEmail = () => {
    Animated.timing(translateXEmail, {
      toValue: width,
      duration: 220,
      useNativeDriver: true,
    }).start(() => setPanelEmailVisible(false));
  };

  const enviarCodigoEmailMutation = useMutation({
    mutationFn: () => enviarCodigoVerificacionEmail(estadoEmail!.email!),
    onSuccess: () => setCodigoEnviado(true),
    onError: (error: any) =>
      Alert.alert("Error", error?.message ?? "No se pudo enviar el código."),
  });

  const verificarCodigoEmailMutation = useMutation({
    mutationFn: () => verificarCodigoEmail(estadoEmail!.email!, codigoEmail),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estado-email"] });
      cerrarPanelEmail();
      Alert.alert("Listo", "Tu email quedó verificado.");
    },
    onError: (error: any) =>
      Alert.alert("Error", error?.message ?? "Código incorrecto."),
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
    onError: () =>
      Alert.alert("Error", "No se pudieron guardar los datos bancarios."),
  });

  const iniciarEdicionBanco = () => {
    setBanco(datosBancarios?.banco ?? "");
    setTipoCuenta(datosBancarios?.tipo_cuenta ?? "");
    setNumeroCuenta(datosBancarios?.numero_cuenta ?? "");
    setRut(datosBancarios?.rut ?? "");
    setEditandoBanco(true);
  };

  const handleGuardarBanco = () => {
    if (
      !banco.trim() ||
      !tipoCuenta.trim() ||
      !numeroCuenta.trim() ||
      !rut.trim()
    ) {
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

  const handleConectarGoogle = async () => {
    try {
      const redirectUrl = "proyectogpscarreteaapp://";

      const { data, error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          scopes: "https://www.googleapis.com/auth/calendar",
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: "offline", // para recibir refresh_token de Google
            prompt: "consent", // fuerza que Google lo entregue siempre
          },
        },
      });

      if (error) throw error;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
      );

      if (result.type === "success" && result.url) {
        const params = new URLSearchParams(result.url.split("#")[1]);
        const providerToken = params.get("provider_token");
        const providerRefreshToken = params.get("provider_refresh_token");

        if (providerToken) {
          await guardarGoogleToken(providerToken, providerRefreshToken);
          queryClient.invalidateQueries({
            queryKey: ["google-calendar-vinculado"],
          });
          Alert.alert("¡Listo!", "Google Calendar conectado correctamente.");
        } else {
          Alert.alert(
            "Error",
            "No se recibió el token de Google. Intenta nuevamente.",
          );
        }
      } else if (result.type === "cancel" || result.type === "dismiss") {
        // Usuario canceló el flujo, no hacer nada
      }
    } catch (error: any) {
      console.log("Error:", error);
      Alert.alert("Error", error.message);
    }
  };
  return (
    <View style={styles.root}>
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
                    {
                      label: "Banco",
                      value: banco,
                      setter: setBanco,
                      placeholder: "Ej: Banco Estado",
                      icon: "credit-card" as const,
                    },
                    {
                      label: "Tipo de cuenta",
                      value: tipoCuenta,
                      setter: setTipoCuenta,
                      placeholder: "Ej: Cuenta Vista",
                      icon: "list" as const,
                    },
                    {
                      label: "Número de cuenta",
                      value: numeroCuenta,
                      setter: setNumeroCuenta,
                      placeholder: "Ej: 12345678",
                      icon: "hash" as const,
                      keyboard: "numeric" as const,
                    },
                    {
                      label: "RUT",
                      value: rut,
                      setter: setRut,
                      placeholder: "Ej: 12.345.678-9",
                      icon: "user" as const,
                    },
                  ].map((campo, i, arr) => (
                    <View key={campo.label}>
                      <View style={styles.campo}>
                        <View style={styles.campoIcon}>
                          <Feather
                            name={campo.icon}
                            size={16}
                            color="#AAAAAA"
                          />
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
                    {
                      label: "Banco",
                      valor: datosBancarios.banco,
                      icon: "credit-card" as const,
                    },
                    {
                      label: "Tipo de cuenta",
                      valor: datosBancarios.tipo_cuenta,
                      icon: "list" as const,
                    },
                    {
                      label: "Número de cuenta",
                      valor: datosBancarios.numero_cuenta,
                      icon: "hash" as const,
                    },
                    {
                      label: "RUT",
                      valor: datosBancarios.rut,
                      icon: "user" as const,
                    },
                  ].map((campo, i, arr) => (
                    <View key={campo.label}>
                      <View style={styles.campo}>
                        <View style={styles.campoIcon}>
                          <Feather
                            name={campo.icon}
                            size={16}
                            color="#AAAAAA"
                          />
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
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={abrirPanelEmail}
                  disabled={estadoEmail?.verificado}
                >
                  <View style={styles.settingLeft}>
                    <Feather name="mail" size={18} color="#AAAAAA" />
                    <Text style={styles.settingLabel}>Email</Text>
                  </View>
                  {estadoEmail?.verificado ? (
                    <View style={styles.badgeVerificado}>
                      <Feather name="check" size={12} color="#50C878" />
                      <Text style={styles.badgeVerificadoText}>Verificado</Text>
                    </View>
                  ) : (
                    <Text style={styles.settingAction}>Verificar</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.divisor} />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={handleConectarGoogle}
                >
                  <View style={styles.settingLeft}>
                    <Feather name="calendar" size={18} color="#4285F4" />
                    <Text style={styles.settingLabel}>Google Calendar</Text>
                  </View>
                  {googleCalendarVinculado ? (
                    <View style={styles.badgeVerificado}>
                      <Feather name="check" size={12} color="#50C878" />
                      <Text style={styles.badgeVerificadoText}>Vinculado</Text>
                    </View>
                  ) : (
                    <Text style={styles.settingAction}>Conectar</Text>
                  )}
                </TouchableOpacity>
                <View style={styles.divisor} />
                <TouchableOpacity
                  style={styles.settingRow}
                  onPress={abrirPanelNotif}
                >
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

      <Modal
        visible={panelEmailVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarPanelEmail}
      >
        <View style={styles.overlayEmail}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={cerrarPanelEmail}
          />
          <Animated.View
            style={[
              styles.panelEmail,
              { transform: [{ translateX: translateXEmail }] },
            ]}
          >
            <View style={styles.panelEmailHeader}>
              <Text style={styles.cardTitle}>Verificar email</Text>
              <TouchableOpacity onPress={cerrarPanelEmail}>
                <Feather name="x" size={22} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            {!codigoEnviado ? (
              <>
                <Text style={styles.panelEmailTexto}>
                  Te enviaremos un código a{"\n"}
                  <Text style={{ color: "#fff" }}>{estadoEmail?.email}</Text>
                </Text>
                <TouchableOpacity
                  style={[
                    styles.btnGuardar,
                    styles.btnPanelEmail,
                    enviarCodigoEmailMutation.isPending && { opacity: 0.5 },
                  ]}
                  onPress={() => enviarCodigoEmailMutation.mutate()}
                  disabled={enviarCodigoEmailMutation.isPending}
                >
                  {enviarCodigoEmailMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.btnGuardarText}>Enviar código</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.panelEmailTexto}>
                  Ingresa el código que enviamos a{"\n"}
                  <Text style={{ color: "#fff" }}>{estadoEmail?.email}</Text>
                </Text>
                <TextInput
                  style={styles.codigoInput}
                  placeholder="········"
                  placeholderTextColor="#555"
                  value={codigoEmail}
                  onChangeText={setCodigoEmail}
                  keyboardType="number-pad"
                  maxLength={8}
                  autoFocus
                />
                <TouchableOpacity
                  style={[
                    styles.btnGuardar,
                    styles.btnPanelEmail,
                    verificarCodigoEmailMutation.isPending && { opacity: 0.5 },
                  ]}
                  onPress={() => verificarCodigoEmailMutation.mutate()}
                  disabled={verificarCodigoEmailMutation.isPending}
                >
                  {verificarCodigoEmailMutation.isPending ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={styles.btnGuardarText}>Verificar</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => enviarCodigoEmailMutation.mutate()}
                  disabled={enviarCodigoEmailMutation.isPending}
                >
                  <Text style={styles.link}>Reenviar código</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </View>
      </Modal>
      {/* MODAL PREFERENCIAS DE NOTIFICACIONES */}
      <Modal
        visible={panelNotifVisible}
        transparent
        animationType="fade"
        onRequestClose={cerrarPanelNotif}
      >
        <View style={styles.overlayEmail}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={cerrarPanelNotif}
          />
          <Animated.View
            style={[
              styles.panelEmail,
              { transform: [{ translateX: translateXNotif }] },
            ]}
          >
            <View style={styles.panelEmailHeader}>
              <Text style={styles.cardTitle}>Notificaciones</Text>
              <TouchableOpacity onPress={cerrarPanelNotif}>
                <Feather name="x" size={22} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            <Text style={styles.panelEmailTexto}>
              Elige qué alertas quieres recibir en tu teléfono.
            </Text>

            {/* SWITCH 1 */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Nuevos Gastos</Text>
                <Text style={styles.switchSub}>
                  Cuando alguien anota una cuenta nueva.
                </Text>
              </View>
              <Switch
                value={prefNotif.nuevosGastos}
                onValueChange={(val) => togglePreferencia("nuevosGastos", val)}
                trackColor={{ false: "#333", true: "#4CAF50" }}
                thumbColor={prefNotif.nuevosGastos ? "#fff" : "#888"}
              />
            </View>

            {/* SWITCH 2 */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Pagos y Confirmaciones</Text>
                <Text style={styles.switchSub}>
                  Cuando te transfieren o confirman un pago.
                </Text>
              </View>
              <Switch
                value={prefNotif.pagosReportados}
                onValueChange={(val) =>
                  togglePreferencia("pagosReportados", val)
                }
                trackColor={{ false: "#333", true: "#4CAF50" }}
                thumbColor={prefNotif.pagosReportados ? "#fff" : "#888"}
              />
            </View>

            {/* SWITCH 3 */}
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Text style={styles.switchTitle}>Recordatorios de Deuda</Text>
                <Text style={styles.switchSub}>
                  Avisos automáticos si te olvidas de pagar.
                </Text>
              </View>
              <Switch
                value={prefNotif.recordatorios}
                onValueChange={(val) => togglePreferencia("recordatorios", val)}
                trackColor={{ false: "#333", true: "#4CAF50" }}
                thumbColor={prefNotif.recordatorios ? "#fff" : "#888"}
              />
            </View>
          </Animated.View>
        </View>
      </Modal>
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
  settingAction: { color: "#AAAAAA", fontSize: 13, fontWeight: "600" },
  badgeVerificado: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(80,200,120,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeVerificadoText: { color: "#50C878", fontSize: 12, fontWeight: "600" },

  sinDatos: {
    color: "#555555",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    paddingVertical: 8,
  },

  overlayEmail: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  panelEmail: {
    width: "70%",
    maxWidth: 300,
    backgroundColor: "#0A0A0A",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginRight: 12,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  btnPanelEmail: { flex: 0 },
  panelEmailHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  panelEmailTexto: {
    color: "#888",
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 24,
  },
  codigoInput: {
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
  link: {
    color: "#888",
    textAlign: "center",
    fontSize: 14,
    marginTop: 8,
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
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  switchInfo: {
    flex: 1,
    paddingRight: 16,
  },
  switchTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  switchSub: {
    color: "#888888",
    fontSize: 12,
    lineHeight: 16,
  },
});
