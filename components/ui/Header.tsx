import { getUsuarioPerfil } from "@/lib/api/auth";
import Feather from "@expo/vector-icons/Feather";
import { useQuery } from "@tanstack/react-query";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  mostrarVolver?: boolean;
  onVolver?: () => void;
};

export default function Header({ mostrarVolver = false, onVolver }: Props) {
  const insets = useSafeAreaInsets();
  const { data: perfil } = useQuery({
    queryKey: ["perfil"],
    queryFn: getUsuarioPerfil,
    enabled: !mostrarVolver,
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <TouchableOpacity
        style={styles.iconBtn}
        onPress={onVolver}
        hitSlop={16}
        activeOpacity={0.7}
      >
        {mostrarVolver ? (
          <Feather name="arrow-left" size={20} color="#FFFFFF" />
        ) : perfil?.foto_url ? (
          <Image
            source={{ uri: perfil.foto_url }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <Feather name="user" size={20} color="#FFFFFF" />
        )}
      </TouchableOpacity>

      <Text style={styles.titulo} pointerEvents="none">
        CARRETEA
      </Text>

      <View style={styles.rightSpacer} />
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
    zIndex: 0,
  },
  rightSpacer: { width: 38, height: 38, zIndex: 2 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    zIndex: 2,
    elevation: 2,
  },
  avatarImage: { width: "100%", height: "100%" },
});
