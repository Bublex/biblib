// Le code des catalogues (extension/lib) est écrit pour un navigateur. Ce fichier comble les écarts
// du moteur JavaScript de l'app ; il est importé avant tout le reste.
import { randomUUID } from 'expo-crypto';
import { decodeWindows1252, isSingleByteLabel } from './encoding.js';

// --- TextDecoder : ISO-8859-1 / windows-1252 en plus de l'UTF-8 ---

const NativeTextDecoder = globalThis.TextDecoder;

class TextDecoder {
  constructor(label = 'utf-8', options) {
    this.singleByte = isSingleByteLabel(label);
    this.native = this.singleByte ? null : new NativeTextDecoder(label, options);
    this.encoding = this.singleByte ? 'windows-1252' : this.native.encoding;
  }

  decode(input, options) {
    if (!this.singleByte) return this.native.decode(input, options);
    return input === undefined ? '' : decodeWindows1252(input);
  }
}

globalThis.TextDecoder = TextDecoder;

// --- crypto.randomUUID : identifiant de requête inMedia ---

globalThis.crypto ??= {};
globalThis.crypto.randomUUID ??= randomUUID;

// --- fetch : erreurs comme dans un navigateur ---
// Le fetch d'Expo rejette toujours avec une FetchError. Un navigateur rejette avec la raison du signal
// (TimeoutError, AbortError) quand la requête est annulée, et avec une TypeError en cas d'échec réseau :
// c'est ce qu'attendent les connecteurs et humanError().

const expoFetch = globalThis.fetch;

globalThis.fetch = async function fetch(input, init) {
  try {
    return await expoFetch(input, init);
  } catch (error) {
    if (init?.signal?.aborted) throw init.signal.reason;
    throw new TypeError(error.message, { cause: error });
  }
};
