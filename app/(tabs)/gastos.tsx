import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { obtenerParticipantesEvento } from '@/lib/api/gastos';
import { FormGasto } from '../../components/formGasto';

type Participante = {
  contacto_id: string;
  nombre: string;
  rol: string;
};

const EVENTO_ID_PRUEBA = '8bddc371-43ad-4aee-8932-f8ea0bb4e149';

export default function GastosTabScreen() {
  const [participantes, setParticipantes] = useState<Participante[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargarParticipantes() {
      try {
        setCargando(true);
        setError(null);

        const data = await obtenerParticipantesEvento(EVENTO_ID_PRUEBA);

        const participantesFormateados: Participante[] = data.map((item: any) => ({
          contacto_id: item.contacto_id,
          nombre: item.contactos?.nombre || 'Sin nombre',
          rol: item.rol || 'participante',
        }));

        setParticipantes(participantesFormateados);
      } catch (err: any) {
        console.log('Error al cargar participantes:', err);
        setError(err.message || 'No se pudieron cargar los participantes.');
      } finally {
        setCargando(false);
      }
    }

    cargarParticipantes();
  }, []);

  if (cargando) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" />
        <ThemedText style={styles.message}>
          Cargando participantes...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title">Error</ThemedText>
        <ThemedText style={styles.message}>{error}</ThemedText>
      </ThemedView>
    );
  }

  if (participantes.length === 0) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText type="title">Sin participantes</ThemedText>
        <ThemedText style={styles.message}>
          El evento de prueba no tiene participantes registrados.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Registrar gasto</ThemedText>
        <ThemedText style={styles.subtitle}>
          Pantalla temporal para probar el módulo de gastos.
        </ThemedText>
      </View>

      <FormGasto
        eventoId={EVENTO_ID_PRUEBA}
        participantes={participantes}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  header: {
    padding: 16,
    paddingBottom: 4,
    gap: 4,
  },
  subtitle: {
    opacity: 0.7,
  },
  message: {
    textAlign: 'center',
  },
});