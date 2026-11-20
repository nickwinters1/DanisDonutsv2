/* The lagoon: one big transparent plane. Depth comes from the terrain heightmap, so the
 * shallows glow turquoise over the sand, foam rolls toward every beach, and the sun glitters. */
import * as THREE from 'three';
import { BOUNDS } from './terrain';
import type { Sky } from './sky';

export function buildWater(heightTex: THREE.Texture, sky: Sky) {
  const uniforms = {
    uTime: { value: 0 },
    uHeight: { value: heightTex },
    uBounds: { value: new THREE.Vector4(BOUNDS.minX, BOUNDS.minZ, BOUNDS.maxX - BOUNDS.minX, BOUNDS.maxZ - BOUNDS.minZ) },
    uShallow: sky.water.uShallow,
    uDeep: sky.water.uDeep,
    uSunDir: sky.uniforms.uSunDir,
    uSunColor: sky.uniforms.uSunColor,
    uHorizon: sky.uniforms.uHorizon,
    uZenith: sky.uniforms.uZenith,
    uNight: sky.uniforms.uNight,
    uFogColor: { value: new THREE.Color() },
    uFogNear: { value: 80 },
    uFogFar: { value: 300 },
    uFade: { value: 0 },
    uFadeRadius: { value: 80 },
  };
  const geo = new THREE.PlaneGeometry(1400, 1400, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uHeight; uniform vec4 uBounds; uniform float uTime;
      uniform vec3 uShallow, uDeep, uSunDir, uSunColor, uHorizon, uZenith, uFogColor;
      uniform float uNight, uFogNear, uFogFar, uFade, uFadeRadius;
      varying vec3 vWorld;
      float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y); }
      float terrainH(vec2 p){
        vec2 uv = (p - uBounds.xy) / uBounds.zw;
        if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -5.0;
        return texture2D(uHeight, uv).r * 10.0 - 5.0;
      }
      void main(){
        vec2 p = vWorld.xz;
        float depth = max(0.0, -terrainH(p));
        float n = noise(p * 0.32 + vec2(uTime * 0.12, uTime * 0.07));
        float n2 = noise(p * 1.4 - vec2(uTime * 0.3, -uTime * 0.21));
        vec3 c = mix(uShallow, uDeep, smoothstep(0.15, 3.6, depth + (n - 0.5) * 0.5));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vec3((n2 - 0.5) * 0.16, 1.0, (n - 0.5) * 0.16));
        float fres = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        c = mix(c, mix(uHorizon, uZenith, 0.3), fres * 0.6);
        vec3 R = reflect(-V, N);
        float sp = pow(max(dot(R, uSunDir), 0.0), 260.0);
        c += uSunColor * sp * (1.6 - uNight * 0.9);
        // foam: bands that roll in toward the beach, plus the lapping edge
        float shore = 1.0 - smoothstep(0.0, 1.5, depth);
        float bands = sin(depth * 7.0 - uTime * 1.6 + n * 3.5);
        float foam = smoothstep(0.84, 0.98, bands) * shore * smoothstep(0.0, 0.25, depth);
        float edge = 1.0 - smoothstep(0.0, 0.07 + n * 0.08, depth);
        foam = max(foam * 0.75, edge);
        c = mix(c, vec3(1.0, 0.99, 0.97), foam * 0.9);
        float glint = step(0.992, noise(p * 7.0 + uTime * 0.8)) * (1.0 - uNight * 0.6) * smoothstep(0.3, 2.0, depth) * 0.6;
        c += glint;
        float alpha = mix(0.42, 1.0, smoothstep(0.05, 2.3, depth));
        alpha = max(alpha, foam * 0.95);
        float dist = length(vWorld - cameraPosition);
        c = mix(c, uFogColor, smoothstep(uFogNear, uFogFar, dist));
        if (uFade > 0.5) {
          float r = length(p - vec2(2.0, 0.0));
          alpha *= 1.0 - smoothstep(uFadeRadius * 0.55, uFadeRadius, r);
        }
        gl_FragColor = vec4(c, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.renderOrder = 2;
  mesh.name = 'water';
  return { mesh, uniforms };
}
