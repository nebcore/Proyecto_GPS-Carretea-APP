import { useLocalSearchParams } from "expo-router";
import React from "react";
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useBalancesEvento } from "../../lib/realtime/useBalancesEvento";

export default function SaldosScreen() {
  const { eventoId } = useLocalSearchParams();

  if (!eventoId) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>
          No se recibió `eventoId` en los parámetros.
        </Text>
      </View>
    );
  }

  const { balances, deudas, isLoading, error } = useBalancesEvento(
    String(eventoId),
  );

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Cargando saldos...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Error cargando saldos: {String(error)}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Saldos del evento</Text>

      <Text style={styles.sectionTitle}>Balances</Text>
      <FlatList
        data={balances}
        keyExtractor={(item) => item.contactoId}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>{item.contactoId}</Text>
            <Text
              style={[
                styles.amount,
                item.balance < 0 ? styles.negative : styles.positive,
              ]}
            >
              {item.balance < 0
                ? `Debe ${Math.abs(item.balance)}`
                : `Le deben ${item.balance}`}
            </Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.message}>Sin balances aún.</Text>
        )}
      />

      <Text style={[styles.sectionTitle, { marginTop: 16 }]}>
        Deudas sugeridas (simplificación)
      </Text>
      <FlatList
        data={deudas}
        keyExtractor={(item, idx) =>
          `${item.deudorId}-${item.acreedorId}-${idx}`
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.name}>
              {item.deudorId} → {item.acreedorId}
            </Text>
            <Text style={styles.amount}>{item.monto}</Text>
          </View>
        )}
        ListEmptyComponent={() => (
          <Text style={styles.message}>No hay deudas pendientes.</Text>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#F9FAFB" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#EEE",
  },
  name: { fontSize: 14, color: "#111" },
  amount: { fontSize: 14, fontWeight: "600" },
  negative: { color: "#D9534F" },
  positive: { color: "#16A34A" },
  message: { color: "#666" },
  error: { color: "#D9534F" },
});
