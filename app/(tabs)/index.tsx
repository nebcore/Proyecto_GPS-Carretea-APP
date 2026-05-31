import GlassCard from "@/components/ui/GlassCard";
import Header from "@/components/ui/Header";
import { getActividadReciente, getTotalGastos } from "@/lib/api/gastos";
import { getEventos } from "@/lib/api/eventos";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const formatearMonto = (monto: number) =>
  `$${monto.toLocaleString("es-CL")}`;

const formatearTiempoRelativo = (fechaString: string) => {
  const fecha = new Date(fechaString);
  const ahora = new Date();
  const diff = ahora.getTime() - fecha.getTime();
  const minutos = Math.floor(diff / 60000);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);

  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  if (horas < 24) return `Hace ${horas} hora${horas !== 1 ? "s" : ""}`;
  if (dias === 1) return "Ayer";
  return `Hace ${dias} días`;
};

export default function InicioScreen() {
  const insets = useSafeAreaInsets();

  const { data: eventos = [] } = useQuery({
    queryKey: ["eventos"],
    queryFn: getEventos,
  });

  const { data: totalGastos = 0 } = useQuery({
    queryKey: ["total-gastos"],
    queryFn: getTotalGastos,
  });

  const { data: actividad = [] } = useQuery({
    queryKey: ["actividad-reciente"],
    queryFn: () => getActividadReciente(8),
  });

  const eventosActivos = eventos.filter((e: any) => e.estado === "abierto").length;

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
        {/* STAT CARDS */}
        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Eventos activos</Text>
            <Text style={styles.statNumero}>{eventosActivos}</Text>
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Total gastado</Text>
            <Text style={styles.statNumero}>{formatearMonto(totalGastos)}</Text>
          </GlassCard>
        </View>

        {/* ACTIVIDAD RECIENTE */}
        <Text style={styles.seccionTitulo}>Actividad reciente</Text>

        {actividad.length === 0 ? (
          <Text style={styles.emptyText}>Aún no hay actividad registrada.</Text>
        ) : (
          actividad.map((item: any) => {
            const eventoTitulo = (item.eventos as any)?.titulo ?? "Sin evento";
            const pagador =
              item.gastos_pagadores?.[0]?.contactos?.nombre ?? "Desconocido";

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.actividadCard}
                onPress={() =>
                  router.push({
                    pathname: "/(tabs)/eventoDetalle" as any,
                    params: { eventoId: item.evento_id },
                  })
                }
                activeOpacity={0.75}
              >
                {/* ICONO */}
                <View style={styles.iconCircle}>
                  <Feather
                    name="arrow-up-right"
                    size={18}
                    color="#FF5252"
                  />
                </View>

                {/* INFO */}
                <View style={styles.actividadInfo}>
                  <Text style={styles.actividadTitulo} numberOfLines={1}>
                    {item.descripcion}
                  </Text>
                  <Text style={styles.actividadEvento} numberOfLines={1}>
                    {eventoTitulo}
                  </Text>
                  <Text style={styles.actividadParticipante}>
                    {pagador}
                  </Text>
                  <Text style={styles.actividadHora}>
                    {formatearTiempoRelativo(item.fecha)}
                  </Text>
                </View>

                {/* MONTO */}
                <Text style={styles.actividadMonto}>
                  {formatearMonto(item.monto_total)}
                </Text>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16 },

  // --- STAT CARDS ---
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    alignItems: "flex-start",
  },
  statLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    marginBottom: 8,
  },
  statNumero: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
  },

  // --- SECCIÓN ---
  seccionTitulo: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  emptyText: {
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    marginTop: 12,
  },

  // --- ACTIVIDAD ---
  actividadCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(40, 40, 40, 0.6)",
    borderRadius: 15,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 82, 82, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  actividadInfo: {
    flex: 1,
    gap: 2,
  },
  actividadTitulo: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  actividadEvento: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
  },
  actividadParticipante: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  actividadHora: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 11,
    marginTop: 2,
  },
  actividadMonto: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
    alignSelf: "center",
  },
});
