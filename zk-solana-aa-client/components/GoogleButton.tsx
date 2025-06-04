"use client";

import { GoogleLogin } from "@react-oauth/google";

interface GoogleButtonProps {
  onSuccess: (idToken: string) => void;
  onError: () => void;
  nonce?: string;
}

const GoogleButton = ({ onSuccess, onError, nonce }: GoogleButtonProps) => {
  return (
    <div className="w-full">
      <GoogleLogin
        onSuccess={(credential) => onSuccess(credential.credential ?? "")}
        onError={onError}
        nonce={nonce}
        locale="pt_BR"
        useOneTap
      />
    </div>
  );
};

export default GoogleButton;
