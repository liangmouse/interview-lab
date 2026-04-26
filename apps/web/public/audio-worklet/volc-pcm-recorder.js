// AudioWorkletProcessor running at the enclosing AudioContext sampleRate.
// When the context is created with sampleRate: 16000, no resampling is needed.
// Emits 20ms packets (320 samples @ 16kHz) as Int16 LE PCM over port.

const TARGET_SAMPLES_PER_PACKET = 320;

class VolcPcmRecorder extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Float32Array(TARGET_SAMPLES_PER_PACKET);
    this.offset = 0;
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;
    const channel = input[0];
    if (!channel) return true;

    let i = 0;
    while (i < channel.length) {
      const space = TARGET_SAMPLES_PER_PACKET - this.offset;
      const take = Math.min(space, channel.length - i);
      this.buffer.set(channel.subarray(i, i + take), this.offset);
      this.offset += take;
      i += take;
      if (this.offset >= TARGET_SAMPLES_PER_PACKET) {
        const pcm = new Int16Array(TARGET_SAMPLES_PER_PACKET);
        let rms = 0;
        for (let j = 0; j < TARGET_SAMPLES_PER_PACKET; j += 1) {
          const s = Math.max(-1, Math.min(1, this.buffer[j]));
          pcm[j] = s < 0 ? (s * 0x8000) | 0 : (s * 0x7fff) | 0;
          rms += s * s;
        }
        rms = Math.sqrt(rms / TARGET_SAMPLES_PER_PACKET);
        this.port.postMessage({ pcm: pcm.buffer, rms }, [pcm.buffer]);
        this.offset = 0;
      }
    }
    return true;
  }
}

registerProcessor("volc-pcm-recorder", VolcPcmRecorder);
