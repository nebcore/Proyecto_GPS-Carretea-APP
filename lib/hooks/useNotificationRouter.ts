import Constants, { ExecutionEnvironment } from "expo-constants";
import { useRouter } from "expo-router";
import { useEffect } from "react";

// Mismo motivo que en lib/api/pushNotifications.ts: `expo-notifications`
// rompe apenas se importa dentro de Expo Go, así que se carga dinámicamente
// y se evita por completo ahí.
const esExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
const Notifications = esExpoGo
  ? null
  : (require("expo-notifications") as typeof import("expo-notifications"));

export function useNotificationRouter(
  autenticado: boolean,
  cargandoAuth: boolean,
) {
  const router = useRouter();

  useEffect(() => {
    // Si la autenticación aún se está cargando, esperamos.
    // Esto evita que intentemos navegar antes de que el AuthGate sepa si hay sesión.
    if (!Notifications || cargandoAuth || !autenticado) return;

    // --- La app está abierta o en segundo plano (Background/Foreground Clicks) ---
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const eventoId = response.notification.request.content.data?.eventoId;

        if (eventoId) {
          router.push({
            pathname: "/(tabs)/eventoDetalle",
            params: { eventoId: String(eventoId) },
          });
        }
      },
    );

    // --- La app estaba COMPLETAMENTE CERRADA (Cold Start) ---
    Notifications.getLastNotificationResponseAsync().then((response) => {
      const eventoId = response?.notification.request.content.data?.eventoId;

      if (eventoId) {
        // Le damos un pequeño respiro (500ms) para que las pantallas nativas y
        // el AuthGate terminen de montar la vista principal antes de redirigir.
        setTimeout(() => {
          router.push({
            pathname: "/(tabs)/eventoDetalle",
            params: { eventoId: String(eventoId) },
          });
        }, 500);
      }
    });

    return () => subscription.remove();
  }, [autenticado, cargandoAuth, router]);
}
