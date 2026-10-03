type DecodedClientHeic = {
  width: number;
  height: number;
  data: Uint8ClampedArray;
};

type HeicDecoder = (input: {
  buffer: Uint8Array;
}) => Promise<DecodedClientHeic>;

type LoadHeicDecoder = () => Promise<HeicDecoder>;

async function loadHeicDecoder(): Promise<HeicDecoder> {
  const decoderModule = await import("heic-decode");
  return decoderModule.default as HeicDecoder;
}

export async function decodeClientHeic(
  file: Blob,
  loadDecoder: LoadHeicDecoder = loadHeicDecoder,
): Promise<DecodedClientHeic> {
  const decode = await loadDecoder();
  return decode({ buffer: new Uint8Array(await file.arrayBuffer()) });
}
