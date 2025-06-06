## Improvements

- Zk Circuit
  - Poseidon hash is more friendly than sha256 for zk proofs
- Security
  - Currently our contract methods take the proof + args, so after the proof become public anybody can steal and use it to initiate transaction on the AA. Ideally the proof or OIDC token should be bounded to the function/args, so even if the proof becomes public it can't be used to initiate a transaction that the user haven't authorized.
    - UX Friendly:The func/args should be included on the proof
    - OIDC nonce should include func/args
  - The OIDC signing key is an output of the zk proof, we should make sure this key is from a trusted OIDC provider.
    - To update the key on-chain we should use a multisig, oracle network, zk TLS, etc.
- Notes
  - In Solana, if a PDA has data it can't use system_program::transfer, we have a few options:
    - PDA owns another sub-PDA without data and holds tokens
    - Transfer SOL by manually adjusting lamports as it's currently implemented
  - SP1 has a proving network that should speed up the proof generation, currently takes around 5 minutes (11:57:11 -> 12:01:23)
