import Feather from "@expo/vector-icons/Feather";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  mostrarVolver?: boolean;
  onVolver?: () => void;
};

export default function Header({ mostrarVolver = false, onVolver }: Props) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity style={styles.iconBtn} onPress={onVolver}>
        {mostrarVolver ? (
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        ) : (
          <Feather name="user" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      <Text style={styles.titulo} pointerEvents="none">
        CARRETEA
      </Text>

      <View style={styles.rightIcons}>
        <TouchableOpacity style={styles.iconBtn}>
          <Feather name="search" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <Feather name="menu" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(18, 18, 18, 0.8)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.1)",
  },
  titulo: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
    letterSpacing: 4,
    position: "absolute",
    textAlign: "center",
    left: 0,
    right: 0,
    paddingTop: 24,
  },
  rightIcons: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
