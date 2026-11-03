// Shared GLSL. Planes are sized in CSS pixels, so the camera maps 1 unit to 1 pixel.
//
// Each plane draws a whole print, not just the photo: a soft shadow margin, the white paper
// border and the photo inside it, so scroll-bend, colour shift and hover lift move them together.
// Rectangles are vec4(minX, minY, maxX, maxY) in plane pixels, origin bottom-left.

const COMMON = /* glsl */ `
  uniform vec2 uSize;          // full plane size, shadow margin included
  uniform vec4 uFrame;         // the print (paper) rectangle
  uniform vec4 uPhoto;         // the photo rectangle inside the border
  uniform float uShadow;       // shadow strength, 0 for photos that aren't prints

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
  }
  // fit an image into a box like CSS object-fit: cover
  vec2 cover(vec2 uv, vec2 box, vec2 image) {
    float rb = box.x / box.y, ri = image.x / image.y;
    vec2 s = rb < ri ? vec2(rb / ri, 1.0) : vec2(1.0, ri / rb);
    return (uv - 0.5) * s + 0.5;
  }
  // 1 inside the rectangle, 0 outside, with a one-pixel anti-aliased edge
  float inside(vec2 p, vec4 r) {
    vec2 a = smoothstep(r.xy - 0.5, r.xy + 0.5, p) * (1.0 - smoothstep(r.zw - 0.5, r.zw + 0.5, p));
    return a.x * a.y;
  }
  // soft drop shadow under the print, offset downwards
  float shadowAt(vec2 p, vec4 r) {
    vec2 c = (r.xy + r.zw) * 0.5 + vec2(0.0, -16.0);
    vec2 h = (r.zw - r.xy) * 0.5 - vec2(14.0);
    float d = length(max(abs(p - c) - h, 0.0));
    float s = 1.0 - smoothstep(0.0, 52.0, d);
    return s * s;   // eased falloff: soft and wide rather than a dark rim
  }
  // put the photo colour into the print and add paper + shadow; alpha from the develop reveal
  vec4 compose(vec3 photo, vec2 px, float reveal) {
    float inPhoto = inside(px, uPhoto), inFrame = inside(px, uFrame);
    vec3 col = mix(vec3(1.0), photo, inPhoto);
    float shadow = shadowAt(px, uFrame) * uShadow * (1.0 - inFrame);
    vec3 outCol = mix(vec3(0.16, 0.12, 0.05), col, inFrame);
    // develop: an uneven front rises from the bottom of the print
    float front = (1.0 - vUv.y) * 0.75 + noise(vUv * vec2(3.0, 2.0) + 4.0) * 0.25;
    float a = smoothstep(front - 0.08, front, reveal * 1.12);
    return vec4(outCol, max(inFrame, shadow) * a);
  }
`;

// bends the whole print with scroll velocity and pushes it towards the viewer on hover
export const vertex = /* glsl */ `
  uniform float uVelocity;
  uniform float uHover;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float bend = sin(uv.x * 3.14159);
    p.y -= bend * clamp(uVelocity, -60.0, 60.0) * 0.0009;   // plane-relative units: ~5% of its height at full speed
    p.z += sin(uv.x * 3.14159) * sin(uv.y * 3.14159) * uHover * 40.0;     // z is not scaled: pixels
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

// gallery print: develops in from white, chromatic shift with scroll speed, zoom + lift on hover
export const fragment = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec2 uImage, uPlane;      // uPlane = the photo's own size
  uniform float uReveal, uHover, uVelocity, uTime;
  varying vec2 vUv;
  ${COMMON}
  void main() {
    vec2 px = vUv * uSize;
    vec2 puv = (px - uPhoto.xy) / (uPhoto.zw - uPhoto.xy);
    vec2 uv = (puv - 0.5) * (1.0 - 0.08 * uHover) + 0.5;
    vec2 c = cover(uv, uPlane, uImage);
    float shift = clamp(abs(uVelocity), 0.0, 60.0) * 0.00012 + 0.0035 * uHover;
    vec3 col = vec3(
      texture2D(uTex, c + vec2(0.0, shift)).r,
      texture2D(uTex, c).g,
      texture2D(uTex, c - vec2(0.0, shift)).b
    );
    col = mix(col, vec3(1.0), (1.0 - smoothstep(0.25, 1.0, uReveal)) * 0.8);   // over-exposed while developing
    col *= 1.0 + 0.05 * uHover;
    col += (hash(px + fract(uTime)) - 0.5) * 0.035;                            // film grain
    gl_FragColor = compose(col, px, uReveal);
  }
`;

// hero print: two photos, a light-leak wipe between them, and a soft light that follows the pointer
export const heroFragment = /* glsl */ `
  uniform sampler2D uTexA, uTexB;
  uniform vec2 uImageA, uImageB, uPlane, uMouse;
  uniform float uProgress, uReveal, uTime, uLight;
  varying vec2 vUv;
  ${COMMON}
  void main() {
    vec2 px = vUv * uSize;
    vec2 puv = (px - uPhoto.xy) / (uPhoto.zw - uPhoto.xy);
    float n = noise(puv * vec2(2.5, 1.5) + uTime * 0.05);
    float d = puv.x * 0.7 + n * 0.3;
    float t = uProgress * 1.3 - 0.15;
    float m = smoothstep(d - 0.12, d + 0.02, t);

    vec2 ca = cover((puv - 0.5) * (1.0 - 0.04 * m) + 0.5 + vec2(m * 0.03, 0.0), uPlane, uImageA);
    vec2 cb = cover((puv - 0.5) * (0.96 + 0.04 * m) + 0.5 - vec2((1.0 - m) * 0.03, 0.0), uPlane, uImageB);
    vec3 col = mix(texture2D(uTexA, ca).rgb, texture2D(uTexB, cb).rgb, m);

    // warm light leak travelling along the wipe edge
    float edge = exp(-pow((d - t + 0.05) * 7.0, 2.0)) * sin(clamp(uProgress, 0.0, 1.0) * 3.14159);
    col += vec3(1.0, 0.72, 0.38) * edge * 0.75;

    // pointer light
    vec2 asp = vec2(uPlane.x / uPlane.y, 1.0);
    float glow = exp(-length((puv - uMouse) * asp) * 3.2) * uLight;
    col += vec3(1.0, 0.86, 0.66) * glow * 0.22;

    col = mix(col, vec3(1.0), (1.0 - smoothstep(0.25, 1.0, uReveal)) * 0.8);
    col += (hash(px + fract(uTime)) - 0.5) * 0.03;
    gl_FragColor = compose(col, px, uReveal);
  }
`;
