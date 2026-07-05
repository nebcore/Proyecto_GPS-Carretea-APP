import { HapticTab } from "@/components/haptic-tab";
import Header from "@/components/ui/Header";
import Feather from "@expo/vector-icons/Feather";
import { useNavigation } from "@react-navigation/native";
import { router, Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const HeaderConVolver = () => {
  const navigation = useNavigation();

  const volver = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }

    router.replace("/(tabs)/eventos");
  };

  return <Header mostrarVolver onVolver={volver} />;
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        header: () => <Header />,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: "#FFFFFF",
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarStyle: {
          backgroundColor: "rgba(18, 18, 18, 0.8)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.1)",
          height: 54 + insets.bottom,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color }) => (
            <Feather name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="eventos"
        options={{
          title: "Eventos",
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color }) => (
            <Feather name="book" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <Feather name="user" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="saldos"
        options={{
          title: "Más",
          tabBarIcon: ({ color }) => (
            <Feather name="more-horizontal" size={22} color={color} />
          ),
          href: null,
          header: () => <HeaderConVolver />,
        }}
      />
      <Tabs.Screen
        name="eventoDetalle"
        options={{ href: null, header: () => <HeaderConVolver /> }}
      />
      <Tabs.Screen
        name="gastoNuevo"
        options={{ href: null, header: () => <HeaderConVolver /> }}
      />
      <Tabs.Screen
        name="nuevoEvento"
        options={{ href: null, header: () => <HeaderConVolver /> }}
      />
      <Tabs.Screen
        name="notificaciones"
        options={{ href: null, header: () => <HeaderConVolver /> }}
      />
    </Tabs>
  );
}
