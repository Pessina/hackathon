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
  kid: string;
} {
  const decodedHeader = jwtDecode<{
    kid: string;
  }>(token, { header: true });

  const decodedBody = jwtDecode<{
    iss: string;
    sub: string;
    email: string;
  }>(token, { header: false });

  const { kid } = decodedHeader;
  const { iss: issuer, sub, email } = decodedBody;

  if (!issuer || !sub || !email || !kid) {
    throw new Error("Missing required fields in token");
  }

  return {
    issuer,
    sub,
    email,
    kid,
  };
}
