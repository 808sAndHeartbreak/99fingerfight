import * as THREE from "three";

/** One GPU pass: printed dots, speed-line tunnel and an irregular ink impact. */
export function createInkStage() {
  const uniforms = {
    uTime: { value: 0 },
    uFocus: { value: 0 },
    uImpact: { value: 0 },
    uAspect: { value: 1 },
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
    uTeam: { value: 0 },
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
      uniform float uTime, uFocus, uImpact, uAspect, uTeam, uSkill, uPulse;
      uniform vec2 uCenter;
      float hash(float n){return fract(sin(n*127.1)*43758.5453);}
      void main(){
        vec2 p=(vUv-uCenter)*vec2(uAspect,1.);
        float r=length(p), a=atan(p.y,p.x);
        vec3 paper=vec3(.949,.929,.882), ink=vec3(.047,.063,.102);
        vec3 team=mix(vec3(.08,.24,.79),vec3(.88,.13,.09),uTeam);
        float sector=floor((a+3.14159)*43.);
        float stroke=pow(max(0.,sin(a*137.+hash(sector)*3.)),18.);
        float dash=.5+.5*sin(r*49.-uTime*26.+hash(sector)*12.);
        float speed=stroke*smoothstep(.18,.65,r)*(.28+dash*.72)*uFocus;
        vec2 dot=fract(gl_FragCoord.xy/5.)-.5;
        float dots=(1.-smoothstep(.12,.21,length(dot)))*smoothstep(.2,.9,r)*.12;
        float wedge=pow(max(0.,cos(a*13.+sin(a*7.)*1.7)),18.);
        float edge=.018+(.065+.19*wedge)*uImpact;
        float burst=(1.-smoothstep(edge,edge+.009,r))*step(.001,uImpact);
        float rim=(1.-smoothstep(.002,.007,abs(r-edge)))*uImpact;
        float wash=smoothstep(.4,1.3,r)*.13*uFocus;
        vec3 col=mix(paper,team,wash);
        // Slow screen-print layers stay at the edges, away from hand values.
        vec2 uv=vUv;
        float drift=sin(uTime*.13)*.012;
        float upper=step(.83+uv.x*.19+drift,uv.y);
        float lower=1.-step(.07+uv.x*.12+drift,uv.y);
        float diagonal=uv.y-uv.x*.25;
        float ribbon=step(.68,diagonal)*step(diagonal,.735);
        float bottomRibbon=step(.015,diagonal)*step(diagonal,.048);
        vec3 cyan=vec3(.10,.66,.69), vermilion=vec3(.91,.22,.15);
        col=mix(col,cyan,ribbon*.66);
        col=mix(col,vermilion,bottomRibbon*.68);
        col=mix(col,ink,clamp(upper+lower,0.,1.)*.93);
        vec2 grid=fract((gl_FragCoord.xy+vec2(uTime*.8,0.))/8.)-.5;
        float halftone=1.-smoothstep(.17,.23,length(grid));
        float edgePrint=smoothstep(.32,.62,abs(uv.y-.5));
        col=mix(col,ink,halftone*edgePrint*.25);
        col=mix(col,paper,halftone*upper*.14);
        float graphite=1.-smoothstep(.001,.0025,abs(uv.y-(.77+uv.x*.16+sin(uv.x*15.+uTime*.12)*.008)));
        col=mix(col,ink,graphite*.28);
        float slip=1.-smoothstep(.002,.005,abs(diagonal-.737));
        col=mix(col,vermilion,slip*.75);
        col=mix(col,ink,clamp(dots+speed*.8+burst,0.,1.));
        col=mix(col,paper,(1.-smoothstep(.02,.028,r))*step(.08,uImpact));
        col=mix(col,team,rim*.8);
        float wave=1.-smoothstep(.008,.027,abs(r-(1.-uPulse)*.6));
        float cut=1.-smoothstep(.012,.025,abs(p.y-p.x*.45));
        float teeth=pow(max(0.,sin(a*9.+r*19.)),14.);
        float bolt=1.-smoothstep(.005,.018,abs(p.y-sin(p.x*38.)*.028));
        float skillShape=uSkill<1.5?wave:uSkill<2.5?cut:uSkill<3.5?bolt:wave*teeth;
        float skillInk=skillShape*uPulse*step(.001,uPulse);
        col=mix(col,team,skillInk);
        float alpha=.96;
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
