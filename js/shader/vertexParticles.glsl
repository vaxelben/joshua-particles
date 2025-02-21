uniform float time;
uniform int uNearestPointIndex;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D uPosition;

in vec3 position;
in vec2 uv;
in vec3 color;

out vec2 vUv;
out vec3 vPosition;
out vec3 vColor;
out float vIsNearest;

void main() {
  vUv = uv;
  vColor = color;
  vIsNearest = float(gl_VertexID == uNearestPointIndex);

  vec4 pos = texture(uPosition, uv);
  
  vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
  gl_PointSize = 2.0 * (1.0 + 1.0 * 2.0) * (1.0 / -mvPosition.z);
  if (vIsNearest > 0.5) {
    gl_PointSize *= 5.0;
  }
  gl_Position = projectionMatrix * mvPosition;
}