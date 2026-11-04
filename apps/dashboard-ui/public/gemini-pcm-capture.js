class GeminiPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.position = 0;
    this.chunk = [];
  }

  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;

    const step = sampleRate / 16000;
    while (this.position < input.length) {
      const sample = Math.max(-1, Math.min(1, input[Math.floor(this.position)]));
      this.chunk.push(sample < 0 ? sample * 32768 : sample * 32767);
      this.position += step;
    }
    this.position -= input.length;

    if (this.chunk.length >= 320) {
      const samples = this.chunk.splice(0, 320);
      const pcm = new Int16Array(samples);
      this.port.postMessage(pcm.buffer, [pcm.buffer]);
    }
    return true;
  }
}

registerProcessor("gemini-pcm-capture", GeminiPcmCaptureProcessor);
