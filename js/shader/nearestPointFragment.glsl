precision highp float;

uniform sampler2D uPosition;
uniform vec3 uCameraPos;
uniform float textureSize;

out vec4 fragColor;

void main() {
    float minDistance = 1000000.0;  // Grande valeur initiale
    float nearestIndex = -1.0;
    
    // Parcourir tous les points
    for(float y = 0.0; y < textureSize; y++) {
        for(float x = 0.0; x < textureSize; x++) {
            vec2 uv = vec2(x, y) / textureSize;
            vec4 pos = texture(uPosition, uv);
            
            if (pos.w > 0.0) {  // Vérifier si le point existe
                float dist = length(pos.xyz - uCameraPos);
                if (dist < minDistance) {
                    minDistance = dist;
                    nearestIndex = y * textureSize + x;
                }
            }
        }
    }
    
    fragColor = vec4(minDistance, nearestIndex, 0.0, 1.0);
} 