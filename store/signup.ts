import { create } from "zustand";

// Estado temporal del wizard de registro (phone-first).
// Vive solo en memoria mientras el usuario avanza por las pantallas;
// no se persiste (la contraseña no debe quedar en disco ni en params de router).
interface SignupState {
  nombre: string;
  email: string;
  password: string;
  telefono: string;
  setDatos: (d: { nombre: string; email: string; password: string }) => void;
  setTelefono: (telefono: string) => void;
  reset: () => void;
}

export const useSignupStore = create<SignupState>((set) => ({
  nombre: "",
  email: "",
  password: "",
  telefono: "",
  setDatos: ({ nombre, email, password }) => set({ nombre, email, password }),
  setTelefono: (telefono) => set({ telefono }),
  reset: () => set({ nombre: "", email: "", password: "", telefono: "" }),
}));
