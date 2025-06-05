import { jwtDecode } from "jwt-decode";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function parseOIDCToken(token: string): {
  issuer: string;
  sub: string;
  email: string;
} {
  const decoded = jwtDecode<{
    iss: string;
    sub: string;
    email: string;
  }>(token);

  const { iss: issuer, sub, email } = decoded;

  if (!issuer || !sub || !email) {
    throw new Error("Missing required fields in token");
  }

  return {
    issuer,
    sub,
    email,
  };
}
