import { Alert } from "@/components/ui/AppAlert";
import Feather from "@expo/vector-icons/Feather";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Contacts from "expo-contacts";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
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
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { PantallaConTeclado } from "@/components/ui/PantallaConTeclado";

import {
    createContactoConGrupos,
    deleteContacto,
    deleteContactos,
    getContactos,
    updateContactoConGrupos,
} from "@/lib/api/contactos";
import { createGrupo, deleteGrupo, getGrupos } from "@/lib/api/grupos";

const INTERVALO_REFRESCO_AGENDA_MS = 8000;
const ALFABETO = "#ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const formatearTelefono = (text: string) => {
  let cleaned = text.replace(/[^\d+]/g, "");
  if (cleaned === "" || cleaned === "+") return cleaned;
  let digits = cleaned.replace(/^\+?56/, "").replace(/\D/g, "");
  if (
    cleaned.length <= 3 &&
    !cleaned.includes("56") &&
    cleaned.startsWith("+")
  ) {
    return cleaned;
  }
  let result = "+56";
  if (digits.length > 0) result += " " + digits.substring(0, 1);
  if (digits.length > 1) result += " " + digits.substring(1, 5);
  if (digits.length > 5) result += " " + digits.substring(5, 9);
  return result;
};

export default function AgendaScreen() {
  "use no memo";
  const queryClient = useQueryClient();

  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoNumero, setNuevoNumero] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [menuGruposVisible, setMenuGruposVisible] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [nuevoNombreGrupo, setNuevoNombreGrupo] = useState("");
  const [modalEditarVisible, setModalEditarVisible] = useState(false);
  const [contactoEditando, setContactoEditando] = useState<any>(null);
  const [mostrarSelectorGrupos, setMostrarSelectorGrupos] = useState(false);
  const [menuOpcionesVisible, setMenuOpcionesVisible] = useState(false);
  const [modoSeleccion, setModoSeleccion] = useState(false);
  const [gruposSeleccionados, setGruposSeleccionados] = useState<string[]>([]);
  const [contactosSeleccionados, setContactosSeleccionados] = useState<
    string[]
  >([]);

  // --- QUERIES ---
  const { data: contactos = [] } = useQuery({
    queryKey: ["contactos"],
    queryFn: getContactos,
  });

  const { data: grupos = [] } = useQuery({
    queryKey: ["grupos"],
    queryFn: getGrupos,
  });

  useFocusEffect(
    useCallback(() => {
      const refrescarAgenda = () => {
        queryClient.invalidateQueries({ queryKey: ["contactos"] });
        queryClient.invalidateQueries({ queryKey: ["contactos-invitar"] });
        queryClient.invalidateQueries({ queryKey: ["grupos"] });
      };

      refrescarAgenda();

      const intervalo = setInterval(
        refrescarAgenda,
        INTERVALO_REFRESCO_AGENDA_MS,
      );

      return () => clearInterval(intervalo);
    }, [queryClient]),
  );

  // --- MUTATIONS ---
  const crearContactoMutation = useMutation({
    mutationFn: ({
      nombre,
      numero,
      gruposIds,
    }: {
      nombre: string;
      numero: string;
      gruposIds: string[];
    }) => createContactoConGrupos(nombre, numero, gruposIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      setNuevoNombre("");
      setNuevoNumero("");
      setGruposSeleccionados([]);
    },
    onError: (error) => {
      Alert.alert("Error", "No se pudo guardar el contacto.");
    },
  });

  const actualizarContactoMutation = useMutation({
    mutationFn: ({
      id,
      nombre,
      numero,
      gruposIds,
    }: {
      id: string;
      nombre: string;
      numero: string;
      gruposIds: string[];
    }) => updateContactoConGrupos(id, nombre, numero, gruposIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      setModalEditarVisible(false);
    },
    onError: (error) => {
      Alert.alert("Error", "No se pudieron guardar los cambios.");
    },
  });

  const borrarContactoMutation = useMutation({
    mutationFn: deleteContacto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      setModalEditarVisible(false);
    },
  });

  const borrarContactosMutation = useMutation({
    mutationFn: deleteContactos,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contactos"] });
      setModoSeleccion(false);
      setContactosSeleccionados([]);
    },
  });

  const crearGrupoMutation = useMutation({
    mutationFn: createGrupo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grupos"] });
      setNuevoNombreGrupo("");
      setIsCreatingGroup(false);
    },
    onError: (error) => {},
  });

  const borrarGrupoMutation = useMutation({
    mutationFn: deleteGrupo,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["grupos"] }),
  });

  // --- HANDLERS ---
  const toggleGrupoSeleccionado = (id: string) => {
    setGruposSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id],
    );
  };

  const agregarContacto = () => {
    if (nuevoNombre.trim() === "") return;
    crearContactoMutation.mutate({
      nombre: nuevoNombre.trim(),
      numero: nuevoNumero,
      gruposIds: gruposSeleccionados,
    });
  };

  const guardarNuevoGrupo = () => {
    const nombreLimpio = nuevoNombreGrupo.trim();
    if (nombreLimpio === "") return setIsCreatingGroup(false);
    crearGrupoMutation.mutate(nombreLimpio);
  };

  const confirmarBorradoGrupo = (id: string, nombre: string) => {
    Alert.alert("Eliminar Grupo", `¿Deseas eliminar el grupo "${nombre}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => borrarGrupoMutation.mutate(id),
      },
    ]);
  };

  const abrirModalEditar = (contacto: any) => {
    setContactoEditando({
      ...contacto,
      gruposAsignados: contacto.gruposAsignados || [],
    });
    setMostrarSelectorGrupos(false);
    setModalEditarVisible(true);
  };

  const guardarEdicionContacto = () => {
    const gruposIds = contactoEditando.gruposAsignados.map((g: any) => g.id);
    actualizarContactoMutation.mutate({
      id: contactoEditando.id,
      nombre: contactoEditando.nombre,
      numero: contactoEditando.telefono || "",
      gruposIds,
    });
  };

  const confirmarBorradoContacto = () => {
    Alert.alert(
      "Eliminar Contacto",
      `¿Deseas eliminar a ${contactoEditando.nombre}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => borrarContactoMutation.mutate(contactoEditando.id),
        },
      ],
    );
  };

  const removerGrupoDeContacto = (grupoId: string) => {
    setContactoEditando({
      ...contactoEditando,
      gruposAsignados: contactoEditando.gruposAsignados.filter(
        (g: any) => g.id !== grupoId,
      ),
    });
  };

  const agregarGrupoAContacto = (grupo: any) => {
    setContactoEditando({
      ...contactoEditando,
      gruposAsignados: [...contactoEditando.gruposAsignados, grupo],
    });
    setMostrarSelectorGrupos(false);
  };

  const toggleSeleccionContacto = (id: string) => {
    setContactosSeleccionados((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    );
  };

  const borrarContactosSeleccionados = () => {
    if (contactosSeleccionados.length === 0) return setModoSeleccion(false);
    Alert.alert(
      "Borrar Contactos",
      `¿Estás seguro de borrar ${contactosSeleccionados.length} contactos?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => borrarContactosMutation.mutate(contactosSeleccionados),
        },
      ],
    );
  };

  const importarContactosNativos = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Aviso", "Permiso denegado para leer contactos.");
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
    });
    if (data.length === 0) {
      Alert.alert("Aviso", "No hay contactos en este teléfono.");
      return;
    }

    const telefonosExistentes = new Set(contactos.map((c: any) => c.telefono));
    const nuevos = data.filter((c) => {
      const tel = c.phoneNumbers?.[0]?.number?.replace(/\s/g, "");
      return c.name && tel && !telefonosExistentes.has(tel);
    });

    if (nuevos.length === 0) {
      Alert.alert(
        "Aviso",
        "Todos los contactos del teléfono ya están en tu agenda.",
      );
      return;
    }

    Alert.alert(
      "Importar Contactos",
      `Se importarán ${nuevos.length} contactos nuevos.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Importar",
          onPress: async () => {
            for (const c of nuevos) {
              const tel = c.phoneNumbers?.[0]?.number?.replace(/\s/g, "") || "";
              await createContactoConGrupos(c.name!, tel, []);
            }
            queryClient.invalidateQueries({ queryKey: ["contactos"] });
            Alert.alert("Listo", `${nuevos.length} contactos importados.`);
          },
        },
      ],
    );
  };

  const confirmarImportacion = () => {
    Alert.alert(
      "Importar Contactos",
      "¿Deseas sincronizar los contactos de tu teléfono con la agenda?",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Sí, importar", onPress: importarContactosNativos },
      ],
    );
  };

  const contactosFiltrados = contactos.filter((c: any) =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()),
  );

  const gruposDisponibles = grupos.filter(
    (g) =>
      !contactoEditando?.gruposAsignados?.some((cg: any) => cg.id === g.id),
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <PantallaConTeclado style={styles.container}>
          <View style={styles.formCard}>
            {/* ENCABEZADO */}
            <View style={styles.headerForm}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.title}>Agenda</Text>
                <Text style={styles.subtitle}>
                  agregar contactos para gestionar y compartir eventos
                </Text>
              </View>
              <View style={styles.iconCircle}>
                <Feather name="hash" size={28} color="#FFFFFF" />
              </View>
            </View>

            {/* FILA AGREGAR CONTACTO */}
            <View style={styles.addRow}>
              <TouchableOpacity style={styles.addBtn} onPress={agregarContacto}>
                <Feather name="plus" size={18} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.miniInputContainer}>
                <Feather
                  name="user"
                  size={12}
                  color="#AAAAAA"
                  style={styles.miniIcon}
                />
                <TextInput
                  style={styles.miniInput}
                  placeholder="Nombre"
                  placeholderTextColor="#666666"
                  value={nuevoNombre}
                  onChangeText={setNuevoNombre}
                />
              </View>
              <View style={styles.miniInputContainer}>
                <Feather
                  name="phone"
                  size={12}
                  color="#AAAAAA"
                  style={styles.miniIcon}
                />
                <TextInput
                  style={styles.miniInput}
                  placeholder="Número"
                  placeholderTextColor="#666666"
                  keyboardType="phone-pad"
                  value={nuevoNumero}
                  onChangeText={(text) =>
                    setNuevoNumero(formatearTelefono(text))
                  }
                  maxLength={15}
                />
              </View>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => setMenuGruposVisible(true)}
              >
                <Feather name="users" size={14} color="#AAAAAA" />
              </TouchableOpacity>
            </View>

            {/* BARRA BÚSQUEDA / MODO SELECCIÓN */}
            {modoSeleccion ? (
              <View style={styles.selectionModeRow}>
                <TouchableOpacity
                  style={styles.cancelSelectionBtn}
                  onPress={() => {
                    setModoSeleccion(false);
                    setContactosSeleccionados([]);
                  }}
                >
                  <Text style={styles.cancelSelectionText}>Cancelar</Text>
                </TouchableOpacity>
                <Text style={styles.selectionCountText}>
                  {contactosSeleccionados.length} seleccionados
                </Text>
                <TouchableOpacity
                  style={styles.deleteSelectionBtn}
                  onPress={borrarContactosSeleccionados}
                >
                  <Feather name="trash-2" size={20} color="#FF5555" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.searchRow}>
                <View style={styles.searchInputContainer}>
                  <Feather
                    name="search"
                    size={18}
                    color="#AAAAAA"
                    style={styles.searchIcon}
                  />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar"
                    placeholderTextColor="#666666"
                    value={busqueda}
                    onChangeText={setBusqueda}
                  />
                </View>
                <TouchableOpacity style={styles.filterBtn}>
                  <Feather name="filter" size={20} color="#AAAAAA" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => setMenuOpcionesVisible(true)}
                >
                  <Feather name="more-vertical" size={16} color="#AAAAAA" />
                </TouchableOpacity>
              </View>
            )}

            {/* LISTA + ÍNDICE A-Z */}
            <View style={styles.listAndIndexContainer}>
              <View style={styles.contactsColumn}>
                {contactosFiltrados.map((contacto: any) => (
                  <View key={contacto.id} style={styles.contactRow}>
                    <View style={styles.contactInfo}>
                      {modoSeleccion && (
                        <TouchableOpacity
                          style={styles.multiSelectCheckbox}
                          onPress={() => toggleSeleccionContacto(contacto.id)}
                        >
                          {contactosSeleccionados.includes(contacto.id) && (
                            <Feather name="check" size={14} color="#FFFFFF" />
                          )}
                        </TouchableOpacity>
                      )}
                      <View style={styles.contactAvatar} />
                      <View style={styles.contactTextContainer}>
                        <View style={styles.contactNameRow}>
                          <Text style={styles.contactName}>
                            {contacto.nombre}
                          </Text>
                          {contacto.gruposAsignados?.length > 0 && (
                            <View style={styles.miniTagsContainer}>
                              {contacto.gruposAsignados.map((grupo: any) => (
                                <View key={grupo.id} style={styles.miniTag}>
                                  <Text style={styles.miniTagText}>
                                    {grupo.nombre}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                        {contacto.telefono ? (
                          <Text style={styles.contactPhone}>
                            {contacto.telefono}
                          </Text>
                        ) : (
                          <Text style={styles.contactPhoneEmpty}>
                            número (opcional)
                          </Text>
                        )}
                      </View>
                    </View>
                    {!modoSeleccion && (
                      <TouchableOpacity
                        style={styles.editBtn}
                        onPress={() => abrirModalEditar(contacto)}
                      >
                        <Feather name="edit-2" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
              <View style={styles.indexColumn}>
                {ALFABETO.map((letra) => (
                  <Text key={letra} style={styles.indexLetter}>
                    {letra}
                  </Text>
                ))}
              </View>
            </View>
          </View>
      </PantallaConTeclado>

      {/* MODAL GRUPOS */}
      <Modal visible={menuGruposVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            setMenuGruposVisible(false);
            setIsCreatingGroup(false);
          }}
        >
          <TouchableOpacity activeOpacity={1} style={styles.groupDropdown}>
            <TouchableOpacity
              style={styles.createGroupRow}
              onPress={() => setIsCreatingGroup(true)}
            >
              <Text style={styles.createGroupText}>Crear Grupo</Text>
            </TouchableOpacity>
            <View style={styles.groupDivider} />
            {isCreatingGroup && (
              <View style={styles.groupRowContainer}>
                <View style={[styles.groupCheckRow, { paddingVertical: 0 }]}>
                  <View style={styles.checkbox} />
                  <TextInput
                    style={styles.inlineInput}
                    value={nuevoNombreGrupo}
                    onChangeText={setNuevoNombreGrupo}
                    placeholder="Nombre..."
                    placeholderTextColor="#666666"
                    autoFocus
                    onSubmitEditing={guardarNuevoGrupo}
                  />
                </View>
                <TouchableOpacity
                  style={styles.deleteGroupBtn}
                  onPress={guardarNuevoGrupo}
                >
                  <Feather name="check" size={18} color="#4CAF50" />
                </TouchableOpacity>
              </View>
            )}
            {grupos.map((grupo: any) => (
              <View key={grupo.id} style={styles.groupRowContainer}>
                <TouchableOpacity
                  style={styles.groupCheckRow}
                  onPress={() => toggleGrupoSeleccionado(grupo.id)}
                >
                  <View style={styles.checkbox}>
                    {gruposSeleccionados.includes(grupo.id) && (
                      <Feather name="check" size={12} color="#FFFFFF" />
                    )}
                  </View>
                  <Text style={styles.groupText}>{grupo.nombre}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteGroupBtn}
                  onPress={() => confirmarBorradoGrupo(grupo.id, grupo.nombre)}
                >
                  <Feather name="trash-2" size={16} color="#FF5555" />
                </TouchableOpacity>
              </View>
            ))}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* MODAL EDITAR CONTACTO */}
      <Modal visible={modalEditarVisible} transparent animationType="slide">
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setModalEditarVisible(false)}
          />
          <View style={styles.editContactCard}>
            <View style={styles.editHeader}>
              <Text style={styles.editTitle}>Editar Contacto</Text>
              <TouchableOpacity onPress={confirmarBorradoContacto}>
                <Feather name="trash-2" size={20} color="#FF5555" />
              </TouchableOpacity>
            </View>
            {contactoEditando && (
              <>
                <View style={styles.editInputGroup}>
                  <Feather
                    name="user"
                    size={16}
                    color="#AAAAAA"
                    style={styles.editIcon}
                  />
                  <TextInput
                    style={styles.editInput}
                    value={contactoEditando.nombre}
                    onChangeText={(text) =>
                      setContactoEditando({ ...contactoEditando, nombre: text })
                    }
                    placeholder="Nombre"
                    placeholderTextColor="#666666"
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
                    value={contactoEditando.telefono}
                    onChangeText={(text) =>
                      setContactoEditando({
                        ...contactoEditando,
                        telefono: formatearTelefono(text),
                      })
                    }
                    placeholder="Número (opcional)"
                    placeholderTextColor="#666666"
                    keyboardType="phone-pad"
                    maxLength={15}
                  />
                </View>
                <Text style={styles.groupsLabel}>Grupos asignados:</Text>
                <View style={styles.tagsContainer}>
                  {contactoEditando.gruposAsignados.map((grupo: any) => (
                    <View key={grupo.id} style={styles.groupTag}>
                      <Text style={styles.groupTagText}>{grupo.nombre}</Text>
                      <TouchableOpacity
                        style={styles.groupTagRemove}
                        onPress={() => removerGrupoDeContacto(grupo.id)}
                      >
                        <Feather name="x" size={12} color="#FFFFFF" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.addGroupTagBtn}
                    onPress={() =>
                      setMostrarSelectorGrupos(!mostrarSelectorGrupos)
                    }
                  >
                    <Feather
                      name={mostrarSelectorGrupos ? "minus" : "plus"}
                      size={14}
                      color="#AAAAAA"
                    />
                  </TouchableOpacity>
                </View>
                {mostrarSelectorGrupos && (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={styles.availableGroupsScroll}
                  >
                    {gruposDisponibles.length === 0 ? (
                      <Text style={styles.noMoreGroupsText}>
                        No hay más grupos disponibles.
                      </Text>
                    ) : (
                      gruposDisponibles.map((grupo: any) => (
                        <TouchableOpacity
                          key={grupo.id}
                          style={styles.availableGroupBadge}
                          onPress={() => agregarGrupoAContacto(grupo)}
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
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={guardarEdicionContacto}
                >
                  <Text style={styles.saveBtnText}>Guardar Cambios</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL OPCIONES */}
      <Modal visible={menuOpcionesVisible} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setMenuOpcionesVisible(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.optionsDropdown}>
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                setModoSeleccion(true);
                setMenuOpcionesVisible(false);
              }}
            >
              <Feather
                name="check-square"
                size={16}
                color="#FFFFFF"
                style={styles.optionsIcon}
              />
              <Text style={styles.optionsText}>Seleccionar varios</Text>
            </TouchableOpacity>
            <View style={styles.groupDivider} />
            <TouchableOpacity
              style={styles.optionsRow}
              onPress={() => {
                setMenuOpcionesVisible(false);
                setTimeout(() => confirmarImportacion(), 300);
              }}
            >
              <Feather
                name="download"
                size={16}
                color="#FFFFFF"
                style={styles.optionsIcon}
              />
              <Text style={styles.optionsText}>Importar contactos</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  container: { flex: 1, justifyContent: "center", padding: 20 },
  formCard: {
    backgroundColor: "rgba(25, 25, 25, 0.5)",
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginTop: 20,
    marginBottom: 40,
  },
  headerForm: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
  },
  headerTextContainer: { flex: 1, paddingRight: 15 },
  title: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
  },
  subtitle: { color: "#AAAAAA", fontSize: 14 },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 20,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  miniInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    height: 38,
  },
  miniIcon: { marginRight: 5 },
  miniInput: { flex: 1, color: "#FFFFFF", fontSize: 12 },
  actionBtn: {
    width: 32,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: "#FFFFFF", fontSize: 14 },
  filterBtn: {
    width: 40,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  listAndIndexContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(0, 0, 0, 0.3)",
    borderRadius: 15,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  contactsColumn: { flex: 1, paddingRight: 10 },
  contactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  contactInfo: { flexDirection: "row", alignItems: "center", flex: 1 },
  contactAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    marginRight: 12,
  },
  contactName: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  contactPhone: { color: "#AAAAAA", fontSize: 11, marginTop: 2 },
  contactPhoneEmpty: {
    color: "#666666",
    fontSize: 11,
    marginTop: 2,
    fontStyle: "italic",
  },
  editBtn: { padding: 5 },
  indexColumn: {
    width: 20,
    alignItems: "center",
    justifyContent: "space-between",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255, 255, 255, 0.1)",
  },
  indexLetter: { color: "#AAAAAA", fontSize: 9, marginVertical: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  groupDropdown: {
    width: 200,
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    position: "absolute",
    top: 220,
    right: 40,
  },
  createGroupRow: { paddingVertical: 8 },
  createGroupText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  groupDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    marginVertical: 10,
  },
  groupCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    flex: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#AAAAAA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  groupText: { color: "#CCCCCC", fontSize: 14 },
  groupRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  deleteGroupBtn: { padding: 5 },
  inlineInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#4CAF50",
    paddingHorizontal: 5,
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
    marginBottom: 25,
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
    backgroundColor: "rgba(0, 0, 0, 0.3)",
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
  saveBtn: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#000000", fontSize: 15, fontWeight: "bold" },
  availableGroupsScroll: { marginBottom: 25, maxHeight: 40 },
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
  contactTextContainer: { flex: 1 },
  contactNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
  },
  miniTagsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexWrap: "wrap",
  },
  miniTag: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  miniTagText: { color: "#CCCCCC", fontSize: 9, fontWeight: "500" },
  optionsDropdown: {
    width: 200,
    backgroundColor: "rgba(20, 20, 20, 0.95)",
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    position: "absolute",
    top: 220,
    right: 20,
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  optionsIcon: { marginRight: 12 },
  optionsText: { color: "#FFFFFF", fontSize: 14, fontWeight: "500" },
  multiSelectCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#AAAAAA",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 15,
    backgroundColor: "transparent",
  },
  selectionModeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 45,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cancelSelectionBtn: { paddingVertical: 5, paddingHorizontal: 10 },
  cancelSelectionText: { color: "#AAAAAA", fontSize: 14 },
  selectionCountText: { color: "#FFFFFF", fontSize: 14, fontWeight: "bold" },
  deleteSelectionBtn: { padding: 5 },
});
