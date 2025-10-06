const VERT_SOURCE = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAG_SOURCE = `#version 300 es
precision highp float;
in vec2 v_uv;

uniform sampler2D u_data;
out vec4 outColor;

const int SPEK_STOPS = 7;
const vec4 SPEK_PALETTE[SPEK_STOPS] = vec4[SPEK_STOPS](
  vec4(0.031, 0.012, 0.078, 1.0),     // deep indigo
  vec4(0.118, 0.318, 0.745, 1.0),     // azure
  vec4(0.310, 0.549, 0.941, 1.0),     // powder blue
  vec4(0.655, 0.894, 0.976, 1.0),     // ice
  vec4(0.992, 0.937, 0.510, 1.0),     // yellow highlight
  vec4(0.996, 0.584, 0.153, 1.0),     // orange
  vec4(0.996, 0.145, 0.153, 1.0)      // red peak
);

vec3 spekColor(float t) {
  float clamped = clamp(t, 0.0, 1.0);
  float scaled = clamped * float(SPEK_STOPS - 1);
  float idx = floor(scaled);
  float frac = scaled - idx;
  int i0 = int(idx);
  int i1 = min(i0 + 1, SPEK_STOPS - 1);
  vec4 c0 = SPEK_PALETTE[i0];
  vec4 c1 = SPEK_PALETTE[i1];
  vec3 blended = mix(c0.rgb, c1.rgb, frac);
  return blended;
}

void main() {
  vec2 sampleUV = vec2(v_uv.x, 1.0 - v_uv.y);
  float magnitude = texture(u_data, sampleUV).r;
  vec3 color = spekColor(magnitude);
  outColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Unable to create shader");
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: ${info}`);
  }
  return shader;
}

function createProgram(gl, vertSource, fragSource) {
  const vert = createShader(gl, gl.VERTEX_SHADER, vertSource);
  const frag = createShader(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Unable to create program");
  }
  gl.attachShader(program, vert);
  gl.attachShader(program, frag);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    gl.deleteShader(vert);
    gl.deleteShader(frag);
    throw new Error(`Program link failed: ${info}`);
  }
  gl.deleteShader(vert);
  gl.deleteShader(frag);
  return program;
}

export class GpuSpectrogramRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl =
      canvas.getContext("webgl2", { alpha: false, premultipliedAlpha: false }) ??
      canvas.getContext("webgl", { alpha: false, premultipliedAlpha: false });

    if (!this.gl) {
      throw new Error("WebGL not supported");
    }

    this.program = createProgram(this.gl, VERT_SOURCE, FRAG_SOURCE);
    this.attribLocations = {
      position: this.gl.getAttribLocation(this.program, "a_position"),
    };
    this.uniformLocations = {
      data: this.gl.getUniformLocation(this.program, "u_data"),
      timeBins: this.gl.getUniformLocation(this.program, "u_timeBins"),
      freqBins: this.gl.getUniformLocation(this.program, "u_freqBins"),
    };

    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        -1, 1,
        1, -1,
        1, 1,
      ]),
      this.gl.STATIC_DRAW,
    );

    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
  }

  resize(width, height) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }

  render(normalizedData, width, height) {
    const timeBins = normalizedData.length;
    const freqBins = normalizedData[0]?.length ?? 0;
    if (!timeBins || !freqBins) {
      return;
    }

    this.resize(width, height);
    this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);

    const data = new Uint8Array(timeBins * freqBins);
    let offset = 0;
    for (let f = freqBins - 1; f >= 0; f -= 1) {
      for (let t = 0; t < timeBins; t += 1) {
        const frame = normalizedData[t];
        const magnitude = frame?.[f] ?? 0;
        data[offset] = Math.min(255, Math.max(0, Math.round(magnitude * 255)));
        offset += 1;
      }
    }

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.R8,
      timeBins,
      freqBins,
      0,
      this.gl.RED,
      this.gl.UNSIGNED_BYTE,
      data,
    );

    this.gl.useProgram(this.program);
    this.gl.uniform1f(this.uniformLocations.timeBins, timeBins);
    this.gl.uniform1f(this.uniformLocations.freqBins, freqBins);

    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.uniform1i(this.uniformLocations.data, 0);

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.enableVertexAttribArray(this.attribLocations.position);
    this.gl.vertexAttribPointer(this.attribLocations.position, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    this.gl.flush();
  }
}
