import { View } from "react-native";

// Barra de progreso del wizard de registro: un segmento por paso.
export function PasoBarra({ paso, total }: { paso: number; total: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginBottom: 28 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: 3,
            borderRadius: 2,
            backgroundColor: i < paso ? "#fff" : "#333",
          }}
        />
      ))}
    </View>
  );
}
