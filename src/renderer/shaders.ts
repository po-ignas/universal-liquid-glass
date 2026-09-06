export const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec4 u_rect;
uniform vec2 u_viewport;
out vec2 v_uv;
out vec2 v_local;
void main() {
  vec2 unit = a_position * 0.5 + 0.5;
  vec2 pixel = u_rect.xy + unit * u_rect.zw;
  vec2 clip = pixel / u_viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = pixel / u_viewport;
  v_local = (unit - 0.5) * u_rect.zw;
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_local;
out vec4 outColor;
uniform sampler2D u_backdrop;
uniform vec2 u_viewport;
uniform vec2 u_textureSize;
uniform vec4 u_rect;
uniform float u_radius;
uniform float u_refraction;
uniform float u_blur;
uniform float u_chromatic;
uniform float u_tintOpacity;
uniform vec3 u_tint;
uniform float u_sampleTier;
uniform float u_debugMode;
uniform float u_sourceReady;

float roundedBox(vec2 point, vec2 halfSize, float radius) {
  vec2 q = abs(point) - halfSize + radius;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - radius;
}
vec3 backdrop(vec2 uv, vec2 delta) {
  vec3 color = texture(u_backdrop, clamp(uv, 0.0, 1.0)).rgb * 0.28;
  color += texture(u_backdrop, clamp(uv + vec2(delta.x, 0.0), 0.0, 1.0)).rgb * 0.12;
  color += texture(u_backdrop, clamp(uv - vec2(delta.x, 0.0), 0.0, 1.0)).rgb * 0.12;
  color += texture(u_backdrop, clamp(uv + vec2(0.0, delta.y), 0.0, 1.0)).rgb * 0.12;
  color += texture(u_backdrop, clamp(uv - vec2(0.0, delta.y), 0.0, 1.0)).rgb * 0.12;
  if (u_sampleTier > 0.4) {
    color += texture(u_backdrop, clamp(uv + delta, 0.0, 1.0)).rgb * 0.06;
    color += texture(u_backdrop, clamp(uv - delta, 0.0, 1.0)).rgb * 0.06;
    color += texture(u_backdrop, clamp(uv + vec2(delta.x, -delta.y), 0.0, 1.0)).rgb * 0.06;
    color += texture(u_backdrop, clamp(uv + vec2(-delta.x, delta.y), 0.0, 1.0)).rgb * 0.06;
  } else { color /= 0.76; }
  if (u_sampleTier > 0.8) {
    vec2 wide = delta * 1.8;
    color = color * 0.88
      + texture(u_backdrop, clamp(uv + wide, 0.0, 1.0)).rgb * 0.03
      + texture(u_backdrop, clamp(uv - wide, 0.0, 1.0)).rgb * 0.03
      + texture(u_backdrop, clamp(uv + vec2(wide.x, -wide.y), 0.0, 1.0)).rgb * 0.03
      + texture(u_backdrop, clamp(uv + vec2(-wide.x, wide.y), 0.0, 1.0)).rgb * 0.03;
  }
  return color;
}
void main() {
  vec2 halfSize = u_rect.zw * 0.5;
  float radius = clamp(u_radius, 0.0, min(halfSize.x, halfSize.y));
  float signedDistance = roundedBox(v_local, halfSize, radius);
  float antialias = max(fwidth(signedDistance), 0.75);
  float alpha = 1.0 - smoothstep(-antialias, antialias, signedDistance);
  if (alpha <= 0.001) discard;
  if (u_sourceReady < 0.5) {
    float stripe = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y) / 18.0));
    vec3 diagnostic = mix(vec3(0.28, 0.0, 0.36), vec3(1.0, 0.0, 0.72), stripe);
    outColor = vec4(diagnostic * alpha, alpha);
    return;
  }
  if (u_debugMode > 0.5 && u_debugMode < 1.5) {
    vec4 sampled = texture(u_backdrop, clamp(v_uv, 0.0, 1.0));
    outColor = vec4(sampled.rgb * alpha, alpha);
    return;
  }
  float depth = max(-signedDistance, 0.0);
  // Wide, shallow navigation surfaces need a thinner optical profile than panels.
  float thickness = min(u_rect.z, u_rect.w);
  float aspectRatio = max(u_rect.z, u_rect.w) / max(thickness, 1.0);
  float normalizedThickness = clamp(thickness / 96.0, 0.5, 1.0);
  float shallowSurface = smoothstep(2.5, 7.5, aspectRatio);
  float opticalProfile = normalizedThickness * mix(1.0, 0.58, shallowSurface);
  float edgeWidth = clamp(thickness * mix(0.21, 0.30, opticalProfile), 7.0, 22.0);
  float edgeBase = 1.0 - smoothstep(0.0, edgeWidth, depth);
  float edge = pow(clamp(edgeBase, 0.0, 1.0), 2.0);
  float lipWidth = clamp(thickness * 0.06, 1.5, 5.0);
  float lip = exp(-depth / lipWidth);
  float refractionStrength = opticalProfile * clamp(edge * 0.78 + lip * 0.22, 0.0, 1.0);
  if (u_debugMode > 2.5) {
    outColor = vec4(vec3(refractionStrength) * alpha, alpha);
    return;
  }
  float epsilon = 1.0;
  vec2 gradient = vec2(
    roundedBox(v_local + vec2(epsilon, 0.0), halfSize, radius) - roundedBox(v_local - vec2(epsilon, 0.0), halfSize, radius),
    roundedBox(v_local + vec2(0.0, epsilon), halfSize, radius) - roundedBox(v_local - vec2(0.0, epsilon), halfSize, radius));
  vec2 radial = v_local / max(halfSize, vec2(1.0));
  vec2 normal = length(gradient) > 0.001 ? normalize(gradient) : normalize(radial + vec2(0.0001));
  vec2 lensDirection = normalize(mix(radial, normal, smoothstep(0.12, 0.75, edge)) + vec2(0.0001));
  float debugStrength = u_debugMode > 1.5 ? 4.5 : 1.0;
  float opticalThickness = min(thickness, 96.0);
  float lensPixels = u_refraction * debugStrength * opticalThickness * opticalProfile
    * (0.004 + edge * 0.095 + lip * 0.028);
  vec2 offset = -lensDirection * lensPixels / u_viewport;
  float scatteringProfile = mix(0.45, 1.0, opticalProfile);
  float scatteringShape = mix(0.34, 1.0, clamp(edge * 0.82 + lip * 0.18, 0.0, 1.0));
  vec2 blurStep = (vec2(1.0) / max(u_textureSize, vec2(1.0)))
    * max(u_blur * scatteringProfile * scatteringShape, 0.45);
  vec3 color = backdrop(v_uv + offset, blurStep);
  if (u_chromatic > 0.001) {
    vec2 split = lensDirection * edge * opticalProfile * u_chromatic * (u_debugMode > 1.5 ? 6.0 : 1.8) / u_viewport;
    vec3 redSample = texture(u_backdrop, clamp(v_uv + offset + split, 0.0, 1.0)).rgb;
    vec3 blueSample = texture(u_backdrop, clamp(v_uv + offset - split, 0.0, 1.0)).rgb;
    color.r = mix(color.r, redSample.r, 0.34);
    color.b = mix(color.b, blueSample.b, 0.34);
  }
  float fresnel = pow(clamp(edge, 0.0, 1.0), 2.6);
  float directional = pow(max(dot(normal, normalize(vec2(-0.55, -0.83))), 0.0), 5.0);
  float specular = directional * (1.0 - smoothstep(1.0, 10.0, depth)) * 0.34;
  color = mix(color, u_tint, u_tintOpacity);
  color += vec3(fresnel * 0.075 + specular);
  color -= vec3(max(dot(normal, normalize(vec2(0.55, 0.83))), 0.0) * lip * 0.035);
  outColor = vec4(color * alpha, alpha);
}`;
