// WebGL post-processing: the more you drink, the more the world wobbles.
// Double vision, chromatic aberration, bloom, vignette, film grain, flashes.
const VERT = `
attribute vec2 p;
varying vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform sampler2D tex;
uniform float time, drunk, flash, hurt;
uniform vec2 res;
varying vec2 uv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec3 sampleCA(vec2 q, float ca) {
  return vec3(
    texture2D(tex, q + vec2(ca, 0.0)).r,
    texture2D(tex, q).g,
    texture2D(tex, q - vec2(ca, 0.0)).b);
}

void main() {
  float d = drunk;
  vec2 q = uv;
  vec2 c = q - 0.5;
  // drunk wobble + slow breathing zoom
  q.x += sin(q.y * 8.0 + time * 1.6) * 0.0065 * d;
  q.y += sin(q.x * 6.0 + time * 1.2) * 0.005 * d;
  q = 0.5 + (q - 0.5) * (1.0 - 0.018 * d * (0.5 + 0.5 * sin(time * 0.7)));

  float ca = 0.0009 + 0.0035 * d;
  vec3 col = sampleCA(q, ca);

  // double vision
  vec2 off = vec2(sin(time * 0.9), cos(time * 0.63)) * 0.014 * d;
  vec3 ghost = sampleCA(q + off, ca);
  col = mix(col, ghost, 0.3 * clamp(d, 0.0, 1.0));

  // cheap bloom on bright stuff (tube light, beer, sparks)
  vec3 b = vec3(0.0);
  float r = 0.006;
  b += texture2D(tex, q + vec2( r, 0.0)).rgb;
  b += texture2D(tex, q + vec2(-r, 0.0)).rgb;
  b += texture2D(tex, q + vec2(0.0,  r * 1.7)).rgb;
  b += texture2D(tex, q + vec2(0.0, -r * 1.7)).rgb;
  b += texture2D(tex, q + vec2( r,  r * 1.7) * 1.6).rgb;
  b += texture2D(tex, q + vec2(-r, -r * 1.7) * 1.6).rgb;
  b += texture2D(tex, q + vec2( r, -r * 1.7) * 1.6).rgb;
  b += texture2D(tex, q + vec2(-r,  r * 1.7) * 1.6).rgb;
  b /= 8.0;
  col += max(b - 0.62, 0.0) * (0.9 + d * 0.6);
  // drunk blur
  col = mix(col, b, clamp((d - 0.7) * 0.8, 0.0, 0.35));

  // warm theka grade
  col *= vec3(1.06, 1.0, 0.9);
  col = mix(vec3(dot(col, vec3(0.299, 0.587, 0.114))), col, 1.08);

  // vignette tightens as you get talli
  float vig = smoothstep(0.95 - 0.12 * d, 0.25, length(c * vec2(1.0, 0.8)));
  col *= mix(0.45, 1.0, vig);

  col += flash * vec3(1.0, 0.85, 0.5) * 0.3;
  col = mix(col, vec3(0.8, 0.1, 0.05), hurt * 0.25);
  col += (hash(uv * res + fract(time) * 100.0) - 0.5) * 0.04;
  gl_FragColor = vec4(col, 1.0);
}`;

export class PostFX {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) {
      this.ctx2d = canvas.getContext('2d');
      return;
    }
    this.gl = gl;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    this.prog = prog;

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    this.u = {};
    for (const n of ['tex', 'time', 'drunk', 'flash', 'hurt', 'res']) this.u[n] = gl.getUniformLocation(prog, n);
  }

  render(source, { time, drunk, flash, hurt }) {
    if (!this.gl) {
      this.ctx2d.drawImage(source, 0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.uniform1i(this.u.tex, 0);
    gl.uniform1f(this.u.time, time);
    gl.uniform1f(this.u.drunk, drunk);
    gl.uniform1f(this.u.flash, flash);
    gl.uniform1f(this.u.hurt, hurt || 0);
    gl.uniform2f(this.u.res, this.canvas.width, this.canvas.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
