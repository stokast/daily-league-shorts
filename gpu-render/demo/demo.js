// A dependency-free WebGL2 test project for the GPU render tool. It follows the project contract
// (window.gpuRender) and makes every frame checkable: a white flash on each whole second (the test soundtrack
// clicks at the same moments) and the frame number as a 10-bit barcode along the bottom.
const W = 540, H = 960, FPS = 30, DURATION = 4;
const canvas = document.createElement('canvas');
canvas.width = W;
canvas.height = H;
document.body.appendChild(canvas);
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false });

const vs = `#version 300 es
in vec2 p; out vec2 uv;
void main() { uv = p * 0.5 + 0.5; gl_Position = vec4(p, 0.0, 1.0); }`;
const fs = `#version 300 es
precision highp float;
in vec2 uv; out vec4 o;
uniform float uT; uniform int uFrame; uniform vec2 uRes;
void main() {
  vec2 px = uv * uRes;
  // the barcode: 10 bits of the frame number, left to right, in a strip at the bottom
  if (px.y < 60.0) {
    int bit = int(px.x / (uRes.x / 10.0));
    float on = float((uFrame >> (9 - bit)) & 1);
    o = vec4(vec3(on), 1.0);
    return;
  }
  // a white flash on whole seconds
  if (uFrame % 30 == 0) { o = vec4(1.0); return; }
  vec2 c = (px - uRes * 0.5) / uRes.y;
  float a = atan(c.y, c.x), r = length(c);
  float ring = smoothstep(0.012, 0.0, abs(r - 0.28 - 0.04 * sin(a * 6.0 + uT * 3.0)));
  vec3 bg = 0.5 + 0.35 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + uT * 0.15 + uv.y * 0.6));
  o = vec4(mix(bg * 0.55, vec3(1.0, 0.85, 0.63), ring), 1.0);
}`;
function shader(type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, vs));
gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, fs));
gl.linkProgram(prog);
gl.useProgram(prog);
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const loc = gl.getAttribLocation(prog, 'p');
gl.enableVertexAttribArray(loc);
gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
const uT = gl.getUniformLocation(prog, 'uT'), uFrame = gl.getUniformLocation(prog, 'uFrame'), uRes = gl.getUniformLocation(prog, 'uRes');

function draw(t) {
  gl.viewport(0, 0, W, H);
  gl.uniform1f(uT, t);
  gl.uniform1i(uFrame, Math.round(t * FPS));
  gl.uniform2f(uRes, W, H);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}
draw(0);
window.gpuRender = { width: W, height: H, fps: FPS, duration: DURATION, canvas, draw };
