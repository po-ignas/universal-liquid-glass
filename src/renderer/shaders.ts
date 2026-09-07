export const VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_position;
uniform vec4 u_rect;
uniform vec2 u_viewport;
uniform vec2 u_sourceOffset;
uniform vec2 u_sourceSize;
out vec2 v_uv;
out vec2 v_local;
void main() {
  vec2 unit = a_position * 0.5 + 0.5;
  vec2 pixel = u_rect.xy + unit * u_rect.zw;
  vec2 clip = pixel / u_viewport * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_uv = (pixel + u_sourceOffset) / u_sourceSize;
  v_local = (unit - 0.5) * u_rect.zw;
}`;

export const FRAGMENT_SHADER = `#version 300 es
precision highp float;
in vec2 v_uv;
in vec2 v_local;
out vec4 outColor;
uniform sampler2D u_backdrop;
uniform vec2 u_viewport;
uniform vec2 u_sourceSize;
uniform vec2 u_textureSize;
uniform vec4 u_rect;
uniform float u_radius;
uniform float u_refraction;
uniform float u_thickness;
uniform float u_bevelWidth;
uniform float u_ior;
uniform float u_blur;
uniform float u_specular;
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
float lensHeight(vec2 point, vec2 halfSize, float radius, float bevel, float thickness) {
  float depth = max(-roundedBox(point, halfSize, radius), 0.0);
  float t = clamp(depth / bevel, 0.0, 1.0);
  float edgeAxis = 1.0 - t;
  return thickness * sqrt(max(1.0 - edgeAxis * edgeAxis, 0.0));
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
  float thickness = max(u_thickness, 0.01);
  float bevelLimit = max(min(halfSize.x, halfSize.y) - 1.0, 1.0);
  float bevel = min(max(u_bevelWidth, 1.0), bevelLimit);
  float debugStrength = u_debugMode > 1.5 ? 4.5 : 1.0;

  // The cap height and its numerical gradient describe one continuous virtual
  // lens. The flat interior is the top of that same surface, not a separately
  // tuned displacement zone.
  float epsilon = 0.75;
  float height = lensHeight(v_local, halfSize, radius, bevel, thickness);
  vec2 heightGradient = vec2(
    lensHeight(v_local + vec2(epsilon, 0.0), halfSize, radius, bevel, thickness)
      - lensHeight(v_local - vec2(epsilon, 0.0), halfSize, radius, bevel, thickness),
    lensHeight(v_local + vec2(0.0, epsilon), halfSize, radius, bevel, thickness)
      - lensHeight(v_local - vec2(0.0, epsilon), halfSize, radius, bevel, thickness)
  ) / (2.0 * epsilon);
  float slope = min(length(heightGradient), 4.0);
  vec2 slopeDirection = slope > 0.0001 ? heightGradient / length(heightGradient) : vec2(0.0);
  float incidentAngle = atan(slope);
  float transmittedAngle = asin(clamp(sin(incidentAngle) / max(u_ior, 1.001), 0.0, 0.999));
  float displacement = height * tan(incidentAngle - transmittedAngle)
    * u_refraction * debugStrength;
  vec2 offset = -slopeDirection * displacement / max(u_sourceSize, vec2(1.0));

  float lensResponse = clamp(displacement / max(thickness * 0.35, 1.0), 0.0, 1.0);
  if (u_debugMode > 2.5) {
    outColor = vec4(vec3(lensResponse) * alpha, alpha);
    return;
  }

  // Frost is deliberately independent from the geometric displacement.
  vec2 blurStep = vec2(max(u_blur, 0.0)) / max(u_textureSize, vec2(1.0));
  vec3 color = backdrop(v_uv + offset, blurStep);
  if (u_chromatic > 0.001) {
    vec2 split = slopeDirection * displacement * u_chromatic * 0.08 / max(u_sourceSize, vec2(1.0));
    vec3 redSample = texture(u_backdrop, clamp(v_uv + offset + split, 0.0, 1.0)).rgb;
    vec3 blueSample = texture(u_backdrop, clamp(v_uv + offset - split, 0.0, 1.0)).rgb;
    color.r = mix(color.r, redSample.r, 0.14);
    color.b = mix(color.b, blueSample.b, 0.14);
  }

  vec2 shapeGradient = vec2(
    roundedBox(v_local + vec2(epsilon, 0.0), halfSize, radius) - roundedBox(v_local - vec2(epsilon, 0.0), halfSize, radius),
    roundedBox(v_local + vec2(0.0, epsilon), halfSize, radius) - roundedBox(v_local - vec2(0.0, epsilon), halfSize, radius)
  );
  vec2 outwardNormal = length(shapeGradient) > 0.0001 ? normalize(shapeGradient) : vec2(0.0, -1.0);
  vec3 surfaceNormal = normalize(vec3(-heightGradient, 1.0));
  float bevelMask = 1.0 - smoothstep(0.0, bevel, depth);
  float opticalLip = 1.0 - smoothstep(0.0, 2.25, depth);
  float fresnel = pow(1.0 - clamp(surfaceNormal.z, 0.0, 1.0), 2.2);
  float directional = pow(max(dot(surfaceNormal, normalize(vec3(-0.42, -0.62, 0.66))), 0.0), 18.0);
  float innerDepth = bevelMask * (0.045 + 0.04 * max(dot(outwardNormal, normalize(vec2(0.55, 0.84))), 0.0));
  color *= 1.0 - innerDepth;
  color = mix(color, u_tint, u_tintOpacity);
  color += vec3(u_specular * (fresnel * 0.22 + directional * bevelMask * 0.18 + opticalLip * 0.08));
  outColor = vec4(color * alpha, alpha);
}`;
