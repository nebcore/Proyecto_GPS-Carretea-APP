import { useState } from "react";
import { Controller, Resolver, useForm } from "react-hook-form";
import { Alert, Button, ScrollView, Text, TextInput, View } from "react-native";

import { zodResolver } from "@hookform/resolvers/zod";

import { crearGasto, GastoFormData, gastoSchema } from "../../lib/api/gastos";
import { CalculoDivision, TipoDivision } from "../../lib/api/gastos_logic";

type Participante = {
    contacto_id: string;
    nombre: string;
    rol: string;
};

type Props = {
    eventoId: string;
    participantes: Participante[];
};

export function FormGasto({
    eventoId,
    participantes,
}: Props) {
    const [tipoDivision, setTipoDivision] = useState<TipoDivision>("equitativo");
    const [pagadorId, setPagadorId] = useState<string>(participantes[0]?.contacto_id || "");
    const [montosExactos, setMontosExactos] = useState<Record<string, number>>({});

    const resolver = zodResolver(gastoSchema) as Resolver<GastoFormData>;

    const {control, handleSubmit, setValue, formState: {errors}} = useForm<GastoFormData>({
        resolver,
        defaultValues: {
            evento_id: eventoId,
            descripcion: "",
            categoria: "",
            monto_total: 0,
            fecha: new Date().toISOString(),
            tipo_division: "equitativo",
            gastos_pagadores: [],
            gastos_consumidores: [],
        },
    });

  async function onSubmit(data: GastoFormData) {
    try {

      const consumidoresIds = participantes.map(
        (participante) => participante.contacto_id
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
        gastos_pagadores: [{
            contacto_id: pagadorId,
            monto_aportado: data.monto_total,
        }],
        gastos_consumidores: consumidoresCalculados,
      } as unknown as GastoFormData;

      await crearGasto(gastoFinal);

      Alert.alert("Gasto Creado!", 
        "El gasto ha sido creado con exito."
      );
    }catch (error: any) {
        Alert.alert("Error", error.message || "Fallo al crear el gasto.");

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
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
            }}
          />
        )}
      />
      {errors.descripcion && (
        <Text>{errors.descripcion.message}</Text>
      )}

      <Text>Categoría</Text>
      <Controller
        control={control}
        name="categoria"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value || ""}
            onChangeText={onChange}
            placeholder="Ej: Comida, transporte, entrada"
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
            }}
          />
        )}
      />

      <Text>Monto total</Text>
      <Controller
        control={control}
        name="monto_total"
        render={({ field: { onChange, value } }) => (
          <TextInput
            keyboardType="numeric"
            value={String(value)}
            onChangeText={(text) => onChange(Number(text))}
            placeholder="Ej: 15000"
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
            }}
          />
        )}
      />
      {errors.monto_total && (
        <Text>{errors.monto_total.message}</Text>
      )}

      <Text>Fecha</Text>
      <Controller
        control={control}
        name="fecha"
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="YYYY-MM-DD"
            style={{
              borderWidth: 1,
              padding: 10,
              borderRadius: 8,
            }}
          />
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
        title={
          tipoDivision === "equitativo"
            ? "✓ Equitativo"
            : "Equitativo"
        }
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
                placeholder="Monto"
                onChangeText={(text) => {
                  setMontosExactos((prev) => ({
                    ...prev,
                    [participante.contacto_id]: Number(text),
                  }));
                }}
                style={{
                  borderWidth: 1,
                  padding: 10,
                  borderRadius: 8,
                }}
              />
            </View>
          ))}
        </View>
      )}

      <Button
        title="Guardar gasto"
        onPress={handleSubmit(onSubmit)}
      />
    </ScrollView>
  );
}