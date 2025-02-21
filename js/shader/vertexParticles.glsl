#version 300 es
uniform float time;
uniform int uNearestPointIndex;

out vec2 vUv;
out vec3 vPosition;
out vec3 vColor;
out float vIsNearest;

in vec3 color;
uniform sampler2D uPosition;

void main() {
  vUv = uv;
  vColor = color;
  vIsNearest = float(gl_VertexID == uNearestPointIndex);

  vec4 pos = texture2D(uPosition, uv);
  
  vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
  gl_PointSize = 2.0 * (1.0 + 1. * 2.0) * (1.0 / -mvPosition.z);
  if (vIsNearest > 0.5) {
    gl_PointSize *= 5.0;
  }
  gl_Position = projectionMatrix * mvPosition;
}