import { Alert } from "@/components/ui/AppAlert";
import Feather from "@expo/vector-icons/Feather";
import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PantallaConTeclado } from "@/components/ui/PantallaConTeclado";

import GlassCard from "@/components/ui/GlassCard";
import {
  crearGasto,
  GastoFormData,
  GastoFormInput,
  gastoFormSchema,
  GastoFormValues,
  obtenerParticipantesEvento,
} from "@/lib/api/gastos";
import { CalculoDivision, TipoDivision } from "@/lib/api/gastos_logic";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const formatearMontoResumen = (valor: number) =>
  `$${Math.round(valor).toLocaleString("es-CL")}`;

export default function GastoNuevoScreen() {
  const { eventoId } = useLocalSearchParams<{ eventoId: string }>();
  const eventoIdString = Array.isArray(eventoId)
    ? eventoId[0]
    : (eventoId ?? "");
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [tipoDivision, setTipoDivision] = useState<TipoDivision>("equitativo");
  const [montosPagadores, setMontosPagadores] = useState<
    Record<string, number>
  >({});
  const [selectedConsumers, setSelectedConsumers] = useState<
    Record<string, boolean>
  >({});
  const [montosExactos, setMontosExactos] = useState<Record<string, number>>(
    {},
  );
  const [mostrarFecha, setMostrarFecha] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [guardando, setGuardando] = useState(false);

  const { data: participantes = [], isLoading } = useQuery({
    queryKey: ["participantes", eventoIdString],
    queryFn: () => obtenerParticipantesEvento(eventoIdString),
    enabled: Boolean(eventoIdString),
    select: (data) =>
      data.map((item: any) => ({
        contacto_id: item.contacto_id,
        nombre: item.contactos?.nombre ?? "Sin nombre",
      })),
  });

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<GastoFormInput, unknown, GastoFormValues>({
    resolver: zodResolver(gastoFormSchema),
    defaultValues: {
      evento_id: eventoIdString,
      descripcion: "",
      monto_total: undefined,
      fecha: new Date().toISOString(),
      tipo_division: "equitativo",
    },
  });

  useEffect(() => {
    if (eventoIdString) {
      setValue("evento_id", eventoIdString);
    }
  }, [eventoIdString, setValue]);

  const formatearFecha = (iso?: string) => {
    if (!iso) return "Hoy";
    return new Date(iso).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const formatearMontoInput = (valor?: number) =>
    valor ? new Intl.NumberFormat("es-CL").format(valor) : "";

  const consumidoresSeleccionados = useMemo(
    () =>
      participantes.filter(
        (p: any) => selectedConsumers[p.contacto_id] ?? true,
      ),
    [participantes, selectedConsumers],
  );

  const obtenerConsumidoresIds = () =>
    consumidoresSeleccionados.map((p: any) => p.contacto_id);

  const montoTotalActual = Number(watch("monto_total") || 0);

  const resumenGasto = useMemo(() => {
    const consumidoresIds = consumidoresSeleccionados.map(
      (p: any) => p.contacto_id,
    );
    const totalAportes = Object.values(montosPagadores).reduce(
      (suma, monto) => suma + (Number(monto) || 0),
      0,
    );
    const diferenciaAportes = montoTotalActual - totalAportes;
    const totalValoresDivision = consumidoresIds.reduce(
      (suma: number, contactoId: string) =>
        suma + (Number(montosExactos[contactoId]) || 0),
      0,
    );

    let distribuido = 0;
    let detalleDivision = "";

    if (consumidoresIds.length === 0) {
      detalleDivision = "Selecciona al menos un consumidor.";
    } else if (tipoDivision === "equitativo") {
      distribuido = montoTotalActual;
      detalleDivision = `${consumidoresIds.length} consumidores seleccionados.`;
    } else if (tipoDivision === "montos_exactos") {
      distribuido = totalValoresDivision;
      detalleDivision = `Asignado manualmente: ${formatearMontoResumen(distribuido)}.`;
    } else if (tipoDivision === "porcentual") {
      distribuido = (montoTotalActual * totalValoresDivision) / 100;
      detalleDivision = `Porcentaje asignado: ${totalValoresDivision}%.`;
    } else {
      distribuido = totalValoresDivision > 0 ? montoTotalActual : 0;
      detalleDivision = `Partes asignadas: ${totalValoresDivision}.`;
    }

    return {
      consumidores: consumidoresIds.length,
      detalleDivision,
      diferenciaAportes,
      diferenciaDivision: montoTotalActual - distribuido,
      distribuido,
      montoTotal: montoTotalActual,
      totalAportes,
      totalValoresDivision,
    };
  }, [
    montoTotalActual,
    consumidoresSeleccionados,
    montosExactos,
    montosPagadores,
    tipoDivision,
  ]);

  const aportesCompletos =
    resumenGasto.montoTotal > 0 &&
    Math.abs(resumenGasto.diferenciaAportes) <= 1;
  const divisionCompleta =
    resumenGasto.montoTotal > 0 &&
    resumenGasto.consumidores > 0 &&
    (tipoDivision === "por_cuotas"
      ? resumenGasto.totalValoresDivision > 0
      : Math.abs(resumenGasto.diferenciaDivision) <= 1);

  const resumenCompleto = aportesCompletos && divisionCompleta;
  const textoEstadoAportes =
    resumenGasto.montoTotal <= 0
      ? "Ingresa el monto total para comparar aportes"
      : aportesCompletos
        ? "Aportes completos"
        : resumenGasto.diferenciaAportes > 0
          ? `Faltan ${formatearMontoResumen(resumenGasto.diferenciaAportes)} en aportes`
          : `Sobran ${formatearMontoResumen(Math.abs(resumenGasto.diferenciaAportes))} en aportes`;

  const textoEstadoDivision =
    resumenGasto.montoTotal <= 0
      ? "Ingresa el monto total para ver la distribucion"
      : tipoDivision === "por_cuotas"
        ? divisionCompleta
          ? "Partes listas para distribuir el total"
          : "Asigna al menos una parte"
        : divisionCompleta
          ? "Distribucion completa"
          : resumenGasto.diferenciaDivision > 0
            ? `Faltan ${formatearMontoResumen(resumenGasto.diferenciaDivision)} por distribuir`
            : `Sobran ${formatearMontoResumen(Math.abs(resumenGasto.diferenciaDivision))} en la distribucion`;

  const previewParticipantes = useMemo(() => {
    const consumidoresIds = consumidoresSeleccionados.map(
      (p: any) => p.contacto_id,
    );

    let consumos: { contacto_id: string; parte: number }[] = [];

    try {
      if (montoTotalActual > 0 && consumidoresIds.length > 0) {
        consumos = CalculoDivision({
          monto_total: montoTotalActual,
          consumidoresID: consumidoresIds,
          tipo_division: tipoDivision,
          montosExactos,
        });
      }
    } catch {
      consumos = [];
    }

    const consumosPorContacto = new Map(
      consumos.map((consumo) => [consumo.contacto_id, Number(consumo.parte)]),
    );

    return participantes.map((p: any) => {
      const aporte = Number(montosPagadores[p.contacto_id] || 0);
      const consumo = consumosPorContacto.get(p.contacto_id) ?? 0;
      const saldo = aporte - consumo;

      return {
        aporte,
        consumo,
        nombre: p.nombre,
        saldo,
      };
    });
  }, [
    montoTotalActual,
    consumidoresSeleccionados,
    montosExactos,
    montosPagadores,
    participantes,
    tipoDivision,
  ]);

  const limpiarFormulario = () => {
    const nuevaFecha = new Date();

    reset({
      evento_id: eventoIdString,
      descripcion: "",
      monto_total: undefined,
      fecha: nuevaFecha.toISOString(),
      tipo_division: "equitativo",
    });
    setTipoDivision("equitativo");
    setMontosPagadores({});
    setSelectedConsumers({});
    setMontosExactos({});
    setFechaSeleccionada(nuevaFecha);
    setMostrarFecha(false);
  };

  async function onSubmit(data: GastoFormValues) {
    // Validar que haya al menos un pagador con aporte
    const aportes = Object.values(montosPagadores).map((v) => Number(v) || 0);
    const sumaAportes = aportes.reduce((s, v) => s + v, 0);
    if (sumaAportes <= 0) {
      Alert.alert(
        "Falta el pagador",
        "Ingresa al menos un aporte de pagador o utiliza el pagador único.",
      );
      return;
    }

    // Validación: suma aportes ≈ monto_total
    if (data.monto_total && Math.abs(sumaAportes - data.monto_total) > 1) {
      Alert.alert(
        "Aportes no coinciden",
        `La suma de aportes (${sumaAportes}) no coincide con el monto total (${data.monto_total}).`,
      );
      return;
    }

    const consumidoresIds = obtenerConsumidoresIds();

    if (consumidoresIds.length === 0) {
      Alert.alert("Consumidores vacios", "Selecciona al menos un consumidor.");
      return;
    }

    // Validaciones cliente para nuevos modos de división
    if (tipoDivision === "porcentual") {
      const totalPct = consumidoresIds.reduce(
        (s, contactoId) => s + (Number(montosExactos[contactoId]) || 0),
        0,
      );
      if (Math.abs(totalPct - 100) > 0.5) {
        Alert.alert(
          "Porcentajes incorrectos",
          `La suma de porcentajes debe ser 100 (actual: ${totalPct}).`,
        );
        return;
      }
    }

    if (tipoDivision === "por_cuotas") {
      const totalParts = consumidoresIds.reduce(
        (s, contactoId) => s + (Number(montosExactos[contactoId]) || 0),
        0,
      );
      if (totalParts <= 0) {
        Alert.alert(
          "Partes inválidas",
          "Debes asignar al menos una parte entre los participantes.",
        );
        return;
      }
    }

    try {
      setGuardando(true);

      if (!eventoIdString) {
        Alert.alert(
          "Evento no válido",
          "No se recibió el evento actual para guardar el gasto.",
        );
        return;
      }

      const consumidoresCalculados = CalculoDivision({
        monto_total: data.monto_total,
        consumidoresID: consumidoresIds,
        tipo_division: tipoDivision,
        montosExactos,
      });

      const gastosPagadoresArr = Object.entries(montosPagadores)
        .map(([contacto_id, monto]) => ({
          contacto_id,
          monto_aportado: Number(monto),
        }))
        .filter((p) => Number(p.monto_aportado) > 0);

      const gastoFinal: GastoFormData = {
        ...data,
        evento_id: eventoIdString,
        tipo_division: tipoDivision,
        gastos_pagadores: gastosPagadoresArr,
        gastos_consumidores: consumidoresCalculados,
      };

      await crearGasto(gastoFinal);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["gastos-detalle", eventoIdString],
        }),
        queryClient.invalidateQueries({ queryKey: ["gastos", eventoIdString] }),
        queryClient.invalidateQueries({ queryKey: ["total-gastos"] }),
        queryClient.invalidateQueries({ queryKey: ["actividad-reciente"] }),
        queryClient.invalidateQueries({ queryKey: ["notificaciones"] }),
        queryClient.invalidateQueries({
          queryKey: ["notificaciones-no-leidas"],
        }),
      ]);
      limpiarFormulario();
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
        <View style={styles.center}>
          <ActivityIndicator color="#FFFFFF" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <PantallaConTeclado
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 32 },
        ]}
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
                style={[
                  styles.montoInput,
                  errors.monto_total && styles.inputError,
                ]}
                value={formatearMontoInput(value ? Number(value) : undefined)}
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
                  <Feather
                    name="calendar"
                    size={16}
                    color="rgba(255,255,255,0.5)"
                  />
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

        {/* PAGADORES: permite múltiples aportes */}
        <Text style={styles.label}>Aportes (pagadores)</Text>
        <GlassCard style={styles.montosCard}>
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
                  value={formatearMontoInput(montosPagadores[p.contacto_id])}
                  placeholder="0"
                  placeholderTextColor="rgba(255,255,255,0.3)"
                  onChangeText={(text) => {
                    const limpio = text.replace(/[^0-9]/g, "");
                    setMontosPagadores((prev) => ({
                      ...prev,
                      [p.contacto_id]: limpio === "" ? 0 : Number(limpio),
                    }));
                  }}
                />
              </View>
            </View>
          ))}
        </GlassCard>

        {/* CONSUMIDORES */}
        <Text style={styles.label}>Consumidores</Text>
        <View style={styles.chipsRow}>
          {participantes.map((p: any) => {
            const seleccionado = selectedConsumers[p.contacto_id] ?? true;
            return (
              <TouchableOpacity
                key={p.contacto_id}
                style={[styles.chip, seleccionado && styles.chipActivo]}
                onPress={() =>
                  setSelectedConsumers((prev) => {
                    const siguienteSeleccion = !(prev[p.contacto_id] ?? true);

                    if (!siguienteSeleccion) {
                      setMontosExactos((montosPrevios) => {
                        const { [p.contacto_id]: _omitido, ...resto } =
                          montosPrevios;
                        return resto;
                      });
                    }

                    return {
                      ...prev,
                      [p.contacto_id]: siguienteSeleccion,
                    };
                  })
                }
              >
                <Text
                  style={[
                    styles.chipText,
                    seleccionado && styles.chipTextActivo,
                  ]}
                >
                  {p.nombre}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text
          style={{ color: "rgba(255,255,255,0.5)", fontSize: 12, marginTop: 8 }}
        >
          Selecciona al menos un consumidor para dividir el gasto.
        </Text>

        {/* TIPO DE DIVISIÓN */}
        <Text style={styles.label}>División</Text>
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tipoDivision === "equitativo" && styles.toggleActivo,
            ]}
            onPress={() => {
              setTipoDivision("equitativo");
              setValue("tipo_division", "equitativo");
            }}
          >
            <Feather
              name="users"
              size={14}
              color={
                tipoDivision === "equitativo"
                  ? "#000000"
                  : "rgba(255,255,255,0.6)"
              }
            />
            <Text
              style={[
                styles.toggleText,
                tipoDivision === "equitativo" && styles.toggleTextActivo,
              ]}
            >
              Equitativo
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tipoDivision === "montos_exactos" && styles.toggleActivo,
            ]}
            onPress={() => {
              setTipoDivision("montos_exactos");
              setValue("tipo_division", "montos_exactos");
            }}
          >
            <Feather
              name="sliders"
              size={14}
              color={
                tipoDivision === "montos_exactos"
                  ? "#000000"
                  : "rgba(255,255,255,0.6)"
              }
            />
            <Text
              style={[
                styles.toggleText,
                tipoDivision === "montos_exactos" && styles.toggleTextActivo,
              ]}
            >
              Montos exactos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tipoDivision === "porcentual" && styles.toggleActivo,
            ]}
            onPress={() => {
              setTipoDivision("porcentual");
              setValue("tipo_division", "porcentual");
            }}
          >
            <Feather
              name="percent"
              size={14}
              color={
                tipoDivision === "porcentual"
                  ? "#000000"
                  : "rgba(255,255,255,0.6)"
              }
            />
            <Text
              style={[
                styles.toggleText,
                tipoDivision === "porcentual" && styles.toggleTextActivo,
              ]}
            >
              Porcentual
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              tipoDivision === "por_cuotas" && styles.toggleActivo,
            ]}
            onPress={() => {
              setTipoDivision("por_cuotas");
              setValue("tipo_division", "por_cuotas");
            }}
          >
            <Feather
              name="pie-chart"
              size={14}
              color={
                tipoDivision === "por_cuotas"
                  ? "#000000"
                  : "rgba(255,255,255,0.6)"
              }
            />
            <Text
              style={[
                styles.toggleText,
                tipoDivision === "por_cuotas" && styles.toggleTextActivo,
              ]}
            >
              Por partes
            </Text>
          </TouchableOpacity>
        </View>

        {/* MONTOS EXACTOS */}
        {(tipoDivision === "montos_exactos" ||
          tipoDivision === "porcentual" ||
          tipoDivision === "por_cuotas") && (
          <GlassCard style={styles.montosCard}>
            <Text style={styles.montosCardTitulo}>
              {tipoDivision === "montos_exactos"
                ? "Monto por persona"
                : tipoDivision === "porcentual"
                  ? "Porcentaje por persona (%)"
                  : "Partes por persona"}
            </Text>
            {consumidoresSeleccionados.length === 0 ? (
              <Text style={styles.montosCardVacio}>
                Selecciona al menos un consumidor para asignar la division.
              </Text>
            ) : null}
            {consumidoresSeleccionados.map((p: any) => (
              <View key={p.contacto_id} style={styles.montoPersonaRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {p.nombre.substring(0, 1).toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.montoPersonaNombre}>{p.nombre}</Text>
                <View style={styles.montoPersonaInputWrap}>
                  {tipoDivision === "porcentual" ? (
                    <TextInput
                      style={styles.montoPersonaInput}
                      keyboardType="numeric"
                      value={
                        montosExactos[p.contacto_id]
                          ? String(montosExactos[p.contacto_id])
                          : ""
                      }
                      placeholder="0"
                      placeholderTextColor="rgba(255,255,255,0.3)"
                      onChangeText={(text) => {
                        const limpio = text.replace(/[^0-9\.]/g, "");
                        setMontosExactos((prev) => ({
                          ...prev,
                          [p.contacto_id]: limpio === "" ? 0 : Number(limpio),
                        }));
                      }}
                    />
                  ) : (
                    <>
                      <Text style={styles.montoPrefix}>
                        {tipoDivision === "montos_exactos" ? "$" : ""}
                      </Text>
                      <TextInput
                        style={styles.montoPersonaInput}
                        keyboardType="numeric"
                        value={
                          tipoDivision === "montos_exactos"
                            ? formatearMontoInput(montosExactos[p.contacto_id])
                            : montosExactos[p.contacto_id]
                              ? String(montosExactos[p.contacto_id])
                              : ""
                        }
                        placeholder={
                          tipoDivision === "montos_exactos" ? "0" : "1"
                        }
                        placeholderTextColor="rgba(255,255,255,0.3)"
                        onChangeText={(text) => {
                          const limpio = text.replace(/[^0-9]/g, "");
                          setMontosExactos((prev) => ({
                            ...prev,
                            [p.contacto_id]: limpio === "" ? 0 : Number(limpio),
                          }));
                        }}
                      />
                    </>
                  )}
                </View>
              </View>
            ))}
          </GlassCard>
        )}

        {/* BOTÓN SUBMIT */}
        <GlassCard
          style={[
            styles.resumenCard,
            resumenCompleto ? styles.resumenCardOk : styles.resumenCardPendiente,
          ]}
        >
          <View style={styles.resumenHeader}>
            <View style={styles.resumenIcono}>
              <Feather
                name={resumenCompleto ? "check-circle" : "alert-circle"}
                size={18}
                color={resumenCompleto ? "#4CAF50" : "#F59E0B"}
              />
            </View>
            <Text style={styles.resumenTitulo}>Resumen del gasto</Text>
          </View>

          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Monto total</Text>
            <Text style={styles.resumenValor}>
              {formatearMontoResumen(resumenGasto.montoTotal)}
            </Text>
          </View>
          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Aportes</Text>
            <Text style={styles.resumenValor}>
              {formatearMontoResumen(resumenGasto.totalAportes)}
            </Text>
          </View>
          <Text
            style={[
              styles.resumenEstado,
              aportesCompletos ? styles.resumenOk : styles.resumenPendiente,
            ]}
          >
            {textoEstadoAportes}
          </Text>

          <View style={styles.resumenSeparador} />

          <View style={styles.resumenFila}>
            <Text style={styles.resumenLabel}>Distribuido</Text>
            <Text style={styles.resumenValor}>
              {formatearMontoResumen(resumenGasto.distribuido)}
            </Text>
          </View>
          <Text style={styles.resumenDetalle}>
            {resumenGasto.detalleDivision}
          </Text>
          <Text
            style={[
              styles.resumenEstado,
              divisionCompleta ? styles.resumenOk : styles.resumenPendiente,
            ]}
          >
            {textoEstadoDivision}
          </Text>

          {previewParticipantes.length > 0 ? (
            <>
              <View style={styles.resumenSeparador} />
              <Text style={styles.previewTitulo}>Vista previa por persona</Text>
              {previewParticipantes.map((persona) => {
                const saldoTexto =
                  persona.saldo > 0
                    ? `Le deben ${formatearMontoResumen(persona.saldo)}`
                    : persona.saldo < 0
                      ? `Debe ${formatearMontoResumen(Math.abs(persona.saldo))}`
                      : "Queda al dia";

                return (
                  <View key={persona.nombre} style={styles.previewPersonaRow}>
                    <View style={styles.previewPersonaInfo}>
                      <Text style={styles.previewNombre}>{persona.nombre}</Text>
                      <Text style={styles.previewDetalle}>
                        Aporta {formatearMontoResumen(persona.aporte)} · Consume{" "}
                        {formatearMontoResumen(persona.consumo)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.previewSaldo,
                        persona.saldo > 0
                          ? styles.resumenOk
                          : persona.saldo < 0
                            ? styles.previewDebe
                            : styles.resumenLabel,
                      ]}
                    >
                      {saldoTexto}
                    </Text>
                  </View>
                );
              })}
            </>
          ) : null}
        </GlassCard>

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
      </PantallaConTeclado>
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
    flexWrap: "wrap",
    gap: 10,
  },
  toggleBtn: {
    width: "48%",
    flexGrow: 1,
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
  montosCardVacio: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
    lineHeight: 18,
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
  resumenCard: {
    marginTop: 22,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  resumenCardOk: {
    borderColor: "rgba(76,175,80,0.45)",
    backgroundColor: "rgba(76,175,80,0.08)",
  },
  resumenCardPendiente: {
    borderColor: "rgba(245,158,11,0.45)",
    backgroundColor: "rgba(245,158,11,0.08)",
  },
  resumenHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  resumenIcono: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  resumenTitulo: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  resumenFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  resumenLabel: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 13,
  },
  resumenValor: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  resumenEstado: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 8,
  },
  resumenOk: {
    color: "#4CAF50",
  },
  resumenPendiente: {
    color: "#F59E0B",
  },
  resumenSeparador: {
    height: 1,
    marginVertical: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  resumenDetalle: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 12,
    marginTop: 6,
  },
  previewTitulo: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  previewPersonaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  previewPersonaInfo: {
    flex: 1,
    minWidth: 0,
  },
  previewNombre: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  previewDetalle: {
    color: "rgba(255,255,255,0.52)",
    fontSize: 12,
    marginTop: 3,
  },
  previewSaldo: {
    maxWidth: 120,
    textAlign: "right",
    fontSize: 12,
    fontWeight: "800",
  },
  previewDebe: {
    color: "#FF6B6B",
  },

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
