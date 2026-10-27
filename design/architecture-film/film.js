import * as THREE from '../../public/vendor/three/three.module.js';
import { RoomEnvironment } from '../../public/vendor/three/RoomEnvironment.js';
export const DURATION = 44;
export const CHAPTERS = [0, 6, 18, 29, 36];
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => { x = clamp(x); return x*x*(3-2*x); };
const mix = (a,b,t) => a+(b-a)*t;
const v = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z);

export function createFilm(canvas, geometry, record, width=3840, height=2160) {
  if (!geometry.atoms?.length || geometry.atoms.some(a=>a.position.length!==3||!a.position.every(Number.isFinite))) throw Error('Invalid film geometry');
  const portrait = width < height;
  const renderer = new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true});
  renderer.setSize(width,height,false); renderer.setPixelRatio(1); renderer.setClearColor(0xe3ecf4,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.86;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(36,width/height,.1,60);camera.position.set(0,.65,16.5);camera.lookAt(0,.15,0);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room,.04);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xffffff,0x718797,1.0));
  const light=new THREE.DirectionalLight(0xf6fbff,2.1);light.position.set(-4,7,8);scene.add(light);
  const rim=new THREE.DirectionalLight(0x91b9ce,1.0);rim.position.set(6,1,-2);scene.add(rim);
  const resources=[],surfaces=[],textures=[];
  const geo=g=>(resources.push(g),g);
  const material=(color,extra={})=>{const m=new THREE.MeshPhysicalMaterial({color,roughness:.30,metalness:.12,clearcoat:.55,clearcoatRoughness:.22,envMapIntensity:.45,...extra});surfaces.push(m);return m;};
  const blue=material(0x2563a6),jade=material(0x257c73),violet=material(0xb8792d),silver=material(0x8399ab),coral=material(0xb84840);
  const carbon=material(0x304d65),nitrogen=material(0x3e64a3),chlorine=material(0x347d65);
  const palette=[blue,jade,violet];
  const ball=geo(new THREE.SphereGeometry(1,48,32)),rod=geo(new THREE.CylinderGeometry(1,1,1,24)),box=geo(new THREE.BoxGeometry(1,1,1));
  function sphere(group,p,r,m){const o=new THREE.Mesh(ball,m);o.position.copy(p);o.scale.setScalar(r);group.add(o);return o;}
  function block(group,p,s,m){const o=new THREE.Mesh(box,m);o.position.copy(p);o.scale.set(...s);group.add(o);return o;}
  function link(group,a,b,r=.035,m=silver){const d=b.clone().sub(a),o=new THREE.Mesh(rod,m);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.set(r,d.length(),r);o.quaternion.setFromUnitVectors(v(0,1),d.normalize());o.userData.path=[a,b];group.add(o);return o;}
  function text(group,message,p,maxWidth=4,color='#29485f',weight='500',size=.29,protect=true){
    const surface=document.createElement('canvas'),ctx=surface.getContext('2d');const lines=message.split('\n');
    ctx.font=`${weight} 100px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;
    surface.width=Math.ceil(Math.max(...lines.map(line=>ctx.measureText(line).width))+96);surface.height=lines.length*140+56;
    ctx.font=`${weight} 100px -apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;
    lines.forEach((line,i)=>ctx.fillText(line,surface.width/2,28+70+i*140));
    const texture=new THREE.CanvasTexture(surface);texture.colorSpace=THREE.SRGBColorSpace;textures.push(texture);
    const m=new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false});surfaces.push(m);
    const sprite=new THREE.Sprite(m);sprite.renderOrder=100;sprite.position.copy(p);const w=Math.min(maxWidth,surface.width/100*size);sprite.scale.set(w,w*surface.height/surface.width,1);group.add(sprite);
    if(protect){const metrics=lines.map(line=>ctx.measureText(line));const inkWidth=Math.max(...metrics.map(m=>m.actualBoundingBoxLeft+m.actualBoundingBoxRight));sprite.userData.label={message,left:(surface.width-inkWidth)/2/surface.width,right:(surface.width+inkWidth)/2/surface.width,top:(98-Math.max(...metrics.map(m=>m.actualBoundingBoxAscent)))/surface.height,bottom:(98+(lines.length-1)*140+Math.max(...metrics.map(m=>m.actualBoundingBoxDescent)))/surface.height};}
    return sprite;
  }
  function ring(group,radius,color){const o=new THREE.Mesh(geo(new THREE.TorusGeometry(radius,.055,12,100)),color);group.add(o);return o;}
  const center=v();geometry.atoms.forEach(a=>center.add(v(...a.position)));center.divideScalar(geometry.atoms.length);
  const coords=geometry.atoms.map(a=>v(...a.position).sub(center));
  function molecule(scale=.4,flat=false){
    const group=new THREE.Group();const points=coords.map(p=>v(p.x*scale,p.y*scale,flat?0:p.z*scale));
    geometry.bonds.forEach(b=>link(group,points[b.start],points[b.end],scale*.15));
    geometry.atoms.forEach((a,i)=>sphere(group,points[i],scale*(a.element==='C'?.54:.68),({O:coral,N:nitrogen,Cl:chlorine})[a.element]||carbon));return group;
  }
  function embedding(group,p,m,scale=1){const root=new THREE.Group();root.position.copy(p);root.scale.setScalar(scale);for(let i=0;i<9;i++)block(root,v((i-4)*.15,0,0),[.10,.35+((i*7)%5)*.14,.22],m);group.add(root);return root;}
  function route(group,points,m){const curve=new THREE.CatmullRomCurve3(points);const mesh=new THREE.Mesh(geo(new THREE.TubeGeometry(curve,60,.025,6,false)),m);mesh.userData.path=curve.getPoints(80);group.add(mesh);const pulse=sphere(group,v(),.085,m);return {curve,pulse};}
  const stages=Array.from({length:5},()=>new THREE.Group());stages.forEach(g=>scene.add(g));
  const titles=['One molecule. Three complementary views.','Three representations, learned together.','Two fusion paths. In parallel.','Combine the representations. Predict a property.','Aqueous solubility, predicted.'];
  const subtitles=['Molecular input · ESOL 044','Sequence Transformer · Hierarchical graph · Fixed 3D distances','The same three embeddings feed both fusion branches','Concatenate → prediction MLP','Saved ESOL example · not live inference'];
  const captionGroups=[];
  stages.forEach((group,i)=>{
    const captions=new THREE.Group();text(captions,titles[i],v(0,portrait?4.45:4.05,0),portrait?5.45:12,'#18394e','600',.52);
    text(captions,subtitles[i],v(0,portrait?3.8:3.43,0),portrait?5.2:10.5,'#3f5e72','500',.26);group.add(captions);captionGroups.push(captions);
  });
  // Input: optical scan, then three outgoing representation paths.
  const input=molecule(.49);stages[0].add(input);
  const aperture=ring(stages[0],2.7,silver);aperture.rotation.x=.3;
  const scanner=ring(stages[0],2.75,blue);scanner.rotation.x=Math.PI/2;
  const inputPaths=palette.map((m,i)=>route(stages[0],[v(0,-1.8,-.2),v((i-1)*1.4,-2.5,.3),v((i-1)*2.7,-3.1,.2)],m));
  text(stages[0],record.smiles,v(0,-3.7,0),portrait?5:10,'#526d81');
  // Encoders: real graph topology, conceptual motif pooling and real RBF distances.
  const viewCenters=portrait?[v(0,2.2),v(0,-.3),v(0,-2.8)]:[v(-5.1,0),v(0,0),v(5.1,0)];
  const views=viewCenters.map(p=>{const g=new THREE.Group();g.position.copy(p);stages[1].add(g);return g;});
  const tokens='O C ( c 1 ... )'.split(' ');const tokenMeshes=[];
  tokens.forEach((token,i)=>{const g=new THREE.Group();block(g,v(),[.46,.56,.19],blue);text(g,token,v(0,0,.15),.46,'#f2f8fc','600',.29,false);g.position.set((i-3)*.53,.55,0);views[0].add(g);tokenMeshes.push(g);});
  const transformer=new THREE.Group();views[0].add(transformer);
  for(let i=0;i<3;i++){const slab=block(transformer,v((i-1)*.2,-.18,-.2),[1.6,.13,1.0],silver);slab.rotation.set(.2,0,.12);}
  text(views[0],'Sequence · character Transformer',v(0,portrait?1.45:1.95,0),portrait?4.7:4.4,'#285d92','600');
  text(views[0],'Masked mean pooling',v(0,portrait?-1.4:-1.65,0),3.5);
  const graph=molecule(portrait?.16:.22,true);graph.rotation.z=.2;graph.position.y=portrait?.3:.55;views[1].add(graph);
  const motifs=[];
  for(let i=0;i<3;i++){const orb=sphere(views[1],v((i-1)*.82,-.83,.4),.23,jade);motifs.push(orb);if(i)link(views[1],v((i-2)*.82,-.83,.4),orb.position,.04,jade);}
  text(views[1],'Structure · atom-to-motif hierarchy',v(0,portrait?1.45:1.95,0),portrait?4.7:4.3,'#367a76','600');
  text(views[1],'Message passing · motif Transformer',v(0,portrait?-1.4:-1.65,0),portrait?4.8:3.9);
  const spatial=molecule(portrait?.17:.23);spatial.rotation.set(-.25,.3,.2);spatial.position.set(-.35,.35,0);views[2].add(spatial);
  const matrix=new THREE.Group();matrix.position.set(portrait?1.2:1.45,-.5,.25);matrix.rotation.set(.55,.2,.15);views[2].add(matrix);
  for(let row=0;row<5;row++)for(let col=0;col<5;col++){
    const distance=coords[row].distanceTo(coords[col]);const response=Math.exp(-distance*distance/8);
    block(matrix,v((row-2)*.16,(col-2)*.16,0),[.135,.135,.05+response*.19],row===col?silver:violet);
  }
  text(views[2],'Geometry · 3D distance encoder',v(0,portrait?1.45:1.95,0),portrait?4.9:4.6,'#915d20','600');
  text(views[2],'Fixed RBF distance features',v(0,portrait?-1.4:-1.65,0),3.9);
  const encoded=views.map((g,i)=>embedding(g,portrait?v(2.8,-.35,0):v(0,-2.6,0),palette[i],portrait?.5:.8));
  const encoderFlows=views.map((group,i)=>route(group,portrait?[v(1.7,-.15,.3),v(2.3,.05,.3),v(2.8,-.35,0)]:[v(1.45,-.35,.2),v(2.25,-.7,.2),v(2.25,-2.35,.2),v(0,-2.6,0)],palette[i]));
  views.forEach((group,i)=>text(group,'h'+String(i+1),portrait?v(3.85,-.35,.1):v(0,-3.2,.1),.8,['#245e9b','#236e66','#915d20'][i],'600',.30));
  const alignment=new THREE.Group();stages[1].add(alignment);
  text(alignment,'Pairwise contrastive alignment · training objective',v(0,portrait?-4.55:-4.05,0),portrait?5.2:10,'#526d81');
  if(portrait){views.forEach(g=>g.scale.setScalar(.72));captionGroups[1].position.y=.2;}
  // Fusion: two independent parallel pathways, never a serial gate→Transformer chain.
  const fusion=stages[2],gated=new THREE.Group(),cross=new THREE.Group();fusion.add(gated,cross);
  gated.position.copy(portrait?v(-1.55,0):v(-3.7,0));cross.position.copy(portrait?v(1.55,0):v(3.7,0));if(portrait){gated.scale.setScalar(.7);cross.scale.setScalar(.7);}
  const gates=[],fusionRoutes=[],fusionInputs=[];
  palette.forEach((m,i)=>{
    const source=portrait?v((i-1)*1.45,2.9,0):v((i-1)*1.7,2.4,0);fusionInputs.push(embedding(fusion,source,m,.65));
    fusionRoutes.push(route(fusion,[source,v(gated.position.x+(i-1)*.45,portrait?1.7:1.65,.25),gated.position.clone().add(v((i-1)*(portrait?.63:.9),portrait?.7:1.0,0))],m));
    fusionRoutes.push(route(fusion,[source,v(cross.position.x+(i-1)*.45,portrait?1.7:1.65,-.25),cross.position.clone().add(v((i-1)*(portrait?.63:.9),portrait?.7:1.0,0))],m));
    const gate=block(gated,v((i-1)*.93,0,0),[.50,.25+record.gates[i]*1.35,.50],m);gates.push(gate);
    if(!portrait)text(gated,(record.gates[i]*100).toFixed(2)+'%',v((i-1)*.93,-1.0,0),1.15);
  });
  text(gated,portrait?'Dynamic\nview gating':'Dynamic view gating',v(0,-1.65,0),portrait?3.3:4.6,'#285d92','600');text(gated,'Weighted sum',v(0,-2.55,0),3.0);
  const attention=new THREE.Group();cross.add(attention);
  for(let i=0;i<3;i++){const slab=block(attention,v(0,(i-1)*.37,0),[2.5,.13,1.5],palette[i]);slab.rotation.y=.25;}
  for(let i=0;i<6;i++){const a=v(-1.05,(i%3-1)*.37,.1),b=v(1.05,((i+1)%3-1)*.37,.1);link(attention,a,b,.025,palette[i%3]);}
  text(cross,portrait?'Cross-modal\nTransformer':'Cross-modal Transformer',v(0,-1.65,0),portrait?3.3:5.1,'#915d20','600');text(cross,portrait?'Mean pool + norm':'View interactions · mean pool + norm',v(0,-2.55,0),portrait?3.2:5.2);
  const gatedOutput=embedding(gated,v(0,-3.4,.2),blue,portrait?.5:.75);const crossOutput=embedding(cross,v(0,-3.4,.2),violet,.75);
  if(portrait)text(fusion,'Saved view weights: '+record.gates.map(g=>(g*100).toFixed(2)+'%').join(' · '),v(0,-3.5,0),5.3,'#526d81','500',.25);
  // Concatenation and the actual prediction-head dimensions.
  const head=stages[3];const combined=new THREE.Group();head.add(combined);
  const h1=embedding(combined,v(-.85,1.85,0),blue,.85),h2=embedding(combined,v(.85,1.85,0),violet,.85);
  text(head,'[ h_gated ; h_fused ]',v(0,2.65,0),portrait?4.6:7);
  text(head,'Concatenate · 512 dimensions',v(0,1.0,0),4.3,'#285d92','600');
  const layers=[6,5,3,1],nodes=[],headRoutes=[];
  layers.forEach((count,layer)=>{
    const list=[];for(let i=0;i<count;i++){const p=portrait?v((i-(count-1)/2)*.62,.1-layer*.9,0):v((layer-1.5)*2.7,(i-(count-1)/2)*.59-.75,(layer%2)*.25);list.push(sphere(head,p,layer===3?.24:.14,palette[layer%3]));}nodes.push(list);
  });
  nodes.flat().forEach(node=>{node.material=node.material.clone();surfaces.push(node.material);});
  nodes.slice(0,-1).forEach((list,l)=>list.forEach(a=>nodes[l+1].forEach(b=>{link(head,a.position,b.position,.016,silver);})));
  for(let i=0;i<3;i++)headRoutes.push(route(head,[nodes[0][i].position,nodes[1][i%5].position,nodes[2][i%3].position,nodes[3][0].position],palette[i]));
  text(head,'Prediction MLP · 512 → 256 → 128 → 1',v(0,portrait?-3.5:-3.3,0),portrait?5.2:10);
  // Output is a stored observation, never a fabricated real-time inference.
  const output=stages[4];const outputMolecule=molecule(portrait?.20:.28);outputMolecule.position.set(portrait?0:-4.3,portrait?1.8:0,0);output.add(outputMolecule);
  const resultGroup=new THREE.Group();resultGroup.position.set(portrait?0:2.3,portrait?-.8:.25,0);output.add(resultGroup);
  text(resultGroup,record.predictions.fused.toFixed(3),v(0,.4,1),portrait?5.5:6.5,'#285d92','600',1.2);
  text(resultGroup,'log₁₀(mol/L)',v(0,-.55,1),portrait?3.6:4);
  text(output,'Observed '+record.target.toFixed(3)+'  ·  ESOL 044',v(0,-2.8,0),portrait?5.2:9);
  text(output,'Saved prediction · fused head',v(0,-3.45,0),portrait?5:8.5,'#526d81');
  const guide=new THREE.Group();scene.add(guide);
  text(guide,'TriBioNode',v(0,portrait?5.3:4.85,-1),portrait?2.2:3.1,'#6f8c9f');
  // Fade the completed frame, so translucent atoms cannot reveal bonds or other objects inside them.
  const fadeScene=new THREE.Scene(),fadeCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,2);fadeCamera.position.z=1;
  const fadeMaterial=new THREE.MeshBasicMaterial({color:0xe3ecf4,transparent:true,depthTest:false,depthWrite:false,toneMapped:false});surfaces.push(fadeMaterial);
  fadeScene.add(new THREE.Mesh(geo(new THREE.PlaneGeometry(2,2)),fadeMaterial));renderer.autoClear=false;
  const boundaries=[0,6,18,29,36,44];
  function render(time,draw=true){
    time=Math.max(0,Math.min(DURATION-.001,time));
    let active=0;
    CHAPTERS.forEach((start,i)=>{if(time>=start)active=i;});
    stages.forEach((group,i)=>{group.visible=i===active;});
    fadeMaterial.opacity=1-(active===0?1:ease((time-boundaries[active])/.65))*(1-ease((time-boundaries[active+1]+.65)/.65));
    const enter=ease(time/2);
    input.position.set(0,mix(.5,0,enter),mix(-3,0,enter));input.scale.setScalar(mix(.6,1,enter));input.rotation.set(-.25+Math.sin(time*.5)*.08,-.3+Math.sin(time*.3)*.25,.18);
    scanner.position.y=mix(-2.2,2.2,(time%4)/4);inputPaths.forEach((r,i)=>{r.pulse.position.copy(r.curve.getPointAt(clamp((time-3.1-i*.18)/1.8)));r.pulse.visible=time>3;});
    views.forEach((g,i)=>g.position.copy(viewCenters[i]));
    tokenMeshes.forEach((g,i)=>{g.position.y=.55+Math.sin(time*1.2-i*.5)*.06;g.rotation.y=Math.sin(time*.7-i*.3)*.12;});
    encoderFlows.forEach((flow,i)=>{const u=clamp((time-10-i*.35)/3.7);flow.pulse.visible=time>=10&&time<17;flow.pulse.position.copy(flow.curve.getPointAt(u));});
    transformer.rotation.y=Math.sin(time*.2)*.12;graph.rotation.y=Math.sin(time*.3)*.09;spatial.rotation.y=.3+Math.sin(time*.32)*.24;
    motifs.forEach((o,i)=>o.scale.setScalar(.23*(1+Math.sin(time*1.6-i)*.08)));matrix.rotation.y=.2+Math.sin(time*.2)*.12;
    alignment.visible=time>=13.5;encoded.forEach((g,i)=>{g.visible=true;g.scale.setScalar((portrait?.5:.8)*ease((time-12.5-i*.3)/1.4));});
    gatedOutput.visible=crossOutput.visible=time>=23;
    gates.forEach((g,i)=>{g.scale.y=(.25+record.gates[i]*1.35)*mix(.15,1,ease((time-19.3-i*.2)/2));});
    fusionRoutes.forEach((r,i)=>{r.pulse.visible=time>=19.2;r.pulse.position.copy(r.curve.getPointAt(((Math.max(0,time-19.2)*.22+i*.11)%1)));});
    attention.rotation.y=Math.sin(time*.23)*.16;
    h1.visible=h2.visible=true;h1.position.x=mix(-.95,-.73,ease((time-30.2)/1.2));h2.position.x=-h1.position.x;
    headRoutes.forEach((r,i)=>r.pulse.position.copy(r.curve.getPointAt(clamp((time-31.4-i*.45)/3.4))));
    outputMolecule.rotation.set(-.25,-.25+Math.sin(time*.25)*.15,.18);
    nodes.forEach((layer,i)=>layer.forEach(node=>{const activation=Math.max(0,1-Math.abs((time-31.2)*1.05-i));node.material.emissive.copy(node.material.color);node.material.emissiveIntensity=activation*.35;}));
    camera.position.x=Math.sin(time*.13)*.05;camera.lookAt(0,.15,0);camera.updateMatrixWorld();scene.updateMatrixWorld(true);
    if(draw){renderer.clear();renderer.render(scene,camera);if(fadeMaterial.opacity>0)renderer.render(fadeScene,fadeCamera);}
    canvas.dataset.chapter=String(active);canvas.dataset.time=time.toFixed(2);canvas.dataset.state='ready';
  }
  function checkLayout(){
    const issues=[],meshes=[],rectangles=[];
    const project=p=>{p.project(camera);return {x:(p.x+1)*width/2,y:(1-p.y)*height/2};};
    scene.traverseVisible(object=>{
      if(object.material?.opacity<.05)return;
      if(object.userData.label){
        const label=object.userData.label,position=object.getWorldPosition(v()),center=project(position.clone()),scale=object.getWorldScale(v());
        const depth=-position.applyMatrix4(camera.matrixWorldInverse).z;
        const w=scale.x*camera.projectionMatrix.elements[0]/depth*width/2,h=scale.y*camera.projectionMatrix.elements[5]/depth*height/2;
        rectangles.push({name:label.message,left:center.x+(label.left-.5)*w-4,right:center.x+(label.right-.5)*w+4,top:center.y+(label.top-.5)*h-4,bottom:center.y+(label.bottom-.5)*h+4});
      }else if(object.isMesh)meshes.push(object);
    });
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    const segmentHits=(r,a,b)=>{
      let near=0,far=1;
      for(const [origin,delta,min,max] of [[a.x,b.x-a.x,r.left,r.right],[a.y,b.y-a.y,r.top,r.bottom]]){
        if(Math.abs(delta)<1e-8){if(origin<min||origin>max)return false;continue;}
        const t1=(min-origin)/delta,t2=(max-origin)/delta;near=Math.max(near,Math.min(t1,t2));far=Math.min(far,Math.max(t1,t2));if(near>far)return false;
      }
      return true;
    };
    const meshBounds=meshes.map(mesh=>{
      if(mesh.material.transparent||mesh.material.opacity!==1)issues.push('Translucent 3D object inside a chapter');
      let owner=mesh.parent;while(owner&&!stages.includes(owner))owner=owner.parent;
      if(!owner)issues.push('3D object outside chapter ownership');
      if(mesh.userData.path)return {mesh,path:mesh.userData.path.map(p=>project(p.clone().applyMatrix4(mesh.parent.matrixWorld)))};
      if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
      const {min,max}=mesh.geometry.boundingBox,points=[];
      for(const x of [min.x,max.x])for(const y of [min.y,max.y])for(const z of [min.z,max.z])points.push(project(v(x,y,z).applyMatrix4(mesh.matrixWorld)));
      return {mesh,rect:{left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),top:Math.min(...points.map(p=>p.y)),bottom:Math.max(...points.map(p=>p.y))}};
    });
    const lookup=new Map(meshBounds.map(item=>[item.mesh,item]));
    const region=roots=>{
      const boxes=[];for(const root of [roots].flat())root.traverseVisible(object=>{const item=lookup.get(object);if(item)boxes.push(item.rect||{left:Math.min(...item.path.map(p=>p.x)),right:Math.max(...item.path.map(p=>p.x)),top:Math.min(...item.path.map(p=>p.y)),bottom:Math.max(...item.path.map(p=>p.y))});});
      return boxes.length?{left:Math.min(...boxes.map(b=>b.left)),right:Math.max(...boxes.map(b=>b.right)),top:Math.min(...boxes.map(b=>b.top)),bottom:Math.max(...boxes.map(b=>b.bottom))}:null;
    };
    for(const [a,b,name] of [[views[0],views[1],'Sequence / structure'],[views[1],views[2],'Structure / geometry'],[graph,motifs,'Atom graph / motif pool'],[spatial,matrix,'Molecule / distance matrix'],[gated,cross,'Parallel fusion branches'],[h1,h2,'Concatenated embeddings']]){
      const first=region(a),second=region(b);if(first&&second&&overlaps(first,second))issues.push('Separate components overlap: '+name);
    }
    rectangles.forEach((rect,i)=>{
      if(rect.left<0||rect.right>width||rect.top<0||rect.bottom>height)issues.push('Clipped label: '+rect.name);
      rectangles.slice(i+1).forEach(other=>{if(overlaps(rect,other))issues.push('Labels overlap: '+rect.name+' / '+other.name);});
      for(const item of meshBounds){
        const hit=item.path?item.path.some((p,j)=>j&&segmentHits(rect,item.path[j-1],p)):overlaps(rect,item.rect);
        if(hit){issues.push('Object crosses label: '+rect.name);break;}
      }
    });
    if(stages.filter(group=>group.visible).length>1)issues.push('Multiple chapters visible');
    return issues;
  }
  render(0);
  console.assert(stages.length===5&&geometry.atoms.length===22,'Film must preserve the five chapters and saved ESOL geometry.');
  return {render,checkLayout,renderer,dispose(){resources.forEach(g=>g.dispose());surfaces.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());environment.dispose();renderer.dispose();}};
}
