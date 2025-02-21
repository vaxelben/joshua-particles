#version 300 es
uniform float time;
uniform float progress;
uniform sampler2D texture1;
uniform vec4 resolution;
in vec2 vUv;
in vec3 vColor;
in float vIsNearest;

out vec4 fragColor;

void main() {
    vec3 color = vColor;
    float alpha = 0.5;
    
    if (vIsNearest > 0.5) {
        // Faire pulser le point le plus proche
        // color = mix(color, vec3(1.0), 0.5 + 0.5 * sin(time * 0.1));
        alpha = 1.0;
    }
    
    fragColor = vec4(color, alpha);
}