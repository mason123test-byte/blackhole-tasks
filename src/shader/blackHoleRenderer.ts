const vertex = `#version 300 es
in vec2 a_position; out vec2 v_uv;
void main(){ v_uv=a_position*.5+.5; gl_Position=vec4(a_position,0.,1.); }`;

const fragment = `#version 300 es
precision highp float; in vec2 v_uv; out vec4 outColor;
uniform float u_time; uniform float u_hover; uniform float u_pulse;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
 vec2 p=(v_uv-.5)*2.; float r=length(p); float a=atan(p.y,p.x);
 float swirl=sin(a*5.-u_time*1.5+r*12.)*.07;
 float disk=exp(-pow((abs(p.y+swirl)*3.6)/(max(.08,abs(p.x))),2.))*smoothstep(.94,.22,r);
 float ring=exp(-pow((r-.38)*18.,2.)); float halo=exp(-pow((r-.58)*5.,2.));
 float dust=step(.986,hash(floor((p+u_time*.003)*75.)))*smoothstep(.85,.32,r);
 vec3 amber=vec3(1.,.47,.13), blue=vec3(.18,.48,.72);
 vec3 color=amber*disk*(1.2+u_hover*.8)+mix(amber,blue,.65)*ring*.8+blue*halo*.22+dust*amber;
 color += amber*u_pulse*exp(-pow((r-.52)*9.,2.));
 float horizon=1.-smoothstep(.27,.31,r); color*=1.-horizon;
 float alpha=smoothstep(.92,.75,r)*(max(max(color.r,color.g),color.b)+horizon*.92);
 outColor=vec4(color,clamp(alpha,0.,1.));
}`;

export function startBlackHole(canvas: HTMLCanvasElement, getHover: () => number, getPulse: () => number, fps = 45) {
  const gl = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!gl) return startCanvasFallback(canvas, getHover, fps);
  const compile = (type: number, source: string) => { const shader = gl.createShader(type)!; gl.shaderSource(shader, source); gl.compileShader(shader); if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? "Shader 编译失败"); return shader; };
  const program = gl.createProgram()!; gl.attachShader(program, compile(gl.VERTEX_SHADER, vertex)); gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragment)); gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "Shader 链接失败");
  const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "a_position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0); gl.useProgram(program);
  let frame = 0; let last = 0; const started = performance.now();
  const render = (now: number) => { frame = requestAnimationFrame(render); if (document.hidden || now-last < 1000/fps) return; last=now; const size=Math.max(96,Math.round(canvas.clientWidth*devicePixelRatio)); if(canvas.width!==size){canvas.width=size;canvas.height=size;} gl.viewport(0,0,size,size); gl.uniform1f(gl.getUniformLocation(program,"u_time"),(now-started)/1000); gl.uniform1f(gl.getUniformLocation(program,"u_hover"),getHover()); gl.uniform1f(gl.getUniformLocation(program,"u_pulse"),getPulse()); gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES,0,6); };
  frame=requestAnimationFrame(render); return () => { cancelAnimationFrame(frame); gl.deleteProgram(program); };
}

function startCanvasFallback(canvas: HTMLCanvasElement, getHover: () => number, fps: number) {
  const context=canvas.getContext("2d")!; let frame=0,last=0;
  const render=(now:number)=>{frame=requestAnimationFrame(render);if(now-last<1000/Math.min(fps,20))return;last=now;const size=Math.max(96,Math.round(canvas.clientWidth*devicePixelRatio));canvas.width=size;canvas.height=size;context.clearRect(0,0,size,size);const c=size/2;const glow=context.createRadialGradient(c,c,size*.1,c,c,size*.46);glow.addColorStop(0,"rgba(0,0,0,.98)");glow.addColorStop(.48,"rgba(0,0,0,.98)");glow.addColorStop(.57,`rgba(255,132,40,${.8+getHover()*.2})`);glow.addColorStop(.72,"rgba(45,117,170,.25)");glow.addColorStop(1,"transparent");context.fillStyle=glow;context.fillRect(0,0,size,size);};
  frame=requestAnimationFrame(render); return()=>cancelAnimationFrame(frame);
}

