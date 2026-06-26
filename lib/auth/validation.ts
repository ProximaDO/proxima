import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Introduce tu correo o nombre de usuario"),
  password: z.string().min(6, "La contrasena debe tener al menos 6 caracteres"),
});

export const registerSchema = z.object({
  email: z.email("Introduce un correo valido").trim(),
  password: z.string().min(8, "La contrasena debe tener al menos 8 caracteres"),
});
