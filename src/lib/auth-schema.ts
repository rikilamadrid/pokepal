import { z } from "zod";

/** Validation for the magic-link sign-in form (a parent enters their email). */
export const signInSchema = z.object({
  email: z.string().trim().min(1, "Enter an email").email("Enter a valid email"),
});

export type SignInValues = z.infer<typeof signInSchema>;
