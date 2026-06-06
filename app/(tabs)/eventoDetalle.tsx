import {
  confirmarPago,
  obtenerPagosEvento,
  reportarPago,
} from "@/lib/api/pagos";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import GlassCard from "@/components/ui/GlassCard";
import Header from "@/components/ui/Header";
import { getEvento } from "@/lib/api/eventos";
import {
  borrarGasto,
  getGastosConPagador,
  obtenerParticipantesEvento,
} from "@/lib/api/gastos";
import { useBalancesEvento } from "@/lib/realtime/useBalancesEvento";

const formatearFecha = (fechaString: string) => {
  if (!fechaString) return "";
  return new Date(fechaString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatearMonto = (monto: number) => `$${monto.toLocaleString("es-CL")}`;

type Tab = "gastos" | "balances" | "participantes";

export default function EventoDetalleScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const [tabActivo, setTabActivo] = useState<Tab>("gastos");
  const queryClient = useQueryClient();

  const { data: evento, isLoading: loadingEvento } = useQuery({
    queryKey: ["evento", eventoId],
    queryFn: () => getEvento(eventoId),
    enabled: Boolean(eventoId),
  });

  const { data: gastos = [], isLoading: loadingGastos } = useQuery({
    queryKey: ["gastos-detalle", eventoId],
    queryFn: () => getGastosConPagador(eventoId),
    enabled: Boolean(eventoId),
  });

  const { data: participantes = [], isLoading: loadingParticipantes } =
    useQuery({
      queryKey: ["participantes", eventoId],
      queryFn: () => obtenerParticipantesEvento(eventoId),
      enabled: Boolean(eventoId),
    });

  const { balances, deudas } = useBalancesEvento(eventoId);

  const obtenerNombreContacto = (contacto: any, fallback = "Participante") => {
    if (!contacto) return fallback;

    if (Array.isArray(contacto)) {
      return contacto[0]?.nombre ?? fallback;
    }

    return contacto.nombre ?? fallback;
  };

  const participantesPorId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const participante of participantes as any[]) {
      const nombre = obtenerNombreContacto(participante["contactos"]);
      mapa.set(participante["contacto_id"], nombre);
    }
    return mapa;
  }, [participantes]);

  const borrarGastoMutation = useMutation({
    mutationFn: borrarGasto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
    },
    onError: (error: any) => {
      Alert.alert("No se pudo borrar", error?.message ?? "Intenta nuevamente.");
    },
  });

  const reportarPagoMutation = useMutation({
    mutationFn: ({ eventoId, acreedorId, monto }: any) =>
      reportarPago(eventoId, acreedorId, monto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["balances", eventoId] });
      Alert.alert("Pago reportado", "El pago fue reportado correctamente.");
    },
    onError: (error: any) => {
      Alert.alert(
        "No se pudo reportar",
        error?.message ?? "Intenta nuevamente.",
      );
    },
  });

  const confirmarPagoMutation = useMutation({
    mutationFn: (pagoId: string) => confirmarPago(pagoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["balances", eventoId] });
      Alert.alert("Pago confirmado", "El pago ha sido confirmado.");
    },
    onError: (error: any) => {
      Alert.alert(
        "No se pudo confirmar",
        error?.message ?? "Intenta nuevamente.",
      );
    },
  });

  const confirmarBorradoGasto = (gastoId: string, descripcion: string) => {
    Alert.alert("Borrar gasto", `¿Quieres borrar "${descripcion}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => borrarGastoMutation.mutate(gastoId),
      },
    ]);
  };

  const montoTotal = gastos.reduce(
    (acc: number, g: any) => acc + (g.monto_total ?? 0),
    0,
  );

  if (loadingEvento) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header mostrarVolver onVolver={() => router.back()} />

      <View style={styles.container}>
        {/* TARJETA HEADER DEL EVENTO */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.eventoTitulo} numberOfLines={1}>
                {evento?.titulo}
              </Text>
              <TouchableOpacity>
                <Feather
                  name="edit-3"
                  size={16}
                  color="rgba(255,255,255,0.5)"
                />
              </TouchableOpacity>
            </View>
            {evento?.descripcion ? (
              <Text style={styles.eventoDesc} numberOfLines={2}>
                {evento.descripcion}
              </Text>
            ) : null}
            <View style={styles.infoPills}>
              <View style={styles.pill}>
                <Feather
                  name="calendar"
                  size={11}
                  color="rgba(255,255,255,0.5)"
                />
                <Text style={styles.pillText}>
                  {formatearFecha(evento?.fecha_evento)}
                </Text>
              </View>
              <View style={styles.pill}>
                <Feather name="users" size={11} color="rgba(255,255,255,0.5)" />
                <Text style={styles.pillText}>
                  {participantes.length} personas
                </Text>
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.totalMonto}>{formatearMonto(montoTotal)}</Text>
            <Text style={styles.totalLabel}>Total gastado</Text>
          </View>
        </GlassCard>

        {/* TABS */}
        <View style={styles.tabBar}>
          {(["gastos", "balances", "participantes"] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, tabActivo === tab && styles.tabActivo]}
              onPress={() => setTabActivo(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  tabActivo === tab && styles.tabTextActivo,
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* CONTENIDO */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.contenido}
          contentContainerStyle={styles.scrollPadding}
        >
          {/* TAB GASTOS */}
          {tabActivo === "gastos" && (
            <>
              {loadingGastos ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
              ) : gastos.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no hay gastos registrados.
                </Text>
              ) : (
                gastos.map((g: any) => {
                  const pagador =
                    g.gastos_pagadores?.[0]?.contactos?.nombre ?? "?";
                  return (
                    <TouchableOpacity key={g.id} style={styles.gastoCard}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {pagador.substring(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>{g.descripcion}</Text>
                        <Text style={styles.cardSub}>Pagado por {pagador}</Text>
                        <View style={styles.fechaRow}>
                          <Feather
                            name="calendar"
                            size={11}
                            color="rgba(255,255,255,0.3)"
                          />
                          <Text style={styles.cardFecha}>
                            {formatearFecha(g.fecha)}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.gastoMonto}>
                        {formatearMonto(g.monto_total)}
                      </Text>
                      <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() =>
                          confirmarBorradoGasto(g.id, g.descripcion)
                        }
                        disabled={borrarGastoMutation.isPending}
                      >
                        <Feather name="trash-2" size={17} color="#FF6B6B" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {/* TAB BALANCES */}
          {tabActivo === "balances" && (
            <>
              {deudas.length === 0 ? (
                <Text style={styles.emptyText}>No hay deudas pendientes.</Text>
              ) : (
                deudas.map((d: any, i: number) => (
                  <View key={i} style={styles.gastoCard}>
                    <View style={styles.cardInfo}>
                      <Text style={styles.cardTitulo}>
                        {participantesPorId.get(d.deudorId) ?? d.deudorId}{" "}
                        <Text style={styles.flecha}>→</Text>{" "}
                        {participantesPorId.get(d.acreedorId) ?? d.acreedorId}
                      </Text>
                    </View>
                    <Text style={[styles.gastoMonto, styles.deudaMonto]}>
                      {formatearMonto(d.monto)}
                    </Text>
                  </View>
                ))
              )}

              <TouchableOpacity
                style={[styles.botonSecundario, { marginTop: 12 }]}
                onPress={() => {
                  if (!deudas || deudas.length === 0) {
                    Alert.alert("Sin deudas", "No hay deudas para reportar.");
                    return;
                  }

                  const d = deudas[0];
                  const acreedorNombre =
                    participantesPorId.get(d.acreedorId) ?? d.acreedorId;
                  Alert.alert(
                    "Reportar pago",
                    `Reportar pago a ${acreedorNombre} por ${formatearMonto(d.monto)}?`,
                    [
                      { text: "Cancelar", style: "cancel" },
                      {
                        text: "Reportar",
                        onPress: () =>
                          reportarPagoMutation.mutate({
                            eventoId,
                            acreedorId: d.acreedorId,
                            monto: d.monto,
                          }),
                      },
                    ],
                  );
                }}
              >
                <Text style={styles.botonSecundarioText}>Reportar pago</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonSecundario, { marginTop: 12 }]}
                onPress={async () => {
                  try {
                    const pagos: any[] = await obtenerPagosEvento(eventoId);
                    const reporte = pagos.find((p) => p.estado === "reportado");
                    if (!reporte) {
                      Alert.alert(
                        "No hay reportes",
                        "No hay pagos reportados para confirmar.",
                      );
                      return;
                    }
                    const acreedorNombre =
                      participantesPorId.get(reporte.acreedor_id) ??
                      reporte.acreedor_id;
                    Alert.alert(
                      "Confirmar pago",
                      `Confirmar pago de ${formatearMonto(reporte.monto)} reportado a ${acreedorNombre}?`,
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Confirmar",
                          onPress: () =>
                            confirmarPagoMutation.mutate(reporte.id),
                        },
                      ],
                    );
                  } catch (err: any) {
                    Alert.alert(
                      "Error",
                      err?.message ?? "No se pudo consultar pagos.",
                    );
                  }
                }}
              >
                <Text style={styles.botonSecundarioText}>Confirmar pago</Text>
              </TouchableOpacity>
            </>
          )}

          {/* TAB PARTICIPANTES */}
          {tabActivo === "participantes" && (
            <>
              {loadingParticipantes ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
              ) : participantes.length === 0 ? (
                <Text style={styles.emptyText}>Sin participantes.</Text>
              ) : (
                participantes.map((p: any) => {
                  const balance = balances.find(
                    (b) => b.contactoId === p.contacto_id,
                  );
                  const monto = balance?.balance ?? 0;
                  const nombre = obtenerNombreContacto(p.contactos);
                  return (
                    <View key={p.contacto_id} style={styles.gastoCard}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {nombre.substring(0, 1).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>{nombre}</Text>
                        <Text style={styles.cardSub}>
                          {monto >= 0 ? "Recibe" : "Debe"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.gastoMonto,
                          monto >= 0 ? styles.positivo : styles.negativo,
                        ]}
                      >
                        {monto >= 0 ? "+" : ""}
                        {formatearMonto(monto)}
                      </Text>
                    </View>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* FAB — solo visible en tab Gastos */}
      {tabActivo === "gastos" && (
        <View style={styles.fabWrapper}>
          <TouchableOpacity
            style={styles.mainFab}
            onPress={() =>
              router.push(`/(tabs)/gastoNuevo?eventoId=${eventoId}`)
            }
          >
            <Feather name="plus" size={28} color="#000000" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },

  // --- HEADER CARD ---
  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 110,
  },
  headerLeft: {
    flex: 1,
    paddingRight: 12,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  eventoTitulo: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    flex: 1,
  },
  eventoDesc: {
    color: "#AAAAAA",
    fontSize: 13,
    marginBottom: 10,
  },
  infoPills: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  headerRight: {
    justifyContent: "center",
    alignItems: "flex-end",
  },
  totalMonto: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  totalLabel: {
    color: "#AAAAAA",
    fontSize: 12,
    marginTop: 2,
  },

  // --- TABS ---
  tabBar: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    marginBottom: 16,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 18,
    alignItems: "center",
  },
  tabActivo: { backgroundColor: "rgba(255,255,255,0.15)" },
  tabText: { color: "rgba(255,255,255,0.5)", fontSize: 14 },
  tabTextActivo: { color: "#FFFFFF", fontWeight: "bold" },

  // --- CONTENIDO ---
  contenido: { flex: 1 },
  scrollPadding: { paddingBottom: 100 },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 20,
  },

  // --- CARDS GASTOS / PARTICIPANTES ---
  gastoCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(40, 40, 40, 0.6)",
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  cardInfo: { flex: 1 },
  cardTitulo: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  cardSub: {
    color: "#888888",
    fontSize: 12,
    marginTop: 2,
  },
  fechaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 5,
  },
  cardFecha: { color: "rgba(255,255,255,0.3)", fontSize: 11 },
  gastoMonto: {
    color: "#4CAF50",
    fontSize: 15,
    fontWeight: "bold",
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 10,
    backgroundColor: "rgba(255, 82, 82, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 107, 107, 0.35)",
  },
  deudaMonto: { color: "#FF5252" },
  flecha: { color: "rgba(255,255,255,0.4)" },
  positivo: { color: "#4CAF50" },
  negativo: { color: "#FF5252" },

  // --- BOTÓN SECUNDARIO (balances) ---
  botonSecundario: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 15,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  botonSecundarioText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 15,
  },

  // --- FAB ---
  fabWrapper: {
    position: "absolute",
    bottom: 30,
    right: 20,
  },
  mainFab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 8,
  },
});
