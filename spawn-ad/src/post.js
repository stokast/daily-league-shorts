// Final composite: scene (linear, after bloom) -> vortex/zoom/radial blur/aberration -> grade -> sRGB,
// then the 2D overlay (typing, chat bar, end card) composited in sRGB like a browser would,
// then grain + dither. Rendered straight to the canvas.
import * as THREE from 'three';

export const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    tOverlay: { value: null },
    uRes: { value: new THREE.Vector2(1080, 1920) },
    uTime: { value: 0 },
    uSceneGain: { value: 1 },
    uRadial: { value: 0 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uCA: { value: 0 },
    uSwirl: { value: 0 },
    uShrink: { value: 0 },
    uPinch: { value: 0 },
    uOvSwirl: { value: 0 },
    uOvShrink: { value: 0 },
    uPoint: { value: 0 },
    uFlash: { value: 0 },
    uFlashColor: { value: new THREE.Color(1, 0.97, 0.92) },
    uVignette: { value: 0.25 },
    uGrain: { value: 0.03 },
    uExposure: { value: 1 },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uLift: { value: new THREE.Color(0, 0, 0) },
    uOverlayOpacity: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform sampler2D tOverlay;
    uniform vec2 uRes;
    uniform float uTime, uSceneGain, uRadial, uCA, uSwirl, uShrink, uPinch, uOvSwirl, uOvShrink, uPoint, uFlash, uVignette, uGrain;
    uniform float uExposure, uSaturation, uContrast, uOverlayOpacity;
    uniform vec2 uCenter;
    uniform vec3 uFlashColor, uLift;
    varying vec2 vUv;

    float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    vec3 toSRGB(vec3 c) {
      c = max(c, 0.0);
      return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }
    vec3 sampleScene(vec2 uv) {
      return texture2D(tDiffuse, clamp(uv, vec2(0.0005), vec2(0.9995))).rgb;
    }
    // aspect-correct coordinates around the centre
    vec2 warp(vec2 uv, float swirl, float shrink, float pinch) {
      float aspect = uRes.x / uRes.y;
      vec2 d = uv - uCenter;
      d.x *= aspect;
      float r = length(d);
      // pinch: content drains toward the centre while the frame edges stay put
      if (pinch > 0.0 && r > 1e-5) {
        vec2 n = abs(d) / r;
        float rEdge = min(0.5 * aspect / max(n.x, 1e-4), 0.5 / max(n.y, 1e-4));
        float rs = pow(clamp(r / rEdge, 0.0, 1.0), 1.0 / (1.0 + pinch * 5.0)) * rEdge;
        d *= rs / r;
        r = rs;
      }
      // swirl: stronger near the centre
      float ang = swirl * exp(-r * 2.2) * 6.2831;
      float s = sin(ang), c = cos(ang);
      d = mat2(c, -s, s, c) * d;
      // shrink the whole picture into the centre (sucked into a point)
      d *= 1.0 + shrink * shrink * 60.0;
      d.x /= aspect;
      return uCenter + d;
    }

    void main() {
      vec2 uv = warp(vUv, uSwirl, uShrink, uPinch);
      vec3 col;
      if (uRadial > 0.0005 || uCA > 0.0005) {
        vec2 dir = uv - uCenter;
        vec3 acc = vec3(0.0);
        float wsum = 0.0;
        const int N = 14;
        for (int i = 0; i < N; i++) {
          float f = float(i) / float(N - 1);
          float k = 1.0 - uRadial * f * 0.13;
          float w = 1.0 - f * 0.6;
          vec2 p = uCenter + dir * k;
          vec2 ca = dir * uCA * 0.02;
          acc.r += sampleScene(p + ca).r * w;
          acc.g += sampleScene(p).g * w;
          acc.b += sampleScene(p - ca).b * w;
          wsum += w;
          if (uRadial < 0.0005) { acc /= wsum; wsum = 1.0; break; }
        }
        col = acc / wsum;
      } else {
        col = sampleScene(uv);
      }
      col *= uSceneGain * uExposure;
      // grade (linear)
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      col = max(col + uLift * (1.0 - col), 0.0);
      // vignette
      vec2 vd = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
      col *= 1.0 - uVignette * smoothstep(0.25, 0.95, length(vd) * 1.25);
      col = mix(col, uFlashColor * 1.0, clamp(uFlash, 0.0, 1.0));
      vec3 srgb = toSRGB(col);
      srgb = (srgb - 0.5) * uContrast + 0.5;
      // overlay (canvas pixels, straight alpha, sRGB values)
      vec2 ouv = warp(vUv, uOvSwirl, uOvShrink, 0.0);
      vec4 ov = (ouv.x < 0.0 || ouv.x > 1.0 || ouv.y < 0.0 || ouv.y > 1.0) ? vec4(0.0) : texture2D(tOverlay, ouv);
      srgb = mix(srgb, ov.rgb, ov.a * uOverlayOpacity);
      // the bright point everything collapses into
      if (uPoint > 0.001) {
        vec2 pd = (vUv - uCenter) * vec2(uRes.x / uRes.y, 1.0) * uRes.y;
        float r2 = dot(pd, pd);
        float core = exp(-r2 / (2.0 * pow(4.0 + 10.0 * uPoint, 2.0)));
        float halo = exp(-r2 / (2.0 * pow(30.0 + 60.0 * uPoint, 2.0)));
        srgb += uPoint * (vec3(1.0) * core * 1.2 + vec3(1.0, 0.85, 0.63) * halo * 0.55);
      }
      // grain (kept off pure black so the black bookends stay clean) + dither
      float n = hash12(gl_FragCoord.xy + fract(uTime * 7.31) * 1000.0) - 0.5;
      float lum = dot(srgb, vec3(0.299, 0.587, 0.114));
      srgb += n * uGrain * smoothstep(0.02, 0.25, lum) * (1.0 - 0.6 * lum);
      float d1 = hash12(gl_FragCoord.xy * 1.37 + uTime * 13.0), d2 = hash12(gl_FragCoord.yx * 0.91 + uTime * 5.0);
      srgb += (d1 + d2 - 1.0) / 255.0;
      gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
    }
  `,
};
