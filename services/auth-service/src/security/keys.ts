import crypto from "crypto"
import fs from "fs"
import { importSPKI, exportJWK, JWK } from "jose"
import { config } from "../config/index.js"

export interface KeyManager {
  privateKeyPem: string
  publicKeyPem: string
  jwk: JWK
  kid: string
}

let keyManagerInstance: KeyManager | null = null

export async function getKeyManager(): Promise<KeyManager> {
  if (keyManagerInstance) {
    return keyManagerInstance
  }

  let privateKeyPem = config.jwtPrivateKey
  let publicKeyPem = config.jwtPublicKey

  // 1. Try reading from file path if specified
  if (!privateKeyPem && config.jwtPrivateKeyPath && fs.existsSync(config.jwtPrivateKeyPath)) {
    privateKeyPem = fs.readFileSync(config.jwtPrivateKeyPath, "utf-8")
  }
  if (!publicKeyPem && config.jwtPublicKeyPath && fs.existsSync(config.jwtPublicKeyPath)) {
    publicKeyPem = fs.readFileSync(config.jwtPublicKeyPath, "utf-8")
  }

  // 2. In dev/test, auto-generate ephemeral RSA 2048 keypair if not configured
  if (!privateKeyPem || !publicKeyPem) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: "spki",
        format: "pem",
      },
      privateKeyEncoding: {
        type: "pkcs8",
        format: "pem",
      },
    })
    privateKeyPem = privateKey
    publicKeyPem = publicKey
  }

  // 3. Export public key to RFC 7517 JWK format using jose
  const spkiKey = await importSPKI(publicKeyPem, "RS256")
  const jwk = await exportJWK(spkiKey)
  const kid = "zenfit-auth-rs256-key-1"
  jwk.kid = kid
  jwk.use = "sig"
  jwk.alg = "RS256"

  keyManagerInstance = {
    privateKeyPem,
    publicKeyPem,
    jwk,
    kid,
  }

  return keyManagerInstance
}

export async function getJwks(): Promise<{ keys: JWK[] }> {
  const km = await getKeyManager()
  return {
    keys: [km.jwk],
  }
}
