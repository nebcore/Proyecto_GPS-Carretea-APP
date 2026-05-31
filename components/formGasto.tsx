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
    setValue,
    formState: { errors },
  } = useForm<GastoFormValues>({
    resolver,
    defaultValues: {
      evento_id: eventoId,
      descripcion: "",
      categoria: "",
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

  async function onSubmit(data: GastoFormValues) {
    try {
      setGuardando(true);
      const consumidoresIds = participantes.map(
        (participante) => participante.contacto_id,
      );

      const consumidoresCalculados = CalculoDivision({
        monto_total: data.monto_total,
        consumidoresID: consumidoresIds,
        tipo_division: tipoDivision,
        montosExactos,
      });

      const gastoFinal: GastoFormData = {
        ...data,
        tipo_division: tipoDivision,
        gastos_pagadores: [
          {
            contacto_id: pagadorId,
            monto_aportado: data.monto_total,
          },
        ],
        gastos_consumidores: consumidoresCalculados,
      };

      await crearGasto(gastoFinal);

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

      <Text>Categoría</Text>
      <Controller
        control={control}
        name="categoria"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value || ""}
            onChangeText={onChange}
            placeholder="Ej: Comida, transporte, entrada"
            placeholderTextColor="#9CA3AF"
            style={inputStyle}
          />
        )}
      />
      {errors.categoria && <Text>{errors.categoria.message}</Text>}

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

      <Text>Pagador</Text>

      {participantes.map((participante) => (
        <Button
          key={participante.contacto_id}
          title={
            pagadorId === participante.contacto_id
              ? `✓ ${participante.nombre}`
              : participante.nombre
          }
          onPress={() => setPagadorId(participante.contacto_id)}
        />
      ))}

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

      {tipoDivision === "montos_exactos" && (
        <View style={{ gap: 10 }}>
          <Text>Montos exactos por consumidor</Text>

          {participantes.map((participante) => (
            <View key={participante.contacto_id}>
              <Text>{participante.nombre}</Text>
              <TextInput
                keyboardType="numeric"
                placeholder={`Monto ${participante.nombre}`}
                placeholderTextColor="#9CA3AF"
                onChangeText={(text) => {
                  const limpio = text.replace(/[^0-9]/g, "");

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
      )}

      <Button
        title={guardando ? "Guardando..." : "Guardar gasto"}
        onPress={handleSubmit(onSubmit, onInvalid)}
        disabled={guardando}
      />
    </ScrollView>
  );
}
