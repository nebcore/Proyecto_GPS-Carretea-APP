import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import Feather from "@expo/vector-icons/Feather";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import GlassCard from "@/components/ui/GlassCard";
import Header from "@/components/ui/Header";
import {
  crearGasto,
  GastoFormData,
  GastoFormInput,
  GastoFormValues,
  gastoFormSchema,
  obtenerParticipantesEvento,
} from "@/lib/api/gastos";
import { CalculoDivision, TipoDivision } from "@/lib/api/gastos_logic";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export default function GastoNuevoScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId?: string | string[] }>();
  const eventoIdActual = Array.isArray(eventoId)
    ? eventoId[0] ?? ""
    : eventoId ?? "";
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tipoDivision, setTipoDivision] = useState<TipoDivision>("equitativo");
  const [pagadorId, setPagadorId] = useState<string>("");
  const [montosExactos, setMontosExactos] = useState<Record<string, number>>({});
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  const { data: participantes = [], isLoading } = useQuery({
    queryKey: ["participantes", eventoIdActual],
    queryFn: () => obtenerParticipantesEvento(eventoIdActual),
    enabled: Boolean(eventoIdActual),
    select: (data) =>
      data.map((item: any) => ({
        contacto_id: item.contacto_id,
        nombre: item.contactos?.nombre ?? "Sin nombre",
      })),
  });

  const { control, handleSubmit, setValue, formState: { errors } } =
    useForm<GastoFormInput, unknown, GastoFormValues>({
      resolver: zodResolver(gastoFormSchema),
      defaultValues: {
        evento_id: eventoIdActual,
        descripcion: "",
        monto_total: undefined,
        fecha: new Date().toISOString(),
        tipo_division: "equitativo",
      },
    });

  useEffect(() => {
    if (eventoIdActual) {
      setValue("evento_id", eventoIdActual);
    }
  }, [eventoIdActual, setValue]);

  const formatearFecha = (iso?: string) => {
    if (!iso) return "Hoy";
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  async function onSubmit(data: GastoFormValues) {
    if (!eventoIdActual) {
      Alert.alert(
        "Evento no encontrado",
        "Vuelve al evento e intenta agregar el gasto nuevamente.",
      );
      return;
    }

    if (!pagadorId) {
      Alert.alert("Falta el pagador", "Selecciona quién pagó el gasto.");
      return;
    }

    try {
      setGuardando(true);

      const consumidoresIds = participantes.map((p: any) => p.contacto_id);
      const consumidoresCalculados = CalculoDivision({
        monto_total: data.monto_total,
        consumidoresID: consumidoresIds,
        tipo_division: tipoDivision,
        montosExactos,
      });

      const gastoFinal: GastoFormData = {
        ...data,
        evento_id: eventoIdActual,
        tipo_division: tipoDivision,
        gastos_pagadores: [{ contacto_id: pagadorId, monto_aportado: data.monto_total }],
        gastos_consumidores: consumidoresCalculados,
      };

      await crearGasto(gastoFinal);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["gastos-detalle", eventoIdActual] }),
        queryClient.invalidateQueries({ queryKey: ["gastos", eventoIdActual] }),
        queryClient.invalidateQueries({ queryKey: ["total-gastos"] }),
        queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] }),
      ]);
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "No se pudo registrar el gasto.");
    } finally {
      setGuardando(false);
    }
  }

  function onInvalid() {
    Alert.alert("Campos incompletos", "Revisa la descripción y el monto.");
  }

  if (isLoading) {
    return (
      <View style={styles.root}>
        <Header mostrarVolver onVolver={() => router.back()} />
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Header mostrarVolver onVolver={() => router.back()} />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* TÍTULO */}
        <Text style={styles.titulo}>Anotar gasto</Text>

        {/* DESCRIPCIÓN */}
        <Text style={styles.label}>Descripción</Text>
        <Controller
          control={control}
          name="descripcion"
          render={({ field: { onChange, value } }) => (
            <TextInput
              style={[styles.input, errors.descripcion && styles.inputError]}
              value={value}
              onChangeText={onChange}
              placeholder="Ej: Pizza, Uber, Entradas..."
              placeholderTextColor="rgba(255,255,255,0.3)"
            />
          )}
        />

        {/* MONTO */}
        <Text style={styles.label}>Monto</Text>
        <View style={styles.montoRow}>
          <Text style={styles.montoPrefix}>$</Text>
          <Controller
            control={control}
            name="monto_total"
            render={({ field: { onChange, value } }) => (
              <TextInput
                style={[styles.montoInput, errors.monto_total && styles.inputError]}
                value={value ? String(value) : ""}
                onChangeText={(text) => {
                  const limpio = text.replace(/[^0-9]/g, "");
                  onChange(limpio === "" ? undefined : Number(limpio));
                }}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor="rgba(255,255,255,0.3)"
              />
            )}
          />
          <Text style={styles.montoSuffix}>CLP</Text>
        </View>

        {/* FECHA */}
        <Text style={styles.label}>Fecha</Text>
        <Controller
          control={control}
          name="fecha"
          render={({ field: { onChange, value } }) => (
            <>
              <Pressable
                style={styles.input}
                onPress={() => setMostrarFecha(true)}
              >
                <View style={styles.fechaRow}>
                  <Feather name="calendar" size={16} color="rgba(255,255,255,0.5)" />
                  <Text style={styles.fechaText}>{formatearFecha(value)}</Text>
                </View>
              </Pressable>

              {mostrarFecha && (
                <DateTimePicker
                  value={fechaSeleccionada}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "calendar"}
                  onChange={(_, date) => {
                    setMostrarFecha(Platform.OS === "ios");
                    if (date) {
                      setFechaSeleccionada(date);
                      onChange(date.toISOString());
                      setValue("fecha", date.toISOString());
                    }
                  }}
                />
              )}
            </>
          )}
        />

        {/* PAGADOR */}
        <Text style={styles.label}>¿Quién pagó?</Text>
        <View style={styles.chipsRow}>
          {participantes.map((p: any) => {
            const seleccionado = pagadorId === p.contacto_id;
            return (
              <TouchableOpacity
                key={p.contacto_id}
                style={[styles.chip, seleccionado && styles.chipActivo]}
                onPress={() => setPagadorId(p.contacto_id)}
              >
                <Text style={[styles.chipText, seleccionado && styles.chipTextActivo]}>
                  {p.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* TIPO DE DIVISIÓN */}
        <Text style={styles.label}>División</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, tipoDivision === "equitativo" && styles.toggleActivo]}
            onPress={() => {
              setTipoDivision("equitativo");
              setValue("tipo_division", "equitativo");
            }}
          >
            <Feather
              name="users"
              size={14}
              color={tipoDivision === "equitativo" ? "#000000" : "rgba(255,255,255,0.6)"}
            />
            <Text style={[styles.toggleText, tipoDivision === "equitativo" && styles.toggleTextActivo]}>
              Equitativo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleBtn, tipoDivision === "montos_exactos" && styles.toggleActivo]}
            onPress={() => {
              setTipoDivision("montos_exactos");
              setValue("tipo_division", "montos_exactos");
            }}
          >
            <Feather
              name="sliders"
              size={14}
              color={tipoDivision === "montos_exactos" ? "#000000" : "rgba(255,255,255,0.6)"}
            />
            <Text style={[styles.toggleText, tipoDivision === "montos_exactos" && styles.toggleTextActivo]}>
              Montos exactos
            </Text>
          </TouchableOpacity>
        </View>

        {/* MONTOS EXACTOS */}
        {tipoDivision === "montos_exactos" && (
          <GlassCard style={styles.montosCard}>
            <Text style={styles.montosCardTitulo}>Monto por persona</Text>
            {participantes.map((p: any) => (
              <View key={p.contacto_id} style={styles.montoPersonaRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {p.nombre.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.montoPersonaNombre}>{p.nombre}</Text>
                <View style={styles.montoPersonaInputWrap}>
                  <Text style={styles.montoPrefix}>$</Text>
                  <TextInput
                    style={styles.montoPersonaInput}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    onChangeText={(text) => {
                      const limpio = text.replace(/[^0-9]/g, "");
                      setMontosExactos((prev) => ({
                        ...prev,
                        [p.contacto_id]: limpio === "" ? 0 : Number(limpio),
                      }));
                    }}
                  />
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {/* BOTÓN SUBMIT */}
        <TouchableOpacity
          style={[styles.boton, guardando && styles.botonDisabled]}
          onPress={handleSubmit(onSubmit, onInvalid)}
          disabled={guardando}
        >
          {guardando ? (
            <ActivityIndicator color="#000000" />
          ) : (
            <>
              <Feather name="check" size={18} color="#000000" />
              <Text style={styles.botonText}>Registrar gasto</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  scroll: { paddingHorizontal: 20, paddingTop: 16 },

  titulo: {
    color: "#FFFFFF",
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 24,
  },

  // --- LABELS ---
  label: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },

  // --- INPUTS ---
  input: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  inputError: {
    borderColor: "rgba(255, 82, 82, 0.6)",
  },

  // --- MONTO ---
  montoRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  montoPrefix: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 18,
    marginRight: 8,
  },
  montoInput: {
    flex: 1,
    padding: 16,
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "bold",
  },
  montoSuffix: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 13,
  },

  // --- FECHA ---
  fechaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  fechaText: {
    color: "#FFFFFF",
    fontSize: 15,
  },

  // --- CHIPS PAGADOR ---
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  chipActivo: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  chipText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  chipTextActivo: {
    color: "#000000",
    fontWeight: "bold",
  },

  // --- TOGGLE DIVISIÓN ---
  toggleRow: {
    flexDirection: "row",
    gap: 10,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  toggleActivo: {
    backgroundColor: "#FFFFFF",
    borderColor: "#FFFFFF",
  },
  toggleText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontWeight: "500",
  },
  toggleTextActivo: {
    color: "#000000",
    fontWeight: "bold",
  },

  // --- MONTOS EXACTOS ---
  montosCard: {
    marginTop: 12,
    padding: 16,
    borderRadius: 16,
  },
  montosCardTitulo: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  montoPersonaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  montoPersonaNombre: {
    color: "#FFFFFF",
    fontSize: 14,
    flex: 1,
  },
  montoPersonaInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    width: 110,
  },
  montoPersonaInput: {
    color: "#FFFFFF",
    fontSize: 15,
    padding: 10,
    flex: 1,
    textAlign: "right",
  },

  // --- BOTÓN ---
  boton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginTop: 32,
  },
  botonDisabled: {
    opacity: 0.6,
  },
  botonText: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
});
