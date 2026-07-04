import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { supabase } from "../supabase";

// Configura cómo reacciona la app si recibe una notificación estando abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registrarParaNotificacionesPush(usuarioId: string) {
  if (!Device.isDevice) {
    console.log(
      "Debes usar un dispositivo físico para probar las notificaciones push nativas.",
    );
    return;
  }

  // Verificar permisos actuales
  const { status: statusExistente } = await Notifications.getPermissionsAsync();
  let statusFinal = statusExistente;

  // Si no hay permisos, solicitarlos
  if (statusExistente !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    statusFinal = status;
  }

  if (statusFinal !== "granted") {
    console.log("¡Permiso de notificaciones push denegado por el usuario!");
    return;
  }

  try {
    // Obtener el Token único de Expo para este dispositivo
    const tokenData = await Notifications.getExpoPushTokenAsync({
      // NOTA: Reemplazar por el projectId real que obtienen en el dashboard de Expo (EAS)
      // O configurado en su app.json
      projectId: "bfa7d408-cef6-4c7c-916b-d75a55911bb5",
    });

    const token = tokenData.data;

    // Configuración obligatoria del canal de alertas para Android
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: "#FF231F71",
      });
    }

    // Guardar o actualizar el token en el perfil de Supabase del usuario
    const { error } = await supabase
      .from("usuarios")
      .update({ push_token: token })
      .eq("id", usuarioId);

    if (error) throw error;
  } catch (error) {
    console.error("Error al registrar las notificaciones push:", error);
  }
}
