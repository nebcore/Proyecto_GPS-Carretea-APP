import { useThemeColor } from "@/hooks/use-theme-color";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";
import {
  Alert,
  Button,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";
import DateTimePicker from "@react-native-community/datetimepicker";

import {
  crearGasto,
  GastoFormData,
  gastoFormSchema,
  GastoFormValues,
} from "../lib/api/gastos";
import { CalculoDivision, TipoDivision } from "../lib/api/gastos_logic";

type Participante = {
  contacto_id: string;
  nombre: string;
  rol: string;
};

type Props = {
  eventoId: string;
  participantes: Participante[];
};

export function FormGasto({ eventoId, participantes }: Props) {
  const [tipoDivision, setTipoDivision] = useState<TipoDivision>("equitativo");
  const [pagadorId, setPagadorId] = useState<string>(
    participantes[0]?.contacto_id || "",
  );
  const [montosPagadores, setMontosPagadores] = useState<
    Record<string, number>
  >({});
  const [selectedPagadores, setSelectedPagadores] = useState<
    Record<string, boolean>
  >(
    Object.fromEntries(
      participantes.map((p, i) => [p.contacto_id, i === 0]),
    ) as Record<string, boolean>,
  );
  const [selectedConsumers, setSelectedConsumers] = useState<
    Record<string, boolean>
  >({});
  const [montosExactos, setMontosExactos] = useState<Record<string, number>>(
    {},
  );

  const [mostrarCalendario, setMostrarCalendario] = useState(false);
  const [mostrarReloj, setMostrarReloj] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState<Date>(new Date());
  const [guardando, setGuardando] = useState(false);

  const resolver = zodResolver(gastoFormSchema) as Resolver<GastoFormValues>;

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<GastoFormValues>({
    resolver,
    defaultValues: {
      evento_id: eventoId,
      descripcion: "",
      categoria: undefined,
      monto_total: undefined as unknown as number,
      fecha: new Date().toISOString(),
      tipo_division: "equitativo",
    },
  });

  const inputBg = useThemeColor({ light: "#fff", dark: "#222" }, "background");
  const inputColor = useThemeColor({}, "text");

  const inputStyle = {
    backgroundColor: inputBg,
    color: inputColor,
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
  } as any;

  const selectorStyle = {
    backgroundColor: inputBg,
    borderWidth: 1,
    padding: 12,
    borderRadius: 8,
  } as any;

  function formatearFecha(fechaISO?: string) {
    if (!fechaISO) return "Seleccionar fecha";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }

  function formatearHora(fechaISO?: string) {
    if (!fechaISO) return "Seleccionar hora";

    const fecha = new Date(fechaISO);

    return fecha.toLocaleTimeString("es-CL", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function actualizarFechaCompleta(
    nuevaFecha: Date,
    onChange: (value: string) => void,
  ) {
    setFechaSeleccionada(nuevaFecha);
    onChange(nuevaFecha.toISOString());
  }

  function onInvalid(errors: any) {
    const mensajes = Object.values(errors)
      .map((err: any) => err.message)
      .filter(Boolean)
      .join("\n");

    Alert.alert(
      "Errores en el formulario",
      mensajes || "Por favor revisa los campos del formulario.",
    );
  }

  const obtenerConsumidoresIds = () =>
    participantes
      .filter(
        (participante) =>
          selectedConsumers[participante.contacto_id] ?? true,
      )
      .map((participante) => participante.contacto_id);

  const limpiarFormulario = () => {
    const nuevaFecha = new Date();

    reset({
      evento_id: eventoId,
      descripcion: "",
      categoria: undefined,
      monto_total: undefined as unknown as number,
      fecha: nuevaFecha.toISOString(),
      tipo_division: "equitativo",
    });
    setTipoDivision("equitativo");
    setPagadorId(participantes[0]?.contacto_id || "");
    setMontosPagadores({});
    setSelectedPagadores(
      Object.fromEntries(
        participantes.map((p, i) => [p.contacto_id, i === 0]),
      ) as Record<string, boolean>,
    );
    setSelectedConsumers({});
    setMontosExactos({});
    setFechaSeleccionada(nuevaFecha);
    setMostrarCalendario(false);
    setMostrarReloj(false);
  };

  async function onSubmit(data: GastoFormValues) {
    try {
      setGuardando(true);
      const consumidoresIds = obtenerConsumidoresIds();

      if (consumidoresIds.length === 0) {
        Alert.alert(
          "Consumidores vacíos",
          "Selecciona al menos un consumidor.",
        );
        setGuardando(false);
        return;
      }

      // Validaciones cliente para porcentual y por_cuotas
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
          setGuardando(false);
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
          setGuardando(false);
          return;
        }
      }

      // Validar y construir aportes de pagadores
      const aportes = Object.values(montosPagadores).map((v) => Number(v) || 0);
      const sumaAportes = aportes.reduce((s, v) => s + v, 0);
      if (sumaAportes <= 0) {
        Alert.alert(
          "Falta el pagador",
          "Ingresa al menos un aporte de pagador.",
        );
        setGuardando(false);
        return;
      }
      if (data.monto_total && Math.abs(sumaAportes - data.monto_total) > 1) {
        Alert.alert(
          "Aportes no coinciden",
          `La suma de aportes (${sumaAportes}) no coincide con el monto total (${data.monto_total}).`,
        );
        setGuardando(false);
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
        tipo_division: tipoDivision,
        gastos_pagadores: gastosPagadoresArr,
        gastos_consumidores: consumidoresCalculados,
      };

      await crearGasto(gastoFinal);
      limpiarFormulario();

      Alert.alert("Gasto creado", "El gasto ha sido creado con éxito.");
      router.back();
    } catch (error: any) {
      const msg =
        error?.message ||
        (error?.errors
          ? error.errors.map((e: any) => e.message).join("\n")
          : JSON.stringify(error));

      Alert.alert("Error", msg || "Falló al crear el gasto.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ gap: 12, padding: 16 }}>
      <Text>Descripción del gasto</Text>
      <Controller
        control={control}
        name="descripcion"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Ej: Compra de comida"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        )}
      />
      {errors.descripcion && <Text>{errors.descripcion.message}</Text>}

      <Text>Monto total</Text>
      <Controller
        control={control}
        name="monto_total"
        render={({ field: { onChange, value } }) => (
          <TextInput
            keyboardType="numeric"
            value={value ? String(value) : ""}
            onChangeText={(text) => {
              const limpio = text.replace(/[^0-9]/g, "");
              onChange(limpio === "" ? undefined : Number(limpio));
            }}
            placeholder="Ej: 15000"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        )}
      />
      {errors.monto_total && <Text>{errors.monto_total.message}</Text>}

      <Text>Fecha y hora</Text>

      {errors.fecha && <Text>{errors.fecha.message}</Text>}

      <Controller
        control={control}
        name="fecha"
        render={({ field: { onChange, value } }) => (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable
                onPress={() => setMostrarCalendario(true)}
                style={[selectorStyle, { flex: 1 }]}
              >
                <Text style={{ color: inputColor, fontWeight: "600" }}>
                  Fecha
                </Text>
                <Text style={{ color: inputColor }}>
                  {formatearFecha(value)}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setMostrarReloj(true)}
                style={[selectorStyle, { flex: 1 }]}
              >
                <Text style={{ color: inputColor, fontWeight: "600" }}>
                  Hora
                </Text>
                <Text style={{ color: inputColor }}>
                  {formatearHora(value)}
                </Text>
              </Pressable>
            </View>

            {mostrarCalendario && (
              <DateTimePicker
                value={fechaSeleccionada}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "calendar"}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === "android") {
                    setMostrarCalendario(false);
                  }

                  if (selectedDate) {
                    const nuevaFecha = new Date(fechaSeleccionada);

                    nuevaFecha.setFullYear(selectedDate.getFullYear());
                    nuevaFecha.setMonth(selectedDate.getMonth());
                    nuevaFecha.setDate(selectedDate.getDate());

                    actualizarFechaCompleta(nuevaFecha, onChange);
                  }
                }}
              />
            )}

            {Platform.OS === "ios" && mostrarCalendario && (
              <Button
                title="Confirmar fecha"
                onPress={() => setMostrarCalendario(false)}
              />
            )}

            {mostrarReloj && (
              <DateTimePicker
                value={fechaSeleccionada}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "clock"}
                is24Hour={true}
                onChange={(event, selectedDate) => {
                  if (Platform.OS === "android") {
                    setMostrarReloj(false);
                  }

                  if (selectedDate) {
                    const nuevaFecha = new Date(fechaSeleccionada);

                    nuevaFecha.setHours(selectedDate.getHours());
                    nuevaFecha.setMinutes(selectedDate.getMinutes());
                    nuevaFecha.setSeconds(0);
                    nuevaFecha.setMilliseconds(0);

                    actualizarFechaCompleta(nuevaFecha, onChange);
                  }
                }}
              />
            )}

            {Platform.OS === "ios" && mostrarReloj && (
              <Button
                title="Confirmar hora"
                onPress={() => setMostrarReloj(false)}
              />
            )}
          </View>
        )}
      />

      <Text>Aportes (pagadores)</Text>
      <View style={{ gap: 8 }}>
        {participantes.map((participante) => (
          <View
            key={participante.contacto_id}
            style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
          >
            <Pressable
              onPress={() =>
                setSelectedPagadores((prev) => ({
                  ...prev,
                  [participante.contacto_id]: !(
                    prev[participante.contacto_id] ?? false
                  ),
                }))
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: 6,
                borderWidth: 1,
                borderColor: "#D1D5DB",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selectedPagadores[participante.contacto_id]
                  ? "#10B981"
                  : "transparent",
              }}
            >
              <Text
                style={{
                  color: selectedPagadores[participante.contacto_id]
                    ? "#fff"
                    : "#000",
                }}
              >
                {selectedPagadores[participante.contacto_id] ? "✓" : "+"}
              </Text>
            </Pressable>

            <Text style={{ flex: 1 }}>{participante.nombre}</Text>
            <TextInput
              keyboardType="numeric"
              value={
                montosPagadores[participante.contacto_id]
                  ? String(montosPagadores[participante.contacto_id])
                  : ""
              }
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              editable={selectedPagadores[participante.contacto_id] ?? false}
              onChangeText={(text) => {
                const limpio = text.replace(/[^0-9]/g, "");
                setMontosPagadores((prev) => ({
                  ...prev,
                  [participante.contacto_id]:
                    limpio === "" ? 0 : Number(limpio),
                }));
              }}
              style={[
                inputStyle,
                {
                  width: 120,
                  opacity: selectedPagadores[participante.contacto_id]
                    ? 1
                    : 0.5,
                },
              ]}
            />
          </View>
        ))}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "flex-end",
            marginTop: 6,
          }}
        >
          <Text style={{ color: "#6B7280" }}>
            Total aportes:{" "}
            {Object.entries(montosPagadores).reduce(
              (s, [id, v]) =>
                s + ((selectedPagadores[id] ?? false) ? Number(v || 0) : 0),
              0,
            )}
          </Text>
        </View>
      </View>

      <Text style={{ marginTop: 16 }}>Consumidores</Text>
      <View
        style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}
      >
        {participantes.map((participante) => {
          const seleccionado =
            selectedConsumers[participante.contacto_id] ?? true;
          return (
            <Pressable
              key={participante.contacto_id}
              onPress={() =>
                setSelectedConsumers((prev) => ({
                  ...prev,
                  [participante.contacto_id]: !(
                    prev[participante.contacto_id] ?? true
                  ),
                }))
              }
              style={{
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 20,
                backgroundColor: seleccionado ? "#FFFFFF" : "rgba(0,0,0,0.08)",
              }}
            >
              <Text style={{ color: seleccionado ? "#000" : "#666" }}>
                {participante.nombre}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 8 }}>
        Si no seleccionas ninguno se usarán todos los participantes
      </Text>

      <Text>Tipo de división</Text>

      <Button
        title={tipoDivision === "equitativo" ? "✓ Equitativo" : "Equitativo"}
        onPress={() => {
          setTipoDivision("equitativo");
          setValue("tipo_division", "equitativo");
        }}
      />

      <Button
        title={
          tipoDivision === "montos_exactos"
            ? "✓ Montos exactos"
            : "Montos exactos"
        }
        onPress={() => {
          setTipoDivision("montos_exactos");
          setValue("tipo_division", "montos_exactos");
        }}
      />

      <Button
        title={tipoDivision === "porcentual" ? "✓ Porcentual" : "Porcentual"}
        onPress={() => {
          setTipoDivision("porcentual");
          setValue("tipo_division", "porcentual");
        }}
      />

      <Button
        title={tipoDivision === "por_cuotas" ? "✓ Por cuotas" : "Por cuotas"}
        onPress={() => {
          setTipoDivision("por_cuotas");
          setValue("tipo_division", "por_cuotas");
        }}
      />

      {tipoDivision === "montos_exactos" ||
      tipoDivision === "porcentual" ||
      tipoDivision === "por_cuotas" ? (
        <View style={{ gap: 10 }}>
          <Text>
            {tipoDivision === "montos_exactos"
              ? "Montos exactos por consumidor"
              : tipoDivision === "porcentual"
                ? "Porcentaje por consumidor (%)"
                : "Partes por consumidor"}
          </Text>

          {participantes.map((participante) => (
            <View key={participante.contacto_id}>
              <Text>{participante.nombre}</Text>
              <TextInput
                keyboardType="numeric"
                value={
                  montosExactos[participante.contacto_id]
                    ? String(montosExactos[participante.contacto_id])
                    : ""
                }
                placeholder={
                  tipoDivision === "montos_exactos"
                    ? `Monto ${participante.nombre}`
                    : tipoDivision === "porcentual"
                      ? `Pct ${participante.nombre}`
                      : `Partes ${participante.nombre}`
                }
                placeholderTextColor="#9CA3AF"
                onChangeText={(text) => {
                  const limpio = text.replace(/[^0-9\.]/g, "");

                  setMontosExactos((prev) => ({
                    ...prev,
                    [participante.contacto_id]:
                      limpio === "" ? 0 : Number(limpio),
                  }));
                }}
                style={inputStyle}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Button
        title={guardando ? "Guardando..." : "Guardar gasto"}
        onPress={handleSubmit(onSubmit, onInvalid)}
        disabled={guardando}
      />
    </ScrollView>
  );
}
