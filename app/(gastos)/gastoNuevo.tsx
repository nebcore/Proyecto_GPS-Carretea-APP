import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

import { FormGasto } from "../../components/formGasto";
import { asegurarUsuarioParticipaEnEvento } from "../../lib/api/eventos";
import { obtenerParticipantesEvento } from "../../lib/api/gastos";

type Participante = {
  contacto_id: string;
  nombre: string;
  rol: string;
};

export default function NuevoGastoScreen() {
  const { eventoId } = useLocalSearchParams();

  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarParticipantes() {
      try {
        setCargando(true);
        setError(null);

        if (!eventoId) {
          throw new Error("No se recibió el ID del evento.");
        }

        await asegurarUsuarioParticipaEnEvento(String(eventoId)).catch(() => {
          // Si falla, se intentará cargar igual el formulario.
        });

        const data = await obtenerParticipantesEvento(String(eventoId));

        const participantesFormateados: Participante[] = data.map(
          (item: any) => ({
            contacto_id: item.contacto_id,
            nombre: item.contactos?.nombre || "Sin nombre",
            rol: item.rol || "participante",
          }),
        );

        setParticipantes(participantesFormateados);
      } catch (err: any) {
        setError(err.message || "No se pudieron cargar los participantes.");
      } finally {
        setCargando(false);
      }
    }

    cargarParticipantes();
  }, [eventoId]);

  if (cargando) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
        }}
      >
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Cargando participantes...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 20,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>
          No se pudo abrir el formulario
        </Text>

        <Text>{error}</Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: "#111827",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (participantes.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          padding: 20,
          gap: 12,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>
          No hay participantes
        </Text>

        <Text>
          Este evento todavía no tiene participantes registrados. Para crear un
          gasto, primero deben existir contactos asociados al evento.
        </Text>

        <TouchableOpacity
          onPress={() => router.back()}
          style={{
            backgroundColor: "#111827",
            padding: 12,
            borderRadius: 8,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "white", fontWeight: "bold" }}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        paddingBottom: 24,
      }}
    >
      <View style={{ padding: 16, gap: 4 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>
          Registrar gasto
        </Text>

        <Text style={{ fontSize: 14, opacity: 0.7 }}>
          Completa los datos del gasto asociado al evento.
        </Text>
      </View>

      <FormGasto eventoId={String(eventoId)} participantes={participantes} />
    </ScrollView>
  );
}
