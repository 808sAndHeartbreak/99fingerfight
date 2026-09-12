import * as THREE from "three";

/** One GPU pass: calm paper at rest, speed lines and ink only during contact. */
export function createInkStage() {
  const uniforms = {
    uTime: { value: 0 },
    uFocus: { value: 0 },
    uImpact: { value: 0 },
    uAspect: { value: 1 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uTeam: { value: 0 },
    uActive: { value: -1 },
    uSkill: { value: 0 }, uPulse: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy, .999, 1.);}",
    fragmentShader: `
      varying vec2 vUv;
      uniform float uTime, uFocus, uImpact, uAspect, uTeam, uSkill, uPulse, uActive;
      uniform vec2 uCenter;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        vec2 p=(vUv-uCenter)*vec2(uAspect,1.);
        float r=length(p), a=atan(p.y,p.x);
        vec3 paper=vec3(.949,.929,.882), ink=vec3(.027,.035,.065);
        vec3 team=mix(vec3(.08,.24,.79),vec3(.88,.13,.09),uTeam);
        float sector=floor((a+3.14159)*43.);
        float stroke=pow(max(0.,sin(a*137.+hash(sector)*3.)),18.);
        float dash=.5+.5*sin(r*49.-uTime*26.+hash(sector)*12.);
        float speed=stroke*smoothstep(.18,.65,r)*(.28+dash*.72)*uFocus;
        vec2 cell=fract(gl_FragCoord.xy/5.)-.5;
        float dots=(1.-smoothstep(.12,.21,length(cell)))*smoothstep(.2,.9,r)*.12;
        float wedge=pow(max(0.,cos(a*13.+sin(a*7.)*1.7)),18.);
        float edge=.018+(.065+.19*wedge)*uImpact;
        float burst=(1.-smoothstep(edge,edge+.009,r))*step(.001,uImpact);
        float rim=(1.-smoothstep(.002,.007,abs(r-edge)))*uImpact;
        float wash=smoothstep(.4,1.3,r)*.13*uFocus;
        // Indigo print field: the cream hands remain the brightest large forms.
        float grain=fract(sin(dot(floor(gl_FragCoord.xy),vec2(12.9898,78.233)))*43758.5453)-.5;
        float vignette=smoothstep(.22,.78,length((vUv-.5)*vec2(.85,1.)));
        float blueGlow=exp(-length((vUv-vec2(.02,.52))*vec2(2.,1.4))*5.);
        float redGlow=exp(-length((vUv-vec2(.98,.52))*vec2(2.,1.4))*5.);
        vec3 surface=mix(vec3(.105,.125,.235),ink,vignette*.72)+grain*.006;
        surface=mix(surface,vec3(.16,.25,.55),blueGlow*.35);
        surface=mix(surface,vec3(.39,.12,.24),redGlow*.25);
        float activeX=mix(.26,.74,clamp(uActive,0.,1.));
        float backing=(1.-smoothstep(.15,.24,abs(vUv.x-activeX)))*(1.-smoothstep(.38,.49,abs(vUv.y-.5)))*step(-.5,uActive);
        surface=mix(surface,mix(vec3(.36,.49,.72),vec3(.65,.35,.37),clamp(uActive,0.,1.)),backing*.25);
        float printDots=(1.-smoothstep(.08,.16,length(cell)))*smoothstep(.28,.7,r);
        surface+=printDots*.013;
        vec3 col=mix(surface,team,wash);
        col=mix(col,ink,clamp(dots*uFocus+speed*.8+burst,0.,1.));
        col=mix(col,paper,(1.-smoothstep(.02,.028,r))*step(.08,uImpact));
        col=mix(col,team,rim*.8);
        float wave=1.-smoothstep(.008,.027,abs(r-(1.-uPulse)*.6));
        float cut=wave*(.5+.5*pow(abs(cos(a*3.)),6.));
        float teeth=pow(max(0.,sin(a*9.+r*19.)),14.);
        float bolt=1.-smoothstep(.005,.018,abs(p.y-sin(p.x*38.)*.028));
        float skillShape=uSkill<1.5?wave:uSkill<2.5?cut:uSkill<3.5?bolt:wave*teeth;
        float skillInk=skillShape*uPulse*step(.001,uPulse);
        col=mix(col,team,skillInk);
        float alpha=.79;
        gl_FragColor=vec4(col,alpha);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
}

/** Position a hand using the actual posed finger, not an approximate radius. */
export function contactPosition(anchor, scale, rotation, target) {
  return target
    .clone()
    .sub(anchor.clone().multiplyScalar(scale).applyQuaternion(rotation));
}
