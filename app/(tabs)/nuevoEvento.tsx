"use no memo";
import { Alert } from "@/components/ui/AppAlert";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { PantallaConTeclado } from "@/components/ui/PantallaConTeclado";
import { createContactoConGrupos, getContactos } from "@/lib/api/contactos";
import {
  createEventoConParticipantes,
  obtenerAttendeesParaCalendar,
} from "@/lib/api/eventos";
import { getGrupos } from "@/lib/api/grupos";
import { obtenerGoogleToken } from "@/lib/api/usuarios";
import { supabase } from "@/lib/supabase";
import { crearEventoCalendar } from "@/services/googleCalendar";

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

export default function NuevoEventoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [fecha, setFecha] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modoFecha, setModoFecha] = useState<"date" | "time">("date");
  const [agregarAlCalendar, setAgregarAlCalendar] = useState(false);

  const [participantesSeleccionados, setParticipantesSeleccionados] = useState<
    any[]
  >([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState({
    id: "todos",
    nombre: "Todos",
  });
  const [modalGruposVisible, setModalGruposVisible] = useState(false);

  const [modalNuevoPartVisible, setModalNuevoPartVisible] = useState(false);
  const [nuevoPartNombre, setNuevoPartNombre] = useState("");
  const [nuevoPartNumero, setNuevoPartNumero] = useState("");
  const [nuevoPartGrupos, setNuevoPartGrupos] = useState<any[]>([]);
  const [mostrarSelectorGruposNuevo, setMostrarSelectorGruposNuevo] =
    useState(false);

  const { data: contactosBD = [] } = useQuery({
    queryKey: ["contactos"],
    queryFn: getContactos,
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos"],
    queryFn: getGrupos,
  });

  const crearEventoMutation = useMutation({
    mutationFn: async () => {
      const idsFinales: string[] = [];
      for (const part of participantesSeleccionados) {
        if (part.id.startsWith("temp_")) {
          const contacto = await createContactoConGrupos(
            part.nombre,
            part.telefono || "",
            [],
          );
          idsFinales.push(contacto.id);
        } else {
          idsFinales.push(part.id);
        }
      }
      return createEventoConParticipantes(
        nombre.trim(),
        descripcion.trim(),
        ubicacion.trim(),
        fecha.toISOString(),
        idsFinales,
      );
    },
    onSuccess: async (nuevoEvento: any) => {
      if (agregarAlCalendar) {
        try {
          const accessToken = await obtenerGoogleToken();
          if (accessToken) {
            const participantesParaAttendees = participantesSeleccionados.map(
              (p: any) => ({
                contactos: {
                  nombre: p.nombre,
                  referencia_usuario_id: p.referencia_usuario_id,
                },
              }),
            );
            const { attendees, sinEmail } = await obtenerAttendeesParaCalendar(
              participantesParaAttendees,
            );

            const resultado = await crearEventoCalendar(accessToken, {
              titulo: nombre.trim(),
              descripcion: descripcion.trim(),
              fechaInicio: fecha.toISOString(),
              fechaFin: fecha.toISOString(),
              attendees,
            });
            if (resultado?.id) {
              const { error } = await supabase
                .from("eventos")
                .update({ google_event_id: resultado.id })
                .eq("id", nuevoEvento?.id);

              if (error) {
                console.log("Error al guardar google_event_id:", error);
                Alert.alert(
                  "Aviso",
                  "El evento se creó y se agregó a Google Calendar, pero no quedó vinculado correctamente. Puedes intentar sincronizarlo de nuevo desde el detalle del evento.",
                );
              }
            }
            if (sinEmail.length > 0) {
              Alert.alert(
                "Agregado con aviso",
                `Evento agregado a Google Calendar. Estos participantes no tienen email y no recibieron invitación: ${sinEmail.join(", ")}`,
              );
            }
          } else {
            Alert.alert(
              "Conecta Google",
              "Ve a tu perfil y conecta Google Calendar primero.",
            );
          }
        } catch (e) {
          console.log("Error al agregar a Calendar:", e);
          Alert.alert(
            "Aviso",
            "El evento se creó, pero no se pudo sincronizar con Google Calendar.",
          );
        }
      }
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      router.back();
    },
    onError: () =>
      Alert.alert("Error", "No se pudo guardar el evento. Intenta de nuevo."),
  });

  const contactosFiltrados =
    grupoSeleccionado.id === "todos"
      ? contactosBD
      : contactosBD.filter((c: any) =>
          c.gruposAsignados?.some((g: any) => g.id === grupoSeleccionado.id),
        );

  const participantesDisplay = [
    ...participantesSeleccionados.filter((p) => p.id.startsWith("temp_")),
    ...contactosFiltrados.map((c: any) => ({
      ...c,
      seleccionado: participantesSeleccionados.some((p) => p.id === c.id),
    })),
  ];

  const toggleParticipante = (item: any) => {
    const yaSeleccionado = participantesSeleccionados.some(
      (p) => p.id === item.id,
    );
    if (yaSeleccionado) {
      setParticipantesSeleccionados((prev) =>
        prev.filter((p) => p.id !== item.id),
      );
    } else {
      setParticipantesSeleccionados((prev) => [
        ...prev,
        { ...item, seleccionado: true },
      ]);
    }
  };

  const abrirModalNuevoParticipante = () => {
    setNuevoPartNombre("");
    setNuevoPartNumero("");
    setNuevoPartGrupos([]);
    setMostrarSelectorGruposNuevo(false);
    setModalNuevoPartVisible(true);
  };

  const agregarParticipanteTemporal = () => {
    if (nuevoPartNombre.trim() === "")
      return Alert.alert("Error", "El nombre es obligatorio.");
    const nuevoTemp = {
      id: `temp_${Date.now()}`,
      nombre: nuevoPartNombre.trim(),
      telefono: nuevoPartNumero,
      seleccionado: true,
    };
    setParticipantesSeleccionados((prev) => [nuevoTemp, ...prev]);
    setModalNuevoPartVisible(false);
  };

  const agregarParticipanteAgenda = async () => {
    if (nuevoPartNombre.trim() === "")
      return Alert.alert("Error", "El nombre es obligatorio.");
    try {
      const gruposIds = nuevoPartGrupos.map((g: any) => g.id);
      const contacto = await createContactoConGrupos(
        nuevoPartNombre.trim(),
        nuevoPartNumero,
        gruposIds,
      );
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      setParticipantesSeleccionados((prev) => [
        { ...contacto, seleccionado: true },
        ...prev,
      ]);
      setModalNuevoPartVisible(false);
    } catch {
      Alert.alert("Error", "No se pudo guardar el contacto en la agenda.");
    }
  };

  const gruposDisponiblesNuevoPart = grupos.filter(
    (g: any) => !nuevoPartGrupos.some((ng) => ng.id === g.id),
  );

  const handleCrearEvento = () => {
    if (nombre.trim() === "") {
      Alert.alert("Error", "El nombre del evento no puede estar vacío.");
      return;
    }
    if (participantesSeleccionados.length === 0) {
      Alert.alert(
        "Evento sin participantes",
        "¿Estás seguro de crear un evento sin asignar a nadie? Podrás agregarlos después.",
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Sí, crear", onPress: () => crearEventoMutation.mutate() },
        ],
      );
      return;
    }
    crearEventoMutation.mutate();
  };

  return (
    <View style={styles.root}>
      <PantallaConTeclado style={styles.container}>
        <View style={styles.formCard}>
          {/* ENCABEZADO */}
          <View style={styles.headerForm}>
            <View style={styles.headerTextContainer}>
              <Text style={styles.title}>Nuevo Evento</Text>
              <Text style={styles.subtitle}>
                Parámetros necesarios del evento
              </Text>
            </View>
            <View style={styles.iconCircle}>
              <Feather name="edit-3" size={24} color="#FFFFFF" />
            </View>
          </View>

          {/* NOMBRE */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nombre de Evento</Text>
            <View style={styles.inputContainer}>
              <Feather
                name="map-pin"
                size={20}
                color="#AAAAAA"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Ej: Asado del viernes, Salida a la Tropi…"
                placeholderTextColor="#666666"
                value={nombre}
                onChangeText={setNombre}
                maxLength={50}
              />
            </View>
          </View>

          {/* FECHA Y HORA */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Fecha y Hora</Text>
            <View style={styles.dateRow}>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => {
                  setModoFecha("date");
                  setShowDatePicker(true);
                }}
              >
                <Feather name="calendar" size={16} color="#AAAAAA" />
                <Text style={styles.dateBtnText}>
                  {fecha.toLocaleDateString("es-CL")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dateBtn}
                onPress={() => {
                  setModoFecha("time");
                  setShowDatePicker(true);
                }}
              >
                <Feather name="clock" size={16} color="#AAAAAA" />
                <Text style={styles.dateBtnText}>
                  {fecha.toLocaleTimeString("es-CL", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={fecha}
                mode={modoFecha}
                is24Hour={false}
                display="default"
                onChange={(_, selected) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (selected) setFecha(selected);
                }}
              />
            )}
          </View>

          {/* UBICACIÓN */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Ubicación (Opcional)</Text>
            <View style={styles.inputContainer}>
              <Feather
                name="navigation"
                size={20}
                color="#AAAAAA"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder="Ej: Mi casa, La plaza…"
                placeholderTextColor="#666666"
                value={ubicacion}
                onChangeText={setUbicacion}
                maxLength={100}
              />
            </View>
          </View>

          {/* PARTICIPANTES */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Participantes ({participantesSeleccionados.length})
            </Text>
            <View style={styles.integrantesContainer}>
              <View style={styles.columnaIzquierda}>
                <View style={styles.grupoRow}>
                  <TouchableOpacity
                    style={styles.dropdownGrupo}
                    onPress={() => setModalGruposVisible(true)}
                  >
                    <Text style={styles.dropdownText} numberOfLines={1}>
                      {grupoSeleccionado.nombre}
                    </Text>
                    <Feather name="chevron-down" size={18} color="#AAAAAA" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.botonAdd}
                    onPress={abrirModalNuevoParticipante}
                  >
                    <Feather name="plus" size={18} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.circulosScroll}
                >
                  {participantesDisplay.length === 0 ? (
                    <Text style={styles.emptyContactsText}>
                      No hay contactos en esta lista.
                    </Text>
                  ) : (
                    participantesDisplay.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.participanteItem}
                        onPress={() => toggleParticipante(item)}
                      >
                        <View
                          style={[
                            styles.circuloAvatar,
                            item.seleccionado && styles.circuloSeleccionado,
                            item.id.startsWith("temp_") &&
                              styles.circuloTemporal,
                          ]}
                        >
                          {item.seleccionado && (
                            <View style={styles.checkBadge}>
                              <Feather name="check" size={10} color="#000000" />
                            </View>
                          )}
                        </View>
                        <Text style={styles.nombreAvatar} numberOfLines={1}>
                          {item.nombre}
                        </Text>
                      </TouchableOpacity>
                    ))
                  )}
                </ScrollView>
              </View>

              <View style={styles.divisorVertical} />

              <View style={styles.columnaDerecha}>
                <ScrollView showsVerticalScrollIndicator={false}>
                  {participantesSeleccionados.length === 0 ? (
                    <Text style={styles.emptyText}>Ninguno</Text>
                  ) : (
                    participantesSeleccionados.map((item) => (
                      <View key={item.id} style={styles.rowSeleccionado}>
                        <View style={styles.rowInfo}>
                          <View
                            style={[
                              styles.circuloPequeno,
                              item.id.startsWith("temp_") && {
                                borderColor: "#4CAF50",
                              },
                            ]}
                          />
                          <Text style={styles.nombreLista} numberOfLines={1}>
                            {item.nombre}
                          </Text>
                        </View>
                        <TouchableOpacity
                          style={styles.btnCerrarX}
                          onPress={() => toggleParticipante(item)}
                        >
                          <Feather name="x" size={16} color="#AAAAAA" />
                        </TouchableOpacity>
                      </View>
                    ))
                  )}
                </ScrollView>
              </View>
            </View>
          </View>

          {/* AGREGAR A GOOGLE CALENDAR */}
          <TouchableOpacity
            style={[
              styles.calendarToggle,
              agregarAlCalendar && styles.calendarToggleActivo,
            ]}
            onPress={() => setAgregarAlCalendar(!agregarAlCalendar)}
          >
            <Feather
              name="calendar"
              size={16}
              color={agregarAlCalendar ? "#4285F4" : "#AAAAAA"}
            />
            <Text
              style={[
                styles.calendarToggleText,
                agregarAlCalendar && { color: "#4285F4" },
              ]}
            >
              ¿Agregar a Google Calendar?
            </Text>
            <Feather
              name={agregarAlCalendar ? "check-circle" : "circle"}
              size={16}
              color={agregarAlCalendar ? "#4285F4" : "#AAAAAA"}
            />
          </TouchableOpacity>

          {/* DESCRIPCIÓN */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Descripción (Opcional)</Text>
            <View style={styles.inputContainerDesc}>
              <Feather
                name="align-left"
                size={20}
                color="#AAAAAA"
                style={styles.iconTop}
              />
              <TextInput
                style={styles.textArea}
                placeholder="Detalles adicionales sobre el evento…"
                placeholderTextColor="#666666"
                value={descripcion}
                onChangeText={setDescripcion}
                multiline
                maxLength={200}
              />
            </View>
          </View>

          {/* BOTONES */}
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={[
                styles.submitButton,
                (crearEventoMutation.isPending || nombre.trim() === "") && {
                  opacity: 0.5,
                },
              ]}
              onPress={handleCrearEvento}
              disabled={crearEventoMutation.isPending || nombre.trim() === ""}
            >
              <Text style={styles.submitButtonText}>Crear Evento</Text>
              <Feather name="arrow-right" size={20} color="#000000" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Feather name="x" size={20} color="#000000" />
            </TouchableOpacity>
          </View>
        </View>
      </PantallaConTeclado>

      {/* MODAL GRUPOS FILTRO */}
      <Modal visible={modalGruposVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalGruposVisible(false)}
        >
          <View style={styles.dropdownModalContainer}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => {
                setGrupoSeleccionado({ id: "todos", nombre: "Todos" });
                setModalGruposVisible(false);
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  grupoSeleccionado.id === "todos" && {
                    color: "#FFFFFF",
                    fontWeight: "bold",
                  },
                ]}
              >
                Todos
              </Text>
            </TouchableOpacity>
            <View style={styles.divisorDropdown} />
            {grupos.map((grupo: any) => (
              <TouchableOpacity
                key={grupo.id}
                style={styles.dropdownItem}
                onPress={() => {
                  setGrupoSeleccionado({ id: grupo.id, nombre: grupo.nombre });
                  setModalGruposVisible(false);
                }}
              >
                <Text
                  style={[
                    styles.dropdownItemText,
                    grupoSeleccionado.id === grupo.id && {
                      color: "#FFFFFF",
                      fontWeight: "bold",
                    },
                  ]}
                >
                  {grupo.nombre}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* MODAL NUEVO PARTICIPANTE */}
      <Modal visible={modalNuevoPartVisible} transparent animationType="fade">
        <KeyboardAvoidingView
          style={[
            styles.modalOverlayCenter,
            { backgroundColor: "rgba(0,0,0,0.7)" },
          ]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalNuevoPartVisible(false)}
          />
          <View style={styles.editContactCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Nuevo Participante</Text>
              <TouchableOpacity onPress={() => setModalNuevoPartVisible(false)}>
                <Feather name="x" size={24} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            <View style={styles.editInputGroup}>
              <Feather
                name="user"
                size={16}
                color="#AAAAAA"
                style={styles.editIcon}
              />
              <TextInput
                style={styles.editInput}
                value={nuevoPartNombre}
                onChangeText={setNuevoPartNombre}
                placeholder="Nombre"
                placeholderTextColor="#666666"
                autoFocus
              />
            </View>
            <View style={styles.editInputGroup}>
              <Feather
                name="phone"
                size={16}
                color="#AAAAAA"
                style={styles.editIcon}
              />
              <TextInput
                style={styles.editInput}
                value={nuevoPartNumero}
                onChangeText={(text) =>
                  setNuevoPartNumero(formatearTelefono(text))
                }
                placeholder="Número (opcional)"
                placeholderTextColor="#666666"
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <Text style={styles.groupsLabel}>Asignar a grupos (Opcional):</Text>
            <View style={styles.tagsContainer}>
              {nuevoPartGrupos.map((grupo: any) => (
                <View key={grupo.id} style={styles.groupTag}>
                  <Text style={styles.groupTagText}>{grupo.nombre}</Text>
                  <TouchableOpacity
                    style={styles.groupTagRemove}
                    onPress={() =>
                      setNuevoPartGrupos((prev) =>
                        prev.filter((g) => g.id !== grupo.id),
                      )
                    }
                  >
                    <Feather name="x" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ))}
              <TouchableOpacity
                style={styles.addGroupTagBtn}
                onPress={() =>
                  setMostrarSelectorGruposNuevo(!mostrarSelectorGruposNuevo)
                }
              >
                <Feather
                  name={mostrarSelectorGruposNuevo ? "minus" : "plus"}
                  size={14}
                  color="#AAAAAA"
                />
              </TouchableOpacity>
            </View>

            {mostrarSelectorGruposNuevo && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.availableGroupsScroll}
              >
                {gruposDisponiblesNuevoPart.length === 0 ? (
                  <Text style={styles.noMoreGroupsText}>
                    No hay más grupos disponibles.
                  </Text>
                ) : (
                  gruposDisponiblesNuevoPart.map((grupo: any) => (
                    <TouchableOpacity
                      key={grupo.id}
                      style={styles.availableGroupBadge}
                      onPress={() => {
                        setNuevoPartGrupos((prev) => [...prev, grupo]);
                        setMostrarSelectorGruposNuevo(false);
                      }}
                    >
                      <Feather name="plus" size={12} color="#4CAF50" />
                      <Text style={styles.availableGroupText}>
                        {grupo.nombre}
                      </Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            )}

            <View style={styles.splitButtonsContainer}>
              <TouchableOpacity
                style={styles.btnTemporal}
                onPress={agregarParticipanteTemporal}
              >
                <Text style={styles.btnTemporalText}>Agregar Temporal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btnAgenda}
                onPress={agregarParticipanteAgenda}
              >
                <Feather
                  name="save"
                  size={18}
                  color="#000000"
                  style={{ marginRight: 5 }}
                />
                <Text style={styles.btnAgendaText}>Agenda</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  container: {
    flex: 1,
    backgroundColor: "transparent",
    padding: 20,
  },
  formCard: {
    backgroundColor: "rgba(25, 25, 25, 0.5)",
    borderRadius: 30,
    padding: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginTop: 20,
    marginBottom: 40,
  },
  headerForm: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 30,
  },
  headerTextContainer: { flex: 1, paddingRight: 15 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: { color: "#AAAAAA", fontSize: 14 },
  inputGroup: { marginBottom: 20 },
  label: {
    color: "#CCCCCC",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
    marginLeft: 5,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#FFFFFF", fontSize: 15, paddingVertical: 15 },
  dateRow: { flexDirection: "row", gap: 10 },
  dateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  dateBtnText: { color: "#FFFFFF", fontSize: 14 },
  inputContainerDesc: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    minHeight: 120,
  },
  iconTop: { marginRight: 10, marginTop: 2 },
  textArea: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    textAlignVertical: "top",
    paddingTop: 0,
  },
  integrantesContainer: { flexDirection: "row", height: 140 },
  columnaIzquierda: { flex: 1.2, paddingRight: 10 },
  columnaDerecha: { flex: 0.8, paddingLeft: 10 },
  divisorVertical: {
    width: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 5,
  },
  grupoRow: { flexDirection: "row", gap: 10, marginBottom: 15 },
  dropdownGrupo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dropdownText: { color: "#FFFFFF", fontSize: 14 },
  botonAdd: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  circulosScroll: { gap: 15 },
  participanteItem: { alignItems: "center" },
  circuloAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#AAAAAA",
    backgroundColor: "transparent",
    marginBottom: 6,
  },
  circuloSeleccionado: { borderColor: "#FFFFFF", borderWidth: 2 },
  circuloTemporal: { borderColor: "#4CAF50" },
  checkBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: "#FFFFFF",
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  nombreAvatar: { color: "#FFFFFF", fontSize: 12 },
  emptyContactsText: { color: "#666", fontSize: 12, marginTop: 10 },
  emptyText: {
    color: "#666666",
    fontSize: 13,
    fontStyle: "italic",
    textAlign: "center",
    marginTop: 20,
  },
  rowSeleccionado: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  rowInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  btnCerrarX: { padding: 5 },
  circuloPequeno: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#AAAAAA",
    marginRight: 10,
    flexShrink: 0,
  },
  nombreLista: { color: "#FFFFFF", fontSize: 13, flex: 1 },
  actionButtonsContainer: { flexDirection: "row", marginTop: 10, gap: 12 },
  submitButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    paddingVertical: 16,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitButtonText: { color: "#000000", fontSize: 16, fontWeight: "bold" },
  secondaryButton: {
    width: 60,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownModalContainer: {
    width: 200,
    backgroundColor: "rgba(25, 25, 25, 0.95)",
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    position: "absolute",
    top: "40%",
    left: "10%",
  },
  dropdownItem: { paddingVertical: 10 },
  dropdownItemText: { color: "#AAAAAA", fontSize: 15 },
  divisorDropdown: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 5,
  },
  modalOverlayCenter: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  editContactCard: {
    width: "85%",
    backgroundColor: "rgba(25, 25, 25, 0.95)",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 20,
  },
  editHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  editTitle: { color: "#FFFFFF", fontSize: 18, fontWeight: "bold" },
  editInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 15,
  },
  editIcon: { marginRight: 10 },
  editInput: { flex: 1, color: "#FFFFFF", fontSize: 15 },
  groupsLabel: { color: "#AAAAAA", fontSize: 13, marginBottom: 10 },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 15,
  },
  groupTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  groupTagText: { color: "#FFFFFF", fontSize: 13, marginRight: 6 },
  groupTagRemove: {
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    padding: 2,
  },
  addGroupTagBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    borderStyle: "dashed",
  },
  availableGroupsScroll: { marginBottom: 20, maxHeight: 40 },
  availableGroupBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.15)",
    borderWidth: 1,
    borderColor: "#4CAF50",
    borderRadius: 15,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginRight: 8,
    gap: 5,
  },
  availableGroupText: { color: "#4CAF50", fontSize: 12, fontWeight: "600" },
  noMoreGroupsText: {
    color: "#666666",
    fontSize: 12,
    fontStyle: "italic",
    alignSelf: "center",
    marginTop: 5,
  },
  splitButtonsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  btnTemporal: {
    flex: 0.65,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnTemporalText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  btnAgenda: {
    flex: 0.35,
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnAgendaText: { color: "#000000", fontSize: 14, fontWeight: "bold" },
  calendarToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  calendarToggleActivo: {
    backgroundColor: "rgba(66,133,244,0.1)",
    borderColor: "rgba(66,133,244,0.4)",
  },
  calendarToggleText: {
    flex: 1,
    color: "#AAAAAA",
    fontSize: 14,
    fontWeight: "600",
  },
});
