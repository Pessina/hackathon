import { GoogleOAuthProvider } from "@react-oauth/google";

import { useEnv } from "@/hooks/useEnv";

export default function GoogleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { NEXT_PUBLIC_GOOGLE_CLIENT_ID } = useEnv();

  return (
    <GoogleOAuthProvider clientId={NEXT_PUBLIC_GOOGLE_CLIENT_ID}>
      {children}
    </GoogleOAuthProvider>
  );
}
