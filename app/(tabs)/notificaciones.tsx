import GlassCard from "@/components/ui/GlassCard";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import {
    contarNotificacionesNoLeidas,
    marcarNotificacionLeida,
    marcarTodasLasNotificacionesLeidas,
    obtenerNotificacionesUsuario,
} from "@/lib/api/notificaciones";

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

export default function NotificacionesScreen() {
  const queryClient = useQueryClient();

  const { data: notificaciones = [], isLoading } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => obtenerNotificacionesUsuario(50),
  });

  const { data: noLeidas = 0 } = useQuery({
    queryKey: ["notificaciones-no-leidas"],
    queryFn: contarNotificacionesNoLeidas,
  });

  const marcarUnaLeidaMutation = useMutation({
    mutationFn: marcarNotificacionLeida,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
    },
  });

  const marcarTodasMutation = useMutation({
    mutationFn: marcarTodasLasNotificacionesLeidas,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
    },
  });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>Notificaciones</Text>
            <Text style={styles.subtitle}>
              {noLeidas} sin leer · {notificaciones.length} totales
            </Text>
          </View>

          {noLeidas > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={() => marcarTodasMutation.mutate()}
              disabled={marcarTodasMutation.isPending}
            >
              <Text style={styles.markAllText}>Marcar todo</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {isLoading ? (
          <Text style={styles.emptyText}>Cargando notificaciones...</Text>
        ) : notificaciones.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Feather name="bell-off" size={26} color="#AAAAAA" />
            <Text style={styles.emptyTitle}>No tienes notificaciones</Text>
            <Text style={styles.emptyBody}>
              Cuando llegue una invitación, un pago o un cambio importante de un
              evento, aparecerá aquí.
            </Text>
          </GlassCard>
        ) : (
          notificaciones.map((notificacion) => (
            <TouchableOpacity
              key={notificacion.id}
              activeOpacity={0.8}
              onPress={() => {
                if (!notificacion.leida) {
                  marcarUnaLeidaMutation.mutate(notificacion.id);
                }
              }}
            >
              <GlassCard
                style={[styles.card, !notificacion.leida && styles.cardNoLeida]}
              >
                <View style={styles.cardTop}>
                  <View style={styles.iconCircle}>
                    <Feather
                      name={notificacion.leida ? "bell" : "bell"}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardTitle}>{notificacion.titulo}</Text>
                    {notificacion.cuerpo ? (
                      <Text style={styles.cardText}>{notificacion.cuerpo}</Text>
                    ) : null}
                    <Text style={styles.cardTime}>
                      {formatearTiempoRelativo(notificacion.creado_en)}
                    </Text>
                  </View>
                  {!notificacion.leida ? <View style={styles.dot} /> : null}
                </View>
              </GlassCard>
            </TouchableOpacity>
          ))
        )}

        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Feather name="arrow-left" size={18} color="#FFFFFF" />
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
  },
  subtitle: {
    color: "rgba(255,255,255,0.55)",
    marginTop: 4,
  },
  markAllBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  markAllText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  emptyText: {
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    marginTop: 24,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "600",
  },
  emptyBody: {
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    borderRadius: 18,
    marginBottom: 12,
    padding: 16,
  },
  cardNoLeida: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  cardBody: { flex: 1, gap: 4 },
  cardTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  cardText: {
    color: "rgba(255,255,255,0.75)",
    lineHeight: 19,
  },
  cardTime: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#FF5252",
    marginTop: 5,
  },
  backBtn: {
    marginTop: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  backText: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
