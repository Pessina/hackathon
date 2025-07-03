"use client";

import { GoogleLogin } from "@react-oauth/google";

interface GoogleButtonProps {
  onSuccess: (idToken: string) => void;
  onError: () => void;
  nonce?: string;
}

const GoogleButton = ({ onSuccess, onError, nonce }: GoogleButtonProps) => {
  return (
    <div className="w-full space-y-4">
      <GoogleLogin
        onSuccess={(credential) => onSuccess(credential.credential ?? "")}
        onError={onError}
        nonce={nonce}
        locale="en"
        width="100%"
        size="large"
        shape="rectangular"
        theme="outline"
      />
      <div className="text-center">
        <p className="text-xs text-muted-foreground">
          Your Google account will be used to generate a ZK proof for secure
          authentication
        </p>
      </div>
    </div>
  );
};

export default GoogleButton;
