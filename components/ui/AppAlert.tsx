import Feather from "@expo/vector-icons/Feather";
import { useEffect, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type AppAlertButtonStyle = "default" | "cancel" | "destructive";

type AppAlertButton = {
  text?: string;
  onPress?: () => void;
  style?: AppAlertButtonStyle;
};

type AppAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

type AppAlertConfig = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  options?: AppAlertOptions;
};

type Icono = { name: keyof typeof Feather.glyphMap; color: string };

let mostrarAlerta: ((config: AppAlertConfig) => void) | null = null;

function resolverIcono(title: string, buttons?: AppAlertButton[]): Icono {
  if (buttons?.some((b) => b.style === "destructive")) {
    return { name: "alert-triangle", color: "#FF6B6B" };
  }

  const t = title.toLowerCase();
  if (t.includes("error") || t.includes("no se pudo")) {
    return { name: "alert-circle", color: "#FF6B6B" };
  }
  if (
    t.includes("listo") ||
    t.includes("guardado") ||
    t.includes("éxito") ||
    t.includes("exito") ||
    t.includes("creado") ||
    t.includes("importad") ||
    t.includes("agregad") ||
    t.includes("verificad")
  ) {
    return { name: "check-circle", color: "#4CAF50" };
  }
  return { name: "info", color: "#FFFFFF" };
}

export const Alert = {
  alert(
    title: string,
    message?: string,
    buttons?: AppAlertButton[],
    options?: AppAlertOptions,
  ) {
    mostrarAlerta?.({ title, message, buttons, options });
  },
};

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppAlertConfig | null>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mostrarAlerta = (nuevoConfig) => setConfig(nuevoConfig);
    return () => {
      mostrarAlerta = null;
    };
  }, []);

  const cerrar = () => {
    setConfig(null);
  };

  const manejarCancelar = () => {
    if (config?.options?.cancelable === false) return;
    config?.options?.onDismiss?.();
    cerrar();
  };

  const manejarPress = (boton: AppAlertButton) => {
    cerrar();
    boton.onPress?.();
  };

  const botones: AppAlertButton[] =
    config?.buttons && config.buttons.length > 0
      ? config.buttons
      : [{ text: "Entendido" }];
  const icono = config ? resolverIcono(config.title, config.buttons) : null;

  return (
    <>
      {children}
      <Modal
        visible={Boolean(config)}
        transparent
        animationType="slide"
        onRequestClose={manejarCancelar}
      >
        <View style={styles.overlay}>
          <View
            style={[styles.card, { paddingBottom: 22 + insets.bottom }]}
          >
            {icono && (
              <View style={[styles.icono, { borderColor: icono.color }]}>
                <Feather name={icono.name} size={24} color={icono.color} />
              </View>
            )}
            <Text style={styles.titulo}>{config?.title}</Text>
            {config?.message ? (
              <Text style={styles.mensaje}>{config.message}</Text>
            ) : null}

            <View
              style={
                botones.length === 2 ? styles.filaBotones : styles.columnaBotones
              }
            >
              {botones.map((boton, index) => (
                <TouchableOpacity
                  key={`${boton.text ?? "boton"}-${index}`}
                  style={[
                    styles.boton,
                    botones.length === 2 && styles.botonEnFila,
                    boton.style === "cancel" && styles.botonCancelar,
                    boton.style === "destructive" && styles.botonDestructivo,
                  ]}
                  onPress={() => manejarPress(boton)}
                >
                  <Text
                    style={[
                      styles.botonTexto,
                      boton.style === "cancel" && styles.botonCancelarTexto,
                      boton.style === "destructive" &&
                        styles.botonDestructivoTexto,
                    ]}
                  >
                    {boton.text ?? "OK"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  card: {
    backgroundColor: "#181818",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  icono: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  titulo: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  mensaje: {
    color: "rgba(255,255,255,0.62)",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 8,
    marginBottom: 20,
  },
  columnaBotones: {
    width: "100%",
    gap: 10,
  },
  filaBotones: {
    width: "100%",
    flexDirection: "row",
    gap: 10,
  },
  boton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 28,
    width: "100%",
  },
  botonEnFila: {
    flex: 1,
    width: undefined,
  },
  botonCancelar: {
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  botonDestructivo: {
    backgroundColor: "#FF6B6B",
  },
  botonTexto: {
    color: "#000000",
    fontSize: 16,
    fontWeight: "bold",
  },
  botonCancelarTexto: {
    color: "#FFFFFF",
  },
  botonDestructivoTexto: {
    color: "#FFFFFF",
  },
});
