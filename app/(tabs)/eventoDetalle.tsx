// 1. React & React Native
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 2. Librerías de terceros (Expo, TanStack, etc.)
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import Feather from "@expo/vector-icons/Feather";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// 3. Componentes UI internos
import { Alert } from "@/components/ui/AppAlert";
import GlassCard from "@/components/ui/GlassCard";

// 4. APIs, Servicios y Utilidades internas (@/lib y @/services)
import { supabase } from "@/lib/supabase";
import type { Deuda } from "@/lib/balances";
import { useBalancesEvento } from "@/lib/realtime/useBalancesEvento";

import { getContactosParaInvitar } from "@/lib/api/contactos";
import {
  actualizarEstadoEvento,
  deleteEvento,
  eliminarParticipanteDelEvento,
  getEvento,
  invitarContactoAlEvento,
  obtenerAttendeesParaCalendar,
  updateEventoBasico,
} from "@/lib/api/eventos";
import {
  agregarComprobanteGasto,
  borrarGasto,
  getGastosConPagador,
  obtenerComprobantesGasto,
  obtenerParticipantesEvento,
} from "@/lib/api/gastos";
import {
  enviarRecordatorioManual,
  obtenerNotificacionesEvento,
} from "@/lib/api/notificaciones";
import {
  confirmarPago,
  devolverPagoAPendiente,
  obtenerPagosEvento,
  obtenerPagosReportadosEvento,
  reportarPago,
} from "@/lib/api/pagos";
import { obtenerGoogleToken } from "@/lib/api/usuarios";

import {
  actualizarEventoCalendar,
  crearEventoCalendar,
  eliminarEventoCalendar,
} from "@/services/googleCalendar";

const formatearFecha = (fechaString: string) => {
  if (!fechaString) return "";
  return new Date(fechaString).toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatearMonto = (monto: number) => `$${monto.toLocaleString("es-CL")}`;

type Tab = "gastos" | "balances" | "participantes" | "feed";
type AvisoPago = {
  titulo: string;
  mensaje: string;
  icono: any;
  color: string;
};
type DatosBancarios = {
  banco: string;
  tipo_cuenta: string;
  numero_cuenta: string;
  rut: string;
};

export default function EventoDetalleScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const insets = useSafeAreaInsets();
  const [tabActivo, setTabActivo] = useState<Tab>("gastos");
  const [modalReporteVisible, setModalReporteVisible] = useState(false);
  const [modalConfirmacionVisible, setModalConfirmacionVisible] =
    useState(false);
  const [deudaSeleccionada, setDeudaSeleccionada] = useState<Deuda | null>(
    null,
  );
  const [comprobante, setComprobante] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [pagosReportados, setPagosReportados] = useState<any[]>([]);
  const [cargandoPagosReportados, setCargandoPagosReportados] = useState(false);
  const [modalBoletasVisible, setModalBoletasVisible] = useState(false);
  const [gastoBoletas, setGastoBoletas] = useState<any | null>(null);
  const [boletasGasto, setBoletasGasto] = useState<any[]>([]);
  const [cargandoBoletas, setCargandoBoletas] = useState(false);
  const [modalOpcionesGastoVisible, setModalOpcionesGastoVisible] =
    useState(false);
  const [gastoSeleccionado, setGastoSeleccionado] = useState<any | null>(null);
  const [avisoPago, setAvisoPago] = useState<AvisoPago | null>(null);
  const [modalInvitarVisible, setModalInvitarVisible] = useState(false);
  const [modalEditarEventoVisible, setModalEditarEventoVisible] =
    useState(false);
  const [participanteBancarioSeleccionado, setParticipanteBancarioSeleccionado] =
    useState<any | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editUbicacion, setEditUbicacion] = useState("");
  const [editFecha, setEditFecha] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editModoFecha, setEditModoFecha] = useState<"date" | "time">("date");
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

  const { data: contactosInvitar = [], isLoading: loadingContactosInvitar } =
    useQuery({
      queryKey: ["contactos-invitar"],
      queryFn: getContactosParaInvitar,
      enabled: modalInvitarVisible,
    });

  const { balances, deudas, detalleParticipantes } =
    useBalancesEvento(eventoId);

  const { data: pagosEvento = [], isLoading: loadingPagosEvento } = useQuery({
    queryKey: ["pagos", eventoId],
    queryFn: () => obtenerPagosEvento(eventoId),
    enabled: Boolean(eventoId),
  });

  const { data: feedEvento = [], isLoading: loadingFeedEvento } = useQuery({
    queryKey: ["notificaciones-evento", eventoId],
    queryFn: () => obtenerNotificacionesEvento(eventoId, 40),
    enabled: Boolean(eventoId),
  });

  const { data: usuarioActualId } = useQuery({
    queryKey: ["usuario-actual-id"],
    queryFn: async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) throw error;
      return user?.id ?? null;
    },
  });

  const obtenerNombreContacto = (contacto: any, fallback = "Participante") => {
    if (!contacto) return fallback;
    if (Array.isArray(contacto)) return contacto[0]?.nombre ?? fallback;
    return contacto.nombre ?? fallback;
  };

  const yaEstaInvitado = (contactoId: string) =>
    evento?.participantes_evento?.some(
      (p: any) => p.contacto_id === contactoId,
    );
  const yaEsParticipante = (contactoId: string) =>
    participantes.some((p: any) => p.contacto_id === contactoId);

  const participantesPorId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const participante of participantes as any[]) {
      const nombre = obtenerNombreContacto(participante["contactos"]);
      mapa.set(participante["contacto_id"], nombre);
    }
    return mapa;
  }, [participantes]);

  const usuariosPorContactoId = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const participante of participantes as any[]) {
      const contacto = Array.isArray(participante["contactos"])
        ? participante["contactos"][0]
        : participante["contactos"];
      const usuarioId = contacto?.referencia_usuario_id;

      if (usuarioId) {
        mapa.set(participante["contacto_id"], usuarioId);
      }
    }

    return mapa;
  }, [participantes]);

  const pagosNoPendientesPorDeuda = useMemo(() => {
    const claves = new Set<string>();

    for (const pago of pagosEvento as any[]) {
      if (pago.estado === "pendiente") continue;

      claves.add(
        `${pago.deudor_id}-${pago.acreedor_id}-${Number(pago.monto).toFixed(2)}`,
      );
    }

    return claves;
  }, [pagosEvento]);

  //Calcular contacto del usuario actual y su resumen
  const miContactoId = useMemo(() => {
    const participante = participantes.find(
      (p: any) => p.contactos?.referencia_usuario_id === usuarioActualId,
    );
    return participante?.contacto_id;
  }, [participantes, usuarioActualId]);

  const miResumen = useMemo(() => {
    if (!miContactoId || !balances) return { debe: 0, leDeben: 0 };

    const miBalance =
      balances.find((b) => b.contactoId === miContactoId)?.balance || 0;

    return {
      debe: miBalance < 0 ? Math.abs(miBalance) : 0,
      leDeben: miBalance > 0 ? miBalance : 0,
    };
  }, [balances, miContactoId]);

  //Lógica de deudas del usuario
  const deudasDelUsuario = useMemo(
    () =>
      deudas.filter((deuda) => {
        // deudorId del usuario actual
        const esDeudaDelUsuario =
          usuariosPorContactoId.get(deuda.deudorId) === usuarioActualId;

        // deudorId del usuario actual no es el acreedor
        const contactoDeudorId = usuariosPorContactoId.get(deuda.deudorId);
        const esInvitado = !contactoDeudorId;
        const soyOrganizador = evento?.creador_id === usuarioActualId;

        const puedePagar = esDeudaDelUsuario || (esInvitado && soyOrganizador);

        const claveDeuda = `${deuda.deudorId}-${deuda.acreedorId}-${Number(
          deuda.monto,
        ).toFixed(2)}`;

        return puedePagar && !pagosNoPendientesPorDeuda.has(claveDeuda);
      }),
    [
      deudas,
      pagosNoPendientesPorDeuda,
      usuarioActualId,
      usuariosPorContactoId,
      evento,
      participantes,
    ],
  );

  const esCreador = evento?.creador_id === usuarioActualId;

  const actualizarEstadoMutation = useMutation({
    mutationFn: (estado: "abierto" | "finalizado") =>
      actualizarEstadoEvento(eventoId, estado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.message ?? "No se pudo actualizar el estado del evento.",
      );
    },
  });

  const actualizarEventoMutation = useMutation({
    mutationFn: async () => {
      const datos = {
        titulo: editNombre.trim(),
        descripcion: editDescripcion.trim(),
        ubicacion: editUbicacion.trim(),
        fechaEvento: editFecha.toISOString(),
      };
      if (evento?.google_event_id) {
        const accessToken = await obtenerGoogleToken();
        if (accessToken) {
          const { attendees } = await obtenerAttendeesParaCalendar(
            evento?.participantes_evento ?? [],
            evento?.creador_id,
          );
          await actualizarEventoCalendar(accessToken, evento.google_event_id, {
            titulo: datos.titulo,
            descripcion: datos.descripcion,
            fechaInicio: datos.fechaEvento,
            fechaFin: datos.fechaEvento,
            attendees,
          });
        }
      }
      return updateEventoBasico(eventoId, datos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      setModalEditarEventoVisible(false);
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.message ?? "No se pudo actualizar el evento.",
      );
    },
  });

  const invitarParticipanteMutation = useMutation({
    mutationFn: (contactoId: string) =>
      invitarContactoAlEvento(eventoId, contactoId),
    onSuccess: async () => {
      // Traemos el evento actualizado (con el nuevo participante ya incluido)
      // para poder sincronizar la lista completa de invitados con Calendar.
      let eventoActualizado: any = null;
      try {
        eventoActualizado = await getEvento(eventoId);
      } catch (e) {
        console.log("No se pudo refrescar el evento tras invitar:", e);
      }

      if (eventoActualizado?.google_event_id) {
        try {
          const accessToken = await obtenerGoogleToken();
          if (accessToken) {
            const { attendees } = await obtenerAttendeesParaCalendar(
              eventoActualizado?.participantes_evento ?? [],
              eventoActualizado?.creador_id,
            );
            await actualizarEventoCalendar(
              accessToken,
              eventoActualizado.google_event_id,
              {
                titulo: eventoActualizado.titulo,
                descripcion: eventoActualizado.descripcion,
                fechaInicio: eventoActualizado.fecha_evento,
                fechaFin: eventoActualizado.fecha_evento,
                attendees,
              },
            );
          }
        } catch (e) {
          console.log("Error al sincronizar invitado con Calendar:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["participantes", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error: any) => {
      Alert.alert("Error", error?.message ?? "No se pudo invitar al contacto.");
    },
  });

  const eliminarParticipanteMutation = useMutation({
    mutationFn: (contactoId: string) =>
      eliminarParticipanteDelEvento(eventoId, contactoId),
    onSuccess: async () => {
      // Traemos el evento actualizado (ya sin el participante quitado)
      // para poder sincronizar la lista completa de invitados con Calendar.
      let eventoActualizado: any = null;
      try {
        eventoActualizado = await getEvento(eventoId);
      } catch (e) {
        console.log("No se pudo refrescar el evento tras quitar participante:", e);
      }

      if (eventoActualizado?.google_event_id) {
        try {
          const accessToken = await obtenerGoogleToken();
          if (accessToken) {
            const { attendees } = await obtenerAttendeesParaCalendar(
              eventoActualizado?.participantes_evento ?? [],
              eventoActualizado?.creador_id,
            );
            await actualizarEventoCalendar(
              accessToken,
              eventoActualizado.google_event_id,
              {
                titulo: eventoActualizado.titulo,
                descripcion: eventoActualizado.descripcion,
                fechaInicio: eventoActualizado.fecha_evento,
                fechaFin: eventoActualizado.fecha_evento,
                attendees,
              },
            );
          }
        } catch (e) {
          console.log("Error al sincronizar participante quitado con Calendar:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["participantes", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
    },
    onError: (error: any) => {
      Alert.alert(
        "Error",
        error?.message ?? "No se pudo quitar al participante.",
      );
    },
  });

  const abrirModalEditarEvento = () => {
    if (!evento) return;
    setEditNombre(evento.titulo ?? "");
    setEditDescripcion(evento.descripcion ?? "");
    setEditUbicacion(evento.ubicacion ?? "");
    setEditFecha(evento.fecha_evento ? new Date(evento.fecha_evento) : new Date());
    setModalEditarEventoVisible(true);
  };

  const cerrarModalEditarEvento = () => {
    setModalEditarEventoVisible(false);
  };

  const confirmarQuitarParticipante = (contactoId: string, nombre: string) => {
    Alert.alert("Quitar participante", `¿Quitar a ${nombre} del evento?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: () => eliminarParticipanteMutation.mutate(contactoId),
      },
    ]);
  };

  const confirmarCambioEstado = () => {
    const finalizando = evento?.estado !== "finalizado";
    Alert.alert(
      finalizando ? "Finalizar evento" : "Reabrir evento",
      finalizando
        ? "¿Quieres marcar este evento como finalizado? Podrás reabrirlo después si lo necesitas."
        : "¿Quieres reabrir este evento?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: finalizando ? "Finalizar" : "Reabrir",
          onPress: () =>
            actualizarEstadoMutation.mutate(
              finalizando ? "finalizado" : "abierto",
            ),
        },
      ],
    );
  };

  const cerrarModalReporte = () => {
    setModalReporteVisible(false);
    setDeudaSeleccionada(null);
    setComprobante(null);
  };

  const cerrarModalBoletas = () => {
    setModalBoletasVisible(false);
    setGastoBoletas(null);
    setBoletasGasto([]);
  };

  const cerrarModalOpcionesGasto = () => {
    setModalOpcionesGastoVisible(false);
    setGastoSeleccionado(null);
  };

  const cerrarModalDatosBancarios = () => {
    setParticipanteBancarioSeleccionado(null);
  };

  const mostrarAvisoPago = (
    titulo: string,
    mensaje: string,
    icono: any = "info",
    color = "#FFFFFF",
  ) => {
    setAvisoPago({ titulo, mensaje, icono, color });
  };

  const abrirModalReporte = () => {
    if (!usuarioActualId) {
      mostrarAvisoPago(
        "Un momento",
        "Aun estamos preparando tus datos.",
        "clock",
      );
      return;
    }

    if (loadingPagosEvento) {
      mostrarAvisoPago(
        "Un momento",
        "Estamos revisando tus pagos pendientes.",
        "loader",
      );
      return;
    }

    if (deudasDelUsuario.length === 0) {
      mostrarAvisoPago(
        "Sin deudas",
        "No tienes pagos pendientes por reportar en este evento.",
        "check-circle",
        "#4CAF50",
      );
      return;
    }

    setDeudaSeleccionada(deudasDelUsuario[0]);
    setComprobante(null);
    setModalReporteVisible(true);
  };

  const seleccionarComprobante = async () => {
    const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permisos.granted) {
      mostrarAvisoPago(
        "Permiso necesario",
        "Necesitamos acceso a tus fotos para adjuntar el comprobante.",
        "image",
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    if (!resultado.canceled) {
      setComprobante(resultado.assets[0]);
    }
  };

  const seleccionarBoletaGasto = async (gasto: any) => {
    const permisos = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permisos.granted) {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tus fotos para adjuntar la boleta.",
      );
      return;
    }

    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    if (resultado.canceled) return;

    agregarBoletaGastoMutation.mutate({
      gasto,
      comprobante: {
        uri: resultado.assets[0].uri,
        mimeType: resultado.assets[0].mimeType,
        fileName: resultado.assets[0].fileName,
      },
    });
  };

  const enviarReportePago = () => {
    if (!deudaSeleccionada) {
      mostrarAvisoPago(
        "Selecciona una deuda",
        "Elige que deuda quieres reportar.",
        "list",
      );
      return;
    }

    if (!comprobante) {
      mostrarAvisoPago(
        "Falta comprobante",
        "Agrega una imagen del comprobante antes de reportar.",
        "upload",
      );
      return;
    }

    reportarPagoMutation.mutate({
      eventoId,
      deudorId: deudaSeleccionada.deudorId,
      acreedorId: deudaSeleccionada.acreedorId,
      monto: deudaSeleccionada.monto,
      comprobante: {
        uri: comprobante.uri,
        mimeType: comprobante.mimeType,
        fileName: comprobante.fileName,
      },
    });
  };

  const cargarPagosReportados = async () => {
    if (!usuarioActualId) {
      mostrarAvisoPago(
        "Un momento",
        "Aun estamos preparando tus datos.",
        "clock",
      );
      return;
    }

    setCargandoPagosReportados(true);

    try {
      const pagos = await obtenerPagosReportadosEvento(eventoId);
      const pagosDelAcreedor = pagos.filter(
        (pago: any) =>
          usuariosPorContactoId.get(pago.acreedor_id) === usuarioActualId,
      );

      if (pagosDelAcreedor.length === 0) {
        setPagosReportados([]);
        mostrarAvisoPago(
          "No hay reportes",
          "No hay pagos reportados donde aparezcas como acreedor.",
          "inbox",
        );
        return;
      }

      setPagosReportados(pagosDelAcreedor);
      setModalConfirmacionVisible(true);
    } catch (err: any) {
      mostrarAvisoPago(
        "Error",
        err?.message ?? "No se pudo consultar pagos.",
        "alert-circle",
        "#FF6B6B",
      );
    } finally {
      setCargandoPagosReportados(false);
    }
  };

  const cargarBoletasGasto = async (gasto: any) => {
    setGastoBoletas(gasto);
    setCargandoBoletas(true);
    setModalBoletasVisible(true);

    try {
      const comprobantes = await obtenerComprobantesGasto(gasto.id);
      setBoletasGasto(comprobantes);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "No se pudieron cargar boletas.");
      cerrarModalBoletas();
    } finally {
      setCargandoBoletas(false);
    }
  };

  const abrirOpcionesGasto = (gasto: any) => {
    setGastoSeleccionado(gasto);
    setModalOpcionesGastoVisible(true);
  };

  const verBoletasGastoSeleccionado = () => {
    if (!gastoSeleccionado) return;

    const gasto = gastoSeleccionado;
    cerrarModalOpcionesGasto();
    cargarBoletasGasto(gasto);
  };

  const agregarBoletaGastoSeleccionado = () => {
    if (!gastoSeleccionado) return;

    const gasto = gastoSeleccionado;
    cerrarModalOpcionesGasto();
    seleccionarBoletaGasto(gasto);
  };

  const copiarDatosBancarios = async () => {
    const datos = participanteBancarioSeleccionado?.datos_bancarios as
      | DatosBancarios
      | null
      | undefined;

    if (!datos) return;

    const nombre = obtenerNombreContacto(
      participanteBancarioSeleccionado.contactos,
    );
    const texto = [
      nombre,
      `Banco: ${datos.banco}`,
      `Tipo de cuenta: ${datos.tipo_cuenta}`,
      `Numero de cuenta: ${datos.numero_cuenta}`,
      `RUT: ${datos.rut}`,
    ].join("\n");

    await Clipboard.setStringAsync(texto);
    cerrarModalDatosBancarios();
    mostrarAvisoPago(
      "Copiado",
      "Los datos bancarios quedaron en el portapapeles.",
      "copy",
      "#4CAF50",
    );
  };

  const cerrarModalConfirmacion = () => {
    setModalConfirmacionVisible(false);
    setPagosReportados([]);
  };

  const borrarGastoMutation = useMutation({
    mutationFn: borrarGasto,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
      queryClient.invalidateQueries({
        queryKey: ["notificaciones-evento", eventoId],
      });
    },
    onError: (error: any) => {
      Alert.alert("No se pudo borrar", error?.message ?? "Intenta nuevamente.");
    },
  });

  const invitarMutation = useMutation({
    mutationFn: (contactoId: string) =>
      invitarContactoAlEvento(eventoId, contactoId),
    onSuccess: async () => {
      // Traemos el evento actualizado (con el nuevo participante ya incluido)
      // para poder sincronizar la lista completa de invitados con Calendar.
      let eventoActualizado: any = null;
      try {
        eventoActualizado = await getEvento(eventoId);
      } catch (e) {
        console.log("No se pudo refrescar el evento tras invitar:", e);
      }

      if (eventoActualizado?.google_event_id) {
        try {
          const accessToken = await obtenerGoogleToken();
          if (accessToken) {
            const { attendees } = await obtenerAttendeesParaCalendar(
              eventoActualizado?.participantes_evento ?? [],
              eventoActualizado?.creador_id,
            );
            await actualizarEventoCalendar(
              accessToken,
              eventoActualizado.google_event_id,
              {
                titulo: eventoActualizado.titulo,
                descripcion: eventoActualizado.descripcion,
                fechaInicio: eventoActualizado.fecha_evento,
                fechaFin: eventoActualizado.fecha_evento,
                attendees,
              },
            );
          }
        } catch (e) {
          console.log("Error al sincronizar invitado con Calendar:", e);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["participantes", eventoId] });
      setModalInvitarVisible(false);
      Alert.alert("¡Invitado!", "Contacto agregado al evento.");
    },
    onError: (error: any) =>
      Alert.alert("Error", error.message || "No se pudo invitar al contacto."),
  });

  const eliminarEventoMutation = useMutation({
    mutationFn: async () => {
      console.log("google_event_id:", evento?.google_event_id);
      console.log("evento completo:", evento);
      // Eliminar de Google Calendar si tiene google_event_id
      if (evento?.google_event_id) {
        const accessToken = await obtenerGoogleToken();
        console.log("accessToken:", accessToken);
        if (accessToken) {
          await eliminarEventoCalendar(accessToken, evento.google_event_id);
        }
      }
      return deleteEvento(eventoId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["eventos"] });
      router.back();
      Alert.alert("Eliminado", "El evento fue borrado.");
    },
    onError: () => Alert.alert("Error", "No se pudo eliminar el evento."),
  });

  const confirmarEliminar = () => {
    Alert.alert("¿Eliminar evento?", "Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: () => eliminarEventoMutation.mutate(),
      },
    ]);
  };

  const reportarPagoMutation = useMutation({
    mutationFn: ({ eventoId, deudorId, acreedorId, monto, comprobante }: any) =>
      reportarPago(eventoId, deudorId, acreedorId, monto, comprobante),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["balances", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["pagos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
      queryClient.invalidateQueries({
        queryKey: ["notificaciones-evento", eventoId],
      });
      cerrarModalReporte();
      mostrarAvisoPago(
        "Pago reportado",
        "El pago fue reportado correctamente.",
        "check-circle",
        "#4CAF50",
      );
    },
    onError: (error: any) => {
      mostrarAvisoPago(
        "No se pudo reportar",
        error?.message ?? "Intenta nuevamente.",
        "alert-circle",
        "#FF6B6B",
      );
    },
  });

  const agregarBoletaGastoMutation = useMutation({
    mutationFn: ({ gasto, comprobante }: any) =>
      agregarComprobanteGasto(gasto.id, comprobante),
    onSuccess: async (_data, variables: any) => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      Alert.alert("Boleta agregada", "La boleta quedó asociada al gasto.");

      if (modalBoletasVisible && gastoBoletas?.id === variables.gasto.id) {
        await cargarBoletasGasto(variables.gasto);
      }
    },
    onError: (error: any) => {
      Alert.alert(
        "No se pudo agregar",
        error?.message ?? "Intenta nuevamente.",
      );
    },
  });

  const agregarACalendar = async () => {
    try {
      const accessToken = await obtenerGoogleToken();

      if (!accessToken) {
        Alert.alert(
          "Conecta Google",
          "Ve a tu perfil y conecta Google Calendar primero.",
        );
        return;
      }

      const { attendees, sinEmail } = await obtenerAttendeesParaCalendar(
        evento?.participantes_evento ?? [],
        evento?.creador_id,
      );

      const resultado = await crearEventoCalendar(accessToken, {
        titulo: evento?.titulo ?? "Evento de prueba",
        descripcion: evento?.descripcion ?? "",
        fechaInicio: evento?.fecha_evento,
        fechaFin: evento?.fecha_evento,
        attendees,
      });

      if (resultado?.id) {
        const { error } = await supabase
          .from("eventos")
          .update({ google_event_id: resultado.id })
          .eq("id", eventoId);

        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["evento", eventoId] });
        }
      }

      if (sinEmail.length > 0) {
        Alert.alert(
          "Agregado con aviso",
          `Evento agregado a Google Calendar. Estos participantes no tienen email y no recibieron invitación: ${sinEmail.join(", ")}`,
        );
      } else {
        Alert.alert(
          "¡Listo!",
          "Evento agregado a Google Calendar con invitaciones enviadas.",
        );
      }
    } catch (error) {
      console.log("Error:", error);
      Alert.alert("Error", "No se pudo agregar a Google Calendar.");
    }
  };

  const confirmarPagoMutation = useMutation({
    mutationFn: (pagoId: string) => confirmarPago(pagoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["balances", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["pagos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
      queryClient.invalidateQueries({
        queryKey: ["notificaciones-evento", eventoId],
      });
      cerrarModalConfirmacion();
      mostrarAvisoPago(
        "Pago confirmado",
        "El pago ha sido confirmado.",
        "check-circle",
        "#4CAF50",
      );
    },
    onError: (error: any) => {
      mostrarAvisoPago(
        "No se pudo confirmar",
        error?.message ?? "Intenta nuevamente.",
        "alert-circle",
        "#FF6B6B",
      );
    },
  });

  // Devolver pago a pendiente
  const devolverPagoMutation = useMutation({
    mutationFn: (pagoId: string) => devolverPagoAPendiente(pagoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["gastos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["total-gastos"] });
      queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] });
      queryClient.invalidateQueries({ queryKey: ["balances", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["pagos", eventoId] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones"] });
      queryClient.invalidateQueries({ queryKey: ["notificaciones-no-leidas"] });
      queryClient.invalidateQueries({
        queryKey: ["notificaciones-evento", eventoId],
      });
      cerrarModalConfirmacion();
      mostrarAvisoPago(
        "Pago devuelto",
        "El pago volvió al estado pendiente.",
        "rotate-ccw",
      );
    },
    onError: (error: any) => {
      mostrarAvisoPago(
        "No se pudo devolver",
        error?.message ?? "Intenta nuevamente.",
        "alert-circle",
        "#FF6B6B",
      );
    },
  });

  // Enviar recordatorio manual a un participante
  const enviarRecordatorioMutation = useMutation({
    mutationFn: ({ deudorId, monto }: { deudorId: string; monto: number }) =>
      enviarRecordatorioManual(eventoId, deudorId, monto),
    onSuccess: () => {
      mostrarAvisoPago(
        "Recordatorio enviado",
        "Se ha enviado una notificación al participante.",
        "bell",
        "#4CAF50",
      );
    },
    onError: (error: any) => {
      mostrarAvisoPago(
        "No se pudo enviar",
        error?.message ?? "Hubo un problema al enviar el recordatorio.",
        "alert-circle",
        "#FF6B6B",
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

  if (loadingEvento) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#FFFFFF" />
      </View>
    );
  }

  const obtenerEstiloFeed = (tipo: string) => {
    switch (tipo) {
      case "gasto_creado":
        return {
          icon: "shopping-cart",
          color: "#EAB308",
          bg: "rgba(234, 179, 8, 0.15)",
        }; // Amarillo
      case "pago_reportado":
        return {
          icon: "clock",
          color: "#3B82F6",
          bg: "rgba(59, 130, 246, 0.15)",
        }; // Azul
      case "pago_confirmado":
        return {
          icon: "check-circle",
          color: "#10B981",
          bg: "rgba(16, 185, 129, 0.15)",
        }; // Verde
      case "pago_devuelto":
        return {
          icon: "rotate-ccw",
          color: "#EF4444",
          bg: "rgba(239, 68, 68, 0.15)",
        }; // Rojo
      case "nuevo_participante":
        return {
          icon: "user-plus",
          color: "#A855F7",
          bg: "rgba(168, 85, 247, 0.15)",
        }; // Morado
      default:
        return {
          icon: "activity",
          color: "#FFFFFF",
          bg: "rgba(255, 255, 255, 0.1)",
        }; // Por defecto
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.container}>
        {/* TARJETA HEADER DEL EVENTO */}
        <GlassCard style={styles.headerCard}>
          <View style={styles.headerLeft}>
            <View style={styles.titleRow}>
              <Text style={styles.eventoTitulo} numberOfLines={1}>
                {evento?.titulo}
              </Text>
              <View
                style={[
                  styles.estadoBadge,
                  evento?.estado === "finalizado" && styles.estadoBadgeCerrado,
                ]}
              >
                <Text
                  style={[
                    styles.estadoBadgeText,
                    evento?.estado === "finalizado" &&
                      styles.estadoBadgeTextCerrado,
                  ]}
                >
                  {evento?.estado}
                </Text>
              </View>
            </View>

            {evento?.descripcion ? (
              <Text style={styles.eventoDesc} numberOfLines={2}>
                {evento.descripcion}
              </Text>
            ) : null}
            <View style={styles.infoPillsWrap}>
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
                  <Feather
                    name="users"
                    size={11}
                    color="rgba(255,255,255,0.5)"
                  />
                  <Text style={styles.pillText}>
                    {participantes.length} personas
                  </Text>
                </View>
              </View>
              {esCreador ? (
                <View style={styles.infoPills}>
                  <TouchableOpacity
                    style={[styles.pill, styles.pillBoton]}
                    onPress={abrirModalEditarEvento}
                  >
                    <Feather
                      name="edit-3"
                      size={11}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.pillText}>Editar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pill, styles.pillBoton]}
                    onPress={confirmarCambioEstado}
                    disabled={actualizarEstadoMutation.isPending}
                  >
                    <Feather
                      name={evento?.estado === "finalizado" ? "rotate-ccw" : "check-circle"}
                      size={11}
                      color="rgba(255,255,255,0.5)"
                    />
                    <Text style={styles.pillText}>
                      {evento?.estado === "finalizado"
                        ? "Reabrir evento"
                        : "Finalizar evento"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={[
                styles.calendarBtn,
                evento?.google_event_id && styles.calendarBtnSynced,
              ]}
              onPress={agregarACalendar}
              disabled={Boolean(evento?.google_event_id)}
            >
              <Feather
                name={evento?.google_event_id ? "check-circle" : "calendar"}
                size={13}
                color={evento?.google_event_id ? "#4CAF50" : "#FFFFFF"}
              />
              <Text
                style={[
                  styles.calendarBtnText,
                  evento?.google_event_id && styles.calendarBtnTextSynced,
                ]}
              >
                {evento?.google_event_id
                  ? "Agregado a Google Calendar"
                  : "Agregar a Google Calendar"}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.iconosRow}>
              <TouchableOpacity onPress={confirmarEliminar}>
                <Feather name="trash-2" size={16} color="rgba(255,82,82,0.7)" />
              </TouchableOpacity>
            </View>
            <View
              style={{
                alignItems: "flex-end",
                flex: 1,
                justifyContent: "center",
              }}
            >
              <Text style={styles.totalMonto}>
                {formatearMonto(montoTotal)}
              </Text>
              <Text style={styles.totalLabel}>Total gastado</Text>
            </View>
          </View>
        </GlassCard>

        {/* TABS */}
        <View style={styles.tabBar}>
          {(["gastos", "balances", "participantes", "feed"] as Tab[]).map(
            (tab) => (
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
            ),
          )}
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
                <>
                  <Text style={styles.listaHint}>
                    Pulsa un gasto para ver sus boletas asociadas
                  </Text>
                  {gastos.map((g: any) => {
                    const pagador =
                      g.gastos_pagadores?.[0]?.contactos?.nombre ?? "?";
                    return (
                      <TouchableOpacity
                        key={g.id}
                        style={styles.gastoCard}
                        onPress={() => abrirOpcionesGasto(g)}
                        disabled={agregarBoletaGastoMutation.isPending}
                      >
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>
                            {pagador.substring(0, 1).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.cardInfo}>
                          <Text style={styles.cardTitulo}>{g.descripcion}</Text>
                          <Text style={styles.cardSub}>
                            Pagado por {pagador}
                          </Text>
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
                  })}
                </>
              )}
            </>
          )}

          {/* TAB BALANCES */}
          {tabActivo === "balances" && (
            <>
              {/* NUEVO RESUMEN GLOBAL */}
              <View style={styles.resumenContainer}>
                {miResumen.debe > 0 && (
                  <Text style={styles.textoResumen}>
                    Debes un total de:{" "}
                    <Text style={styles.deudaMonto}>
                      {formatearMonto(miResumen.debe)}
                    </Text>
                  </Text>
                )}
                {miResumen.leDeben > 0 && (
                  <Text style={styles.textoResumen}>
                    Te deben un total de:{" "}
                    <Text style={styles.positivo}>
                      {formatearMonto(miResumen.leDeben)}
                    </Text>
                  </Text>
                )}
                {miResumen.debe === 0 && miResumen.leDeben === 0 && (
                  <Text style={styles.textoResumen}>
                    Estás al día. No debes ni te deben nada.
                  </Text>
                )}
              </View>
              {deudas.length === 0 ? (
                <Text style={styles.emptyText}>No hay deudas pendientes.</Text>
              ) : (
                deudas.map((d: any, i: number) => {
                  // Verificamos permisos para mostrar el botón
                  const soyDeudor =
                    usuariosPorContactoId.get(d.deudorId) === usuarioActualId;
                  const esInvitado = !usuariosPorContactoId.get(d.deudorId);
                  const soyOrganizador = evento?.creador_id === usuarioActualId;
                  const soyAcreedor =
                    usuariosPorContactoId.get(d.acreedorId) === usuarioActualId;
                  // No se muestra si el deudor soy yo mismo, ni si es un invitado sin cuenta
                  const puedeRecordar =
                    (soyOrganizador || soyAcreedor) &&
                    !esInvitado &&
                    !soyDeudor;

                  return (
                    <View key={i} style={styles.gastoCard}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>
                          {participantesPorId.get(d.deudorId) ?? d.deudorId}{" "}
                          {esInvitado ? (
                            <Text style={{ color: "#AAAAAA", fontSize: 12 }}>
                              (Invitado){" "}
                            </Text>
                          ) : (
                            ""
                          )}
                          <Text style={styles.flecha}>→</Text>{" "}
                          {participantesPorId.get(d.acreedorId) ?? d.acreedorId}
                        </Text>
                      </View>
                      <View style={{ alignItems: "flex-end" }}>
                        <Text style={[styles.gastoMonto, styles.deudaMonto]}>
                          {formatearMonto(d.monto)}
                        </Text>

                        {puedeRecordar && (
                          <TouchableOpacity
                            style={styles.btnRecordatorio}
                            onPress={() =>
                              enviarRecordatorioMutation.mutate({
                                deudorId: d.deudorId,
                                monto: d.monto,
                              })
                            }
                            disabled={enviarRecordatorioMutation.isPending}
                          >
                            <Feather name="bell" size={12} color="#AAAAAA" />
                            <Text style={styles.btnRecordatorioText}>
                              Recordar
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })
              )}

              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>
                Detalle por participante
              </Text>
              {detalleParticipantes.length === 0 ? (
                <Text style={styles.emptyText}>No hay detalle disponible.</Text>
              ) : (
                detalleParticipantes.map((detalle) => {
                  const nombre =
                    participantesPorId.get(detalle.contactoId) ??
                    detalle.contactoId;

                  return (
                    <View key={detalle.contactoId} style={styles.gastoCard}>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>{nombre}</Text>
                        <Text style={styles.cardSub}>
                          Aportó {formatearMonto(detalle.totalAportado)} ·
                          Consumió {formatearMonto(detalle.totalConsumido)} ·
                          Pagos confirmados{" "}
                          {formatearMonto(detalle.pagosSaldados)}
                        </Text>
                        {detalle.movimientos.length > 0 ? (
                          <Text style={styles.cardSub}>
                            {detalle.movimientos.length} movimientos registrados
                          </Text>
                        ) : null}
                      </View>
                      <Text
                        style={[
                          styles.gastoMonto,
                          detalle.saldoNeto >= 0
                            ? styles.positivo
                            : styles.negativo,
                        ]}
                      >
                        {detalle.saldoNeto >= 0 ? "+" : ""}
                        {formatearMonto(detalle.saldoNeto)}
                      </Text>
                    </View>
                  );
                })
              )}

              <TouchableOpacity
                style={[styles.botonSecundario, { marginTop: 12 }]}
                onPress={abrirModalReporte}
                disabled={reportarPagoMutation.isPending}
              >
                <Text style={styles.botonSecundarioText}>Reportar pago</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.botonSecundario, { marginTop: 12 }]}
                onPress={cargarPagosReportados}
                disabled={
                  cargandoPagosReportados ||
                  confirmarPagoMutation.isPending ||
                  devolverPagoMutation.isPending
                }
              >
                {cargandoPagosReportados ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.botonSecundarioText}>Confirmar pago</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          {/* TAB PARTICIPANTES */}
          {tabActivo === "participantes" && (
            <>
              <TouchableOpacity
                style={[styles.botonSecundario, { marginBottom: 12 }]}
                onPress={() => setModalInvitarVisible(true)}
              >
                <View style={styles.invitarBtnContent}>
                  <Feather name="user-plus" size={16} color="#FFFFFF" />
                  <Text style={styles.botonSecundarioText}>
                    Invitar participante
                  </Text>
                </View>
              </TouchableOpacity>

              {loadingParticipantes ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
              ) : participantes.length === 0 ? (
                <Text style={styles.emptyText}>Sin participantes.</Text>
              ) : (
                <>
                  <Text style={styles.listaHint}>
                    Pulsa un participante para ver sus datos bancarios
                  </Text>
                  {participantes.map((p: any) => {
                    const balance = balances.find(
                      (b) => b.contactoId === p.contacto_id,
                    );
                    const monto = balance?.balance ?? 0;
                    const nombre = obtenerNombreContacto(p.contactos);
                    return (
                      <TouchableOpacity
                        key={p.contacto_id}
                        style={styles.gastoCard}
                        onPress={() => setParticipanteBancarioSeleccionado(p)}
                        activeOpacity={0.78}
                      >
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
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          )}

          {tabActivo === "feed" && (
            <>
              {loadingFeedEvento ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginTop: 20 }} />
              ) : feedEvento.length === 0 ? (
                <Text style={styles.emptyText}>
                  Aún no hay actividad interna para este evento.
                </Text>
              ) : (
                feedEvento.map((notificacion: any) => {
                  const estilo = obtenerEstiloFeed(notificacion.tipo);

                  return (
                    <View key={notificacion.id} style={styles.gastoCard}>
                      <View
                        style={[styles.avatar, { backgroundColor: estilo.bg }]}
                      >
                        <Feather
                          name={estilo.icon as any}
                          size={16}
                          color={estilo.color}
                        />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitulo}>
                          {notificacion.titulo}
                        </Text>
                        {notificacion.cuerpo ? (
                          <Text style={styles.cardSub}>
                            {notificacion.cuerpo}
                          </Text>
                        ) : null}
                        <Text style={styles.cardFecha}>
                          {formatearTiempoRelativo(notificacion.creado_en)}
                        </Text>
                      </View>
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

      <Modal
        visible={Boolean(participanteBancarioSeleccionado)}
        transparent
        animationType="fade"
        onRequestClose={cerrarModalDatosBancarios}
      >
        <View style={styles.modalOverlayCenter}>
          <View style={styles.modalBancoCard}>
            <View style={styles.modalHeader}>
              <View style={styles.deudaOptionInfo}>
                <Text style={styles.modalTitulo}>Datos bancarios</Text>
                <Text style={styles.deudaOptionSub}>
                  {obtenerNombreContacto(
                    participanteBancarioSeleccionado?.contactos,
                  )}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalDatosBancarios}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {participanteBancarioSeleccionado?.datos_bancarios ? (
              <>
                {[
                  {
                    label: "Banco",
                    value: participanteBancarioSeleccionado.datos_bancarios
                      .banco,
                    icon: "credit-card" as const,
                  },
                  {
                    label: "Tipo de cuenta",
                    value: participanteBancarioSeleccionado.datos_bancarios
                      .tipo_cuenta,
                    icon: "list" as const,
                  },
                  {
                    label: "Numero de cuenta",
                    value: participanteBancarioSeleccionado.datos_bancarios
                      .numero_cuenta,
                    icon: "hash" as const,
                  },
                  {
                    label: "RUT",
                    value: participanteBancarioSeleccionado.datos_bancarios.rut,
                    icon: "user" as const,
                  },
                ].map((campo) => (
                  <View key={campo.label} style={styles.datoBancoRow}>
                    <View style={styles.datoBancoIcon}>
                      <Feather
                        name={campo.icon}
                        size={16}
                        color="rgba(255,255,255,0.65)"
                      />
                    </View>
                    <View style={styles.deudaOptionInfo}>
                      <Text style={styles.datoBancoLabel}>{campo.label}</Text>
                      <Text style={styles.datoBancoValor}>{campo.value}</Text>
                    </View>
                  </View>
                ))}

                <TouchableOpacity
                  style={[styles.botonReportarFinal, styles.copiarBancoBtn]}
                  onPress={copiarDatosBancarios}
                >
                  <Feather name="copy" size={17} color="#000000" />
                  <Text style={styles.botonReportarFinalText}>Copiar datos</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.datosBancoVacios}>
                <Feather
                  name="lock"
                  size={24}
                  color="rgba(255,255,255,0.45)"
                />
                <Text style={styles.emptyText}>
                  No hay datos bancarios disponibles para este participante.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(avisoPago)}
        transparent
        animationType="slide"
        onRequestClose={() => setAvisoPago(null)}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.avisoPagoCard,
              { paddingBottom: 22 + insets.bottom },
            ]}
          >
            <View
              style={[
                styles.avisoPagoIcono,
                { borderColor: avisoPago?.color ?? "#FFFFFF" },
              ]}
            >
              <Feather
                name={avisoPago?.icono ?? "info"}
                size={24}
                color={avisoPago?.color ?? "#FFFFFF"}
              />
            </View>
            <Text style={styles.avisoPagoTitulo}>{avisoPago?.titulo}</Text>
            <Text style={styles.avisoPagoMensaje}>{avisoPago?.mensaje}</Text>
            <TouchableOpacity
              style={[styles.botonReportarFinal, styles.avisoPagoBoton]}
              onPress={() => setAvisoPago(null)}
            >
              <Text style={styles.botonReportarFinalText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalReporteVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalReporte}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { paddingBottom: 20 + insets.bottom }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Reportar pago</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalReporte}
                disabled={reportarPagoMutation.isPending}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Tus deudas del evento</Text>
            <ScrollView style={styles.deudasSelector}>
              {deudasDelUsuario.map((deuda, index) => {
                const seleccionada =
                  deudaSeleccionada?.deudorId === deuda.deudorId &&
                  deudaSeleccionada?.acreedorId === deuda.acreedorId &&
                  deudaSeleccionada?.monto === deuda.monto;
                const deudorNombre =
                  participantesPorId.get(deuda.deudorId) ?? deuda.deudorId;
                const acreedorNombre =
                  participantesPorId.get(deuda.acreedorId) ?? deuda.acreedorId;

                return (
                  <TouchableOpacity
                    key={`${deuda.deudorId}-${deuda.acreedorId}-${index}`}
                    style={[
                      styles.deudaOption,
                      seleccionada && styles.deudaOptionActiva,
                    ]}
                    onPress={() => setDeudaSeleccionada(deuda)}
                    disabled={reportarPagoMutation.isPending}
                  >
                    <View style={styles.deudaOptionInfo}>
                      <Text style={styles.deudaOptionTitle}>
                        {deudorNombre}
                      </Text>
                      <Text style={styles.deudaOptionSub}>
                        Paga a {acreedorNombre}
                      </Text>
                      <Text style={styles.deudaOptionMonto}>
                        {formatearMonto(deuda.monto)}
                      </Text>
                    </View>
                    {seleccionada ? (
                      <Feather name="check-circle" size={20} color="#4CAF50" />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Text style={styles.modalLabel}>Comprobante</Text>
            <TouchableOpacity
              style={styles.comprobanteBox}
              onPress={seleccionarComprobante}
              disabled={reportarPagoMutation.isPending}
            >
              {comprobante ? (
                <>
                  <Image
                    source={{ uri: comprobante.uri }}
                    style={styles.comprobantePreview}
                  />
                  <View style={styles.comprobanteOverlay}>
                    <Feather name="image" size={16} color="#FFFFFF" />
                    <Text style={styles.comprobanteOverlayText}>Cambiar</Text>
                  </View>
                </>
              ) : (
                <>
                  <Feather name="upload" size={22} color="#FFFFFF" />
                  <Text style={styles.comprobanteText}>Seleccionar imagen</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.botonReportarFinal,
                reportarPagoMutation.isPending && styles.botonDeshabilitado,
              ]}
              onPress={enviarReportePago}
              disabled={reportarPagoMutation.isPending}
            >
              {reportarPagoMutation.isPending ? (
                <ActivityIndicator color="#000000" />
              ) : (
                <Text style={styles.botonReportarFinalText}>Reportar</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* MODAL INVITAR PARTICIPANTE */}
      <Modal visible={modalInvitarVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invitar participante</Text>

            {loadingContactosInvitar ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : contactosInvitar.length === 0 ? (
              <Text style={styles.emptyText}>
                No tienes más contactos disponibles.
              </Text>
            ) : (
              <ScrollView>
                {contactosInvitar.map((c: any) => {
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

      <Modal
        visible={modalConfirmacionVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalConfirmacion}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { paddingBottom: 20 + insets.bottom }]}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Confirmar pagos</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalConfirmacion}
                disabled={
                  confirmarPagoMutation.isPending ||
                  devolverPagoMutation.isPending
                }
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pagosReportadosLista}>
              {pagosReportados.length === 0 ? (
                <Text style={styles.emptyText}>
                  No hay pagos reportados para revisar.
                </Text>
              ) : (
                pagosReportados.map((pago) => {
                  const deudorNombre =
                    participantesPorId.get(pago.deudor_id) ?? pago.deudor_id;
                  const acreedorNombre =
                    participantesPorId.get(pago.acreedor_id) ??
                    pago.acreedor_id;
                  const accionesDeshabilitadas =
                    confirmarPagoMutation.isPending ||
                    devolverPagoMutation.isPending;

                  return (
                    <View key={pago.id} style={styles.pagoReportadoCard}>
                      <View style={styles.pagoReportadoHeader}>
                        <View style={styles.deudaOptionInfo}>
                          <Text style={styles.deudaOptionTitle}>
                            {deudorNombre}
                          </Text>
                          <Text style={styles.deudaOptionSub}>
                            Reportó pago a {acreedorNombre}
                          </Text>
                        </View>
                        <Text style={styles.deudaOptionMonto}>
                          {formatearMonto(pago.monto)}
                        </Text>
                      </View>

                      <View style={styles.comprobanteLecturaBox}>
                        {pago.comprobanteUrl ? (
                          <Image
                            source={{ uri: pago.comprobanteUrl }}
                            style={styles.comprobantePreview}
                            resizeMode="contain"
                          />
                        ) : (
                          <View style={styles.comprobanteVacio}>
                            <Feather
                              name="image"
                              size={22}
                              color="rgba(255,255,255,0.45)"
                            />
                            <Text style={styles.cardSub}>
                              Sin comprobante disponible
                            </Text>
                          </View>
                        )}
                      </View>

                      <View style={styles.accionesPagoRow}>
                        <TouchableOpacity
                          style={[
                            styles.botonPagoPendiente,
                            accionesDeshabilitadas && styles.botonDeshabilitado,
                          ]}
                          onPress={() => devolverPagoMutation.mutate(pago.id)}
                          disabled={accionesDeshabilitadas}
                        >
                          <Text style={styles.botonPagoPendienteText}>
                            Volver a pendiente
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.botonPagoSaldado,
                            accionesDeshabilitadas && styles.botonDeshabilitado,
                          ]}
                          onPress={() => confirmarPagoMutation.mutate(pago.id)}
                          disabled={accionesDeshabilitadas}
                        >
                          <Text style={styles.botonPagoSaldadoText}>
                            Saldado
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalOpcionesGastoVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalOpcionesGasto}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { paddingBottom: 20 + insets.bottom }]}
          >
            <View style={styles.opcionesGastoHeader}>
              <View style={styles.opcionesGastoIcono}>
                <Feather name="file-text" size={22} color="#FFFFFF" />
              </View>
              <View style={styles.deudaOptionInfo}>
                <Text style={styles.modalTitulo}>Boletas</Text>
                <Text style={styles.opcionesGastoTitulo} numberOfLines={2}>
                  {gastoSeleccionado?.descripcion ?? "Gasto"}
                </Text>
                {gastoSeleccionado ? (
                  <Text style={styles.opcionesGastoMonto}>
                    {formatearMonto(gastoSeleccionado.monto_total)}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalOpcionesGasto}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.opcionGastoBoton}
              onPress={agregarBoletaGastoSeleccionado}
              disabled={agregarBoletaGastoMutation.isPending}
            >
              <View style={styles.opcionGastoIconoAccion}>
                <Feather name="upload" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.deudaOptionInfo}>
                <Text style={styles.opcionGastoTitulo}>Agregar boleta</Text>
                <Text style={styles.opcionGastoSub}>
                  Sube una imagen y asóciala a este gasto.
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.opcionGastoBoton}
              onPress={verBoletasGastoSeleccionado}
            >
              <View style={styles.opcionGastoIconoAccion}>
                <Feather name="image" size={20} color="#FFFFFF" />
              </View>
              <View style={styles.deudaOptionInfo}>
                <Text style={styles.opcionGastoTitulo}>Ver boletas</Text>
                <Text style={styles.opcionGastoSub}>
                  Revisa las imágenes guardadas por el grupo.
                </Text>
              </View>
              <Feather
                name="chevron-right"
                size={20}
                color="rgba(255,255,255,0.35)"
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.opcionesGastoCancelar}
              onPress={cerrarModalOpcionesGasto}
            >
              <Text style={styles.opcionesGastoCancelarText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalBoletasVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalBoletas}
      >
        <View style={styles.modalOverlay}>
          <View
            style={[styles.modalCard, { paddingBottom: 20 + insets.bottom }]}
          >
            <View style={styles.modalHeader}>
              <View style={styles.deudaOptionInfo}>
                <Text style={styles.modalTitulo}>Boletas del gasto</Text>
                {gastoBoletas ? (
                  <Text style={styles.deudaOptionSub}>
                    {gastoBoletas.descripcion}
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalBoletas}
                disabled={agregarBoletaGastoMutation.isPending}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {cargandoBoletas ? (
              <ActivityIndicator
                color="#FFFFFF"
                style={{ marginVertical: 28 }}
              />
            ) : boletasGasto.length === 0 ? (
              <View style={styles.comprobanteVacio}>
                <Feather
                  name="image"
                  size={24}
                  color="rgba(255,255,255,0.45)"
                />
                <Text style={styles.emptyText}>
                  Este gasto todavía no tiene boletas.
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.boletasLista}>
                {boletasGasto.map((boleta) => (
                  <View key={boleta.id} style={styles.boletaCard}>
                    <Image
                      source={{ uri: boleta.url }}
                      style={styles.comprobantePreview}
                      resizeMode="contain"
                    />
                  </View>
                ))}
              </ScrollView>
            )}

            {gastoBoletas ? (
              <TouchableOpacity
                style={[
                  styles.botonReportarFinal,
                  agregarBoletaGastoMutation.isPending &&
                    styles.botonDeshabilitado,
                ]}
                onPress={() => seleccionarBoletaGasto(gastoBoletas)}
                disabled={agregarBoletaGastoMutation.isPending}
              >
                {agregarBoletaGastoMutation.isPending ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.botonReportarFinalText}>
                    Agregar boleta
                  </Text>
                )}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalEditarEventoVisible}
        transparent
        animationType="slide"
        onRequestClose={cerrarModalEditarEvento}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Editar evento</Text>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={cerrarModalEditarEvento}
                disabled={actualizarEventoMutation.isPending}
              >
                <Feather name="x" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalLabel}>Nombre</Text>
              <View style={styles.editarInputGroup}>
                <Feather
                  name="edit-3"
                  size={16}
                  color="#AAAAAA"
                  style={styles.editarIcon}
                />
                <TextInput
                  style={styles.editarInput}
                  value={editNombre}
                  onChangeText={setEditNombre}
                  placeholder="Nombre del evento"
                  placeholderTextColor="#666666"
                  maxLength={50}
                />
              </View>

              <Text style={styles.modalLabel}>Descripción</Text>
              <View
                style={[
                  styles.editarInputGroup,
                  styles.editarInputGroupMultiline,
                ]}
              >
                <TextInput
                  style={[styles.editarInput, styles.editarInputMultiline]}
                  value={editDescripcion}
                  onChangeText={setEditDescripcion}
                  placeholder="Detalles adicionales sobre el evento"
                  placeholderTextColor="#666666"
                  multiline
                  maxLength={200}
                />
              </View>

              <Text style={styles.modalLabel}>Ubicación</Text>
              <View style={styles.editarInputGroup}>
                <Feather
                  name="navigation"
                  size={16}
                  color="#AAAAAA"
                  style={styles.editarIcon}
                />
                <TextInput
                  style={styles.editarInput}
                  value={editUbicacion}
                  onChangeText={setEditUbicacion}
                  placeholder="Ubicación (opcional)"
                  placeholderTextColor="#666666"
                  maxLength={100}
                />
              </View>

              <Text style={styles.modalLabel}>Fecha y hora</Text>
              <View style={styles.editarDateRow}>
                <TouchableOpacity
                  style={styles.editarDateBtn}
                  onPress={() => {
                    setEditModoFecha("date");
                    setShowEditDatePicker(true);
                  }}
                >
                  <Feather name="calendar" size={16} color="#AAAAAA" />
                  <Text style={styles.editarDateBtnText}>
                    {editFecha.toLocaleDateString("es-CL")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.editarDateBtn}
                  onPress={() => {
                    setEditModoFecha("time");
                    setShowEditDatePicker(true);
                  }}
                >
                  <Feather name="clock" size={16} color="#AAAAAA" />
                  <Text style={styles.editarDateBtnText}>
                    {editFecha.toLocaleTimeString("es-CL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Text>
                </TouchableOpacity>
              </View>
              {showEditDatePicker && (
                <DateTimePicker
                  value={editFecha}
                  mode={editModoFecha}
                  is24Hour={false}
                  display="default"
                  onChange={(_, selected) => {
                    setShowEditDatePicker(Platform.OS === "ios");
                    if (selected) setEditFecha(selected);
                  }}
                />
              )}

              <Text style={[styles.modalLabel, styles.editarSeccion]}>
                Participantes ({participantes.length})
              </Text>
              {participantes.map((p: any) => {
                const nombre = obtenerNombreContacto(p.contactos);
                const esCreadorFila = p.rol === "creador";
                return (
                  <View key={p.contacto_id} style={styles.editarParticipanteRow}>
                    <Text style={styles.editarParticipanteNombre}>
                      {nombre}
                    </Text>
                    {esCreadorFila ? (
                      <Text style={styles.editarParticipanteCreadorTag}>
                        Organizador
                      </Text>
                    ) : (
                      <TouchableOpacity
                        onPress={() =>
                          confirmarQuitarParticipante(p.contacto_id, nombre)
                        }
                        disabled={eliminarParticipanteMutation.isPending}
                      >
                        <Feather name="x" size={18} color="#FF6B6B" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              <Text style={[styles.modalLabel, styles.editarSeccion]}>
                Agregar participante
              </Text>
              {loadingContactosInvitar ? (
                <ActivityIndicator color="#FFFFFF" style={{ marginTop: 10 }} />
              ) : (
                contactosInvitar
                  .filter((c: any) => !yaEsParticipante(c.id))
                  .map((c: any) => (
                    <TouchableOpacity
                      key={c.id}
                      style={styles.editarAgregarRow}
                      onPress={() => invitarParticipanteMutation.mutate(c.id)}
                      disabled={invitarParticipanteMutation.isPending}
                    >
                      <Text style={styles.editarAgregarNombre}>
                        {c.nombre}
                      </Text>
                      <Feather name="plus" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))
              )}

              <TouchableOpacity
                style={[
                  styles.botonReportarFinal,
                  styles.editarGuardarBtn,
                  (actualizarEventoMutation.isPending ||
                    !editNombre.trim()) &&
                    styles.botonDeshabilitado,
                ]}
                onPress={() => actualizarEventoMutation.mutate()}
                disabled={
                  actualizarEventoMutation.isPending || !editNombre.trim()
                }
              >
                {actualizarEventoMutation.isPending ? (
                  <ActivityIndicator color="#000000" />
                ) : (
                  <Text style={styles.botonReportarFinalText}>
                    Guardar cambios
                  </Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    flexShrink: 1,
  },
  eventoDesc: {
    color: "#AAAAAA",
    fontSize: 13,
    marginBottom: 10,
  },
  estadoBadge: {
    backgroundColor: "rgba(80,200,120,0.15)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  estadoBadgeCerrado: {
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  estadoBadgeText: {
    color: "#50C878",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  estadoBadgeTextCerrado: {
    color: "rgba(255,255,255,0.6)",
  },
  infoPillsWrap: {
    gap: 8,
  },
  infoPills: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  pill: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconosRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  pillBoton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
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
  tab: { flex: 1, paddingVertical: 8, borderRadius: 18, alignItems: "center" },
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
  sectionTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },

  // --- RESUMEN DE SALDOS ---
  resumenContainer: {
    backgroundColor: "rgba(255,255,255,0.05)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  textoResumen: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
    marginVertical: 4,
  },

  // --- CARDS ---
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
  avatarText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },
  cardInfo: { flex: 1 },
  cardTitulo: { color: "#FFFFFF", fontSize: 15, fontWeight: "500" },
  cardSub: { color: "#888888", fontSize: 12, marginTop: 2 },
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
  listaHint: {
    color: "rgba(255,255,255,0.46)",
    fontSize: 12,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 4,
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

  // --- BOTÓN SECUNDARIO ---
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
  invitarBtnContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
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
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalOverlayCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalCard: {
    maxHeight: "88%",
    backgroundColor: "#181818",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalBancoCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#181818",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitulo: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  modalLabel: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  editarSeccion: {
    marginTop: 20,
  },
  editarInputGroup: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  editarInputGroupMultiline: {
    height: 90,
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  editarIcon: {
    marginRight: 10,
  },
  editarInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
  },
  editarInputMultiline: {
    height: "100%",
    textAlignVertical: "top",
  },
  editarDateRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  editarDateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 45,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  editarDateBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  editarParticipanteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  editarParticipanteNombre: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  editarParticipanteCreadorTag: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
  },
  editarAgregarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  editarAgregarNombre: {
    color: "#FFFFFF",
    fontSize: 14,
  },
  editarGuardarBtn: {
    marginTop: 24,
    marginBottom: 8,
  },
  avisoPagoCard: {
    backgroundColor: "#181818",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  avisoPagoIcono: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  avisoPagoTitulo: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  avisoPagoMensaje: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  avisoPagoBoton: {
    minWidth: 190,
    paddingHorizontal: 28,
    alignSelf: "center",
  },
  datoBancoRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 58,
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  datoBancoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  datoBancoLabel: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginBottom: 3,
  },
  datoBancoValor: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  copiarBancoBtn: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  datosBancoVacios: {
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
  },
  deudasSelector: {
    maxHeight: 210,
    marginBottom: 18,
  },
  deudaOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 64,
    padding: 14,
    marginBottom: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  deudaOptionActiva: {
    borderColor: "rgba(76,175,80,0.75)",
    backgroundColor: "rgba(76,175,80,0.12)",
  },
  deudaOptionInfo: {
    flex: 1,
    paddingRight: 12,
  },
  deudaOptionTitle: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  deudaOptionSub: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 3,
  },
  deudaOptionMonto: {
    color: "#FF6B6B",
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 4,
  },
  comprobanteBox: {
    height: 170,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(255,255,255,0.07)",
    marginBottom: 18,
  },
  comprobantePreview: {
    width: "100%",
    height: "100%",
  },
  comprobanteOverlay: {
    position: "absolute",
    right: 12,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  comprobanteOverlayText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  comprobanteText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
  botonReportarFinal: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  botonReportarFinalText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  botonDeshabilitado: {
    opacity: 0.65,
  },
  opcionesGastoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  opcionesGastoIcono: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.11)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  opcionesGastoTitulo: {
    color: "rgba(255,255,255,0.68)",
    fontSize: 13,
    marginTop: 4,
  },
  opcionesGastoMonto: {
    color: "#4CAF50",
    fontSize: 14,
    fontWeight: "700",
    marginTop: 6,
  },
  opcionGastoBoton: {
    minHeight: 72,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  opcionGastoIconoAccion: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  opcionGastoTitulo: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  opcionGastoSub: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 3,
  },
  opcionesGastoCancelar: {
    minHeight: 48,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  opcionesGastoCancelarText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    fontWeight: "700",
  },
  pagosReportadosLista: {
    maxHeight: 560,
  },
  boletasLista: {
    maxHeight: 430,
    marginBottom: 14,
  },
  boletaCard: {
    height: 260,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  pagoReportadoCard: {
    padding: 14,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  pagoReportadoHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  comprobanteLecturaBox: {
    height: 220,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.22)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  comprobanteVacio: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  accionesPagoRow: {
    flexDirection: "row",
    gap: 10,
  },
  botonPagoPendiente: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,107,107,0.45)",
    backgroundColor: "rgba(255,82,82,0.16)",
  },
  botonPagoPendienteText: {
    color: "#FF8A8A",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  botonPagoSaldado: {
    flex: 1,
    minHeight: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  botonPagoSaldadoText: {
    color: "#000000",
    fontSize: 14,
    fontWeight: "bold",
  },

  // --- FAB ---
  fabWrapper: { position: "absolute", bottom: 30, right: 20 },
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
  
  // --- CALENDAR BTN ---
  calendarBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    backgroundColor: "rgba(66, 133, 244, 0.25)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(66, 133, 244, 0.4)",
  },

  calendarBtnSynced: {
    backgroundColor: "rgba(76, 175, 80, 0.18)",
    borderColor: "rgba(76, 175, 80, 0.45)",
  },

  calendarBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "600",
  },

  calendarBtnTextSynced: {
    color: "#4CAF50",
  },

  // --- MODAL EDITAR ---
  modalOverlayEditar: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCardEditar: {
    backgroundColor: "rgba(25,25,25,0.97)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: 14,
    color: "#FFFFFF",
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    padding: 14,
    borderRadius: 12,
    marginTop: 10,
  },
  actionBtnText: { color: "#FFFFFF", fontWeight: "bold", fontSize: 15 },
  cancelBtn: {
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    marginTop: 10,
  },
  cancelBtnText: { color: "#AAAAAA", fontWeight: "bold" },
  btnRecordatorio: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  btnRecordatorioText: {
    color: "#AAAAAA",
    fontSize: 11,
    fontWeight: "600",
  },
});
