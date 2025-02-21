uniform float time;
uniform int uNearestPointIndex;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform sampler2D uPosition;
uniform sampler2D uInfo;

uniform vec3 uColors[PLACEHOLDER_NUM_CHARACTERS];

in vec3 position;
in vec2 uv;

out vec2 vUv;
out vec3 vPosition;
out vec3 vColor;
out float vIsNearest;
out float vDebugIndex;

void main() {
  vUv = uv;
  vec4 info = texture(uInfo, uv);
  float characterIndex = info.a; // L'index du personnage est dans le canal alpha
  vDebugIndex = characterIndex;
  
  // Récupérer la couleur du personnage dans le tableau
  int colorIndex = int(characterIndex);
  vColor = uColors[colorIndex];
  
  vIsNearest = float(gl_VertexID == uNearestPointIndex);

  vec4 pos = texture(uPosition, uv);
  
  vec4 mvPosition = modelViewMatrix * vec4(pos.xyz, 1.0);
  gl_PointSize = 2.0 * (1.0 + 1.0 * 2.0) * (1.0 / -mvPosition.z);
  if (vIsNearest > 0.5) {
    gl_PointSize *= 5.0;
  }
  gl_Position = projectionMatrix * mvPosition;
}