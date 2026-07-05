import { Alert } from "@/components/ui/AppAlert";
import GlassCard from "@/components/ui/GlassCard";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { getContactosParaInvitar } from "@/lib/api/contactos";
import {
  deleteEvento,
  getEventos,
  invitarContactoAlEvento,
} from "@/lib/api/eventos";

const formatearFecha = (fechaString: string) => {
  if (!fechaString) return "Fecha sin definir";
  return new Date(fechaString).toLocaleString("es-CL", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export default function EventosScreen() {
  "use no memo";
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const [modalDetalleVisible, setModalDetalleVisible] = useState(false);
  const [eventoSeleccionado, setEventoSeleccionado] = useState<any>(null);
  const [modalInvitarVisible, setModalInvitarVisible] = useState(false);

  const { data: eventos = [], isLoading: loadingEventos } = useQuery({
    queryKey: ["eventos"],
    queryFn: getEventos,
  });

  const { data: contactos = [], isLoading: loadingContactos } = useQuery({
    queryKey: ["contactos-invitar"],
    queryFn: getContactosParaInvitar,
  });

  const invitarMutation = useMutation({
    mutationFn: (contactoId: string) =>
      invitarContactoAlEvento(eventoSeleccionado.id, contactoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      setModalInvitarVisible(false);
      Alert.alert("¡Invitado!", "Contacto agregado al evento.");
    },
    onError: (error: any) =>
      Alert.alert("Error", error.message || "No se pudo invitar al contacto."),
  });

  const eliminarEventoMutation = useMutation({
    mutationFn: (eventoId: string) => deleteEvento(eventoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      setModalDetalleVisible(false);
      Alert.alert("Eliminado", "El evento fue borrado.");
    },
    onError: () => Alert.alert("Error", "No se pudo eliminar el evento."),
  });

  const abrirDetalle = (evento: any) => {
    router.push({
      pathname: "/(tabs)/eventoDetalle" as any,
      params: { eventoId: evento.id },
    });
  };

  const confirmarEliminar = () => {
    Alert.alert("¿Eliminar evento?", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => eliminarEventoMutation.mutate(eventoSeleccionado.id),
      },
    ]);
  };

  const yaEstaInvitado = (contactoId: string) =>
    eventoSeleccionado?.participantes_evento?.some(
      (p: any) => p.contacto_id === contactoId,
    );

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.formCard}>
            {/* HEADER */}
            <View style={styles.headerRow}>
              <View>
                <Text style={styles.title}>Mis Eventos</Text>
                <Text style={styles.subtitle}>
                  {eventos.length} evento{eventos.length !== 1 ? "s" : ""}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push("/(tabs)/nuevoEvento")}
              >
                <Feather name="plus" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* LISTA DE EVENTOS */}
            {loadingEventos ? (
              <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
            ) : eventos.length === 0 ? (
              <Text style={styles.emptyText}>
                Aún no tienes Eventos. ¡Crea la primera!
              </Text>
            ) : (
              eventos.map((evento: any) => (
                <TouchableOpacity
                  key={evento.id}
                  style={styles.eventoCard}
                  onPress={() => abrirDetalle(evento)}
                  activeOpacity={0.7}
                >
                  <View style={styles.eventoAvatar}>
                    <Text style={styles.eventoAvatarText}>
                      {evento.titulo.substring(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.eventoCardBody}>
                    <View style={styles.eventoCardTop}>
                      <Text style={styles.eventoTitulo}>{evento.titulo}</Text>
                      <View style={styles.estadoBadge}>
                        <Text style={styles.estadoText}>{evento.estado}</Text>
                      </View>
                    </View>
                    <Text style={styles.eventoInfo}>
                      <Feather name="calendar" size={12} />{" "}
                      {formatearFecha(evento.fecha_evento)}
                    </Text>
                    {evento.ubicacion ? (
                      <Text style={styles.eventoInfo}>
                        <Feather name="map-pin" size={12} /> {evento.ubicacion}
                      </Text>
                    ) : null}
                    <Text style={styles.eventoParticipantes}>
                      <Feather name="users" size={12} />{" "}
                      {evento.participantes_evento?.length ?? 0} participante
                      {evento.participantes_evento?.length !== 1 ? "s" : ""}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL DETALLE EVENTO */}
      <Modal visible={modalDetalleVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 24 + insets.bottom }]}>
            {eventoSeleccionado && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.modalTitle}>
                  {eventoSeleccionado.titulo}
                </Text>

                <View style={styles.detalleRow}>
                  <Feather name="calendar" size={14} color="#AAAAAA" />
                  <Text style={styles.detalleText}>
                    {formatearFecha(eventoSeleccionado.fecha_evento)}
                  </Text>
                </View>

                {eventoSeleccionado.ubicacion ? (
                  <View style={styles.detalleRow}>
                    <Feather name="map-pin" size={14} color="#AAAAAA" />
                    <Text style={styles.detalleText}>
                      {eventoSeleccionado.ubicacion}
                    </Text>
                  </View>
                ) : null}

                {eventoSeleccionado.descripcion ? (
                  <View style={styles.detalleRow}>
                    <Feather name="file-text" size={14} color="#AAAAAA" />
                    <Text style={styles.detalleText}>
                      {eventoSeleccionado.descripcion}
                    </Text>
                  </View>
                ) : null}

                <Text style={styles.sectionLabel}>
                  Participantes (
                  {eventoSeleccionado.participantes_evento?.length ?? 0})
                </Text>
                <View style={styles.chipsContainer}>
                  {(eventoSeleccionado.participantes_evento ?? []).map(
                    (p: any) => (
                      <View key={p.contacto_id} style={styles.chip}>
                        <Text style={styles.chipText}>
                          {p.contactos?.nombre ?? "Participante"}
                        </Text>
                      </View>
                    ),
                  )}
                </View>

                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setModalInvitarVisible(true)}
                >
                  <Feather name="user-plus" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Invitar contacto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: "rgba(124, 58, 237, 0.3)" },
                  ]}
                  onPress={() => {
                    setModalDetalleVisible(false);
                    router.push(
                      `/(tabs)/gastoNuevo?eventoId=${eventoSeleccionado.id}`,
                    );
                  }}
                >
                  <Feather name="plus-circle" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Agregar gasto</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    { backgroundColor: "rgba(245, 158, 11, 0.3)" },
                  ]}
                  onPress={() => {
                    setModalDetalleVisible(false);
                    router.push(
                      `/(tabs)/saldos?eventoId=${eventoSeleccionado.id}`,
                    );
                  }}
                >
                  <Feather name="bar-chart-2" size={16} color="#FFFFFF" />
                  <Text style={styles.actionBtnText}>Ver saldos</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={confirmarEliminar}
                >
                  <Feather name="trash-2" size={16} color="#FF5555" />
                  <Text style={styles.deleteBtnText}>Eliminar evento</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setModalDetalleVisible(false)}
                >
                  <Text style={styles.cancelBtnText}>Cerrar</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL INVITAR CONTACTO */}
      <Modal visible={modalInvitarVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: 24 + insets.bottom }]}>
            <Text style={styles.modalTitle}>Invitar contacto</Text>
            {loadingContactos ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <ScrollView>
                {contactos.map((c: any) => {
                  const invitado = yaEstaInvitado(c.id);
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[
                        styles.contactRow,
                        invitado && styles.contactRowDisabled,
                      ]}
                      onPress={() => !invitado && invitarMutation.mutate(c.id)}
                      disabled={invitado || invitarMutation.isPending}
                    >
                      <Text
                        style={[
                          styles.contactNombre,
                          invitado && { color: "#555" },
                        ]}
                      >
                        {c.nombre}
                      </Text>
                      {invitado ? (
                        <Text style={styles.yaInvitadoText}>Ya invitado</Text>
                      ) : invitarMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Feather name="plus" size={18} color="#FFFFFF" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 12 }]}
              onPress={() => setModalInvitarVisible(false)}
            >
              <Text style={styles.cancelBtnText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  flex: { flex: 1 },
  container: { paddingHorizontal: 24, paddingBottom: 24, paddingTop: 8 },
  formCard: {
    borderRadius: 30,
    padding: 20,
    marginTop: 20,
    marginBottom: 40,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { color: "#FFFFFF", fontSize: 28, fontWeight: "bold" },
  subtitle: { color: "#AAAAAA", fontSize: 14, marginTop: 2 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    color: "#AAAAAA",
    textAlign: "center",
    marginTop: 20,
    fontSize: 14,
  },
  eventoCard: {
    backgroundColor: "rgba(40, 40, 40, 0.6)",
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    flexDirection: "row",
    alignItems: "center",
  },
  eventoAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  eventoAvatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
  eventoCardBody: { flex: 1 },
  eventoCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  eventoTitulo: { color: "#FFFFFF", fontSize: 17, fontWeight: "bold", flex: 1 },
  estadoBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginLeft: 8,
  },
  estadoText: { color: "#AAAAAA", fontSize: 11 },
  eventoInfo: { color: "#AAAAAA", fontSize: 13, marginTop: 3 },
  eventoParticipantes: { color: "#AAAAAA", fontSize: 12, marginTop: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "rgba(25,25,25,0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipText: { color: "#AAAAAA", fontSize: 13 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  cancelBtnText: { color: "#AAAAAA", fontWeight: "bold" },
  sectionLabel: {
    color: "#AAAAAA",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 20,
    marginBottom: 8,
  },
  detalleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  detalleText: { color: "#CCCCCC", fontSize: 14, flex: 1 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  actionBtnText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,85,85,0.1)",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,85,85,0.2)",
  },
  deleteBtnText: { color: "#FF5555", fontWeight: "bold", fontSize: 15 },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  contactRowDisabled: { opacity: 0.4 },
  contactNombre: { color: "#FFFFFF", fontSize: 15 },
  yaInvitadoText: { color: "#555", fontSize: 13 },
});
