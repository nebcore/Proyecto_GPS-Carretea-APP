import { Stack } from "expo-router";

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        // Fondo negro opaco a nivel del navegador para que durante el slide
        // no se vea la flor de fondo entre pantallas.
        contentStyle: { backgroundColor: "#000" },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="verificarTelefono" />
    </Stack>
  );
}
