import {createFilm,DURATION,CHAPTERS} from './film.js';
const canvas=document.querySelector('canvas'),status=document.getElementById('status'),format=document.querySelector('select'),slider=document.querySelector('input'),output=document.querySelector('output'),play=document.getElementById('play'),record=document.getElementById('record'),poster=document.getElementById('poster'),hq=document.getElementById('hq');
const geometry=await fetch('/conformers/esol-044.json').then(r=>r.json()),data=await fetch('/src/research-data.json').then(r=>r.json());const molecule=data.records.find(r=>r.id==='esol-044');
let film,time=0,playing=false,recording=false,start=0;
function save(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function build(){if(film){film.renderer.setAnimationLoop(null);film.dispose();}const portrait=format.value==='portrait';film=createFilm(canvas,geometry,molecule,portrait?1440:3840,portrait?2560:2160);time=0;playing=false;slider.value='0';output.textContent='0.00 s';play.textContent='Play preview';film.render(0);film.renderer.setAnimationLoop(frame);status.textContent='Ready · five chapters · 44 seconds · actual saved ESOL example';}
function frame(now){if(!playing)return;time=(now-start)/1000;if(time>=DURATION){if(recording){film.render(DURATION-.001);return;}time=0;start=now;}film.render(time);slider.value=String(time);output.textContent=time.toFixed(2)+' s';}
format.addEventListener('change',build);
play.addEventListener('click',()=>{playing=!playing;start=performance.now()-time*1000;play.textContent=playing?'Pause preview':'Play preview';});
slider.addEventListener('input',()=>{time=Number(slider.value);start=performance.now()-time*1000;film.render(time);output.textContent=time.toFixed(2)+' s';});
['Molecule input','Three encoders','Parallel fusion','Prediction MLP','Saved output'].forEach((name,i)=>{const b=document.createElement('button');b.textContent=name;b.addEventListener('click',()=>{time=CHAPTERS[i]+1.5;playing=false;play.textContent='Play preview';slider.value=String(time);output.textContent=time.toFixed(2)+' s';film.render(time);});document.getElementById('chapters').append(b);});
poster.addEventListener('click',()=>canvas.toBlob(blob=>save(blob,`tribionode-architecture-${format.value}-poster.png`)));
record.addEventListener('click',()=>{
 const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime){status.textContent='WebM recording unavailable';return;}
 const stream=canvas.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:40000000}),chunks=[];
 document.querySelectorAll('button,select,input').forEach(e=>e.disabled=true);recording=true;time=0;film.render(0);start=performance.now();playing=true;
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
 recorder.onstop=()=>{recording=false;playing=false;stream.getTracks().forEach(t=>t.stop());document.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);save(new Blob(chunks,{type:mime}),`tribionode-architecture-${format.value}.webm`);status.textContent='Film captured · '+format.value+' · 44 seconds';};
 recorder.start();status.textContent='Recording the complete 44-second architecture story…';setTimeout(()=>recorder.stop(),DURATION*1000+100);
});
build();[play,record,poster,hq].forEach(b=>b.disabled=false);

hq.addEventListener('click',async()=>{
 if(!('VideoEncoder' in window)){status.textContent='WebCodecs unavailable; the preview recorder remains available.';return;}
 let encoder,error,encoded=0;const chunks=[];const frames=DURATION*30;
 document.querySelectorAll('button,select,input').forEach(e=>e.disabled=true);playing=false;recording=true;film.renderer.setAnimationLoop(null);
 try{
  let config;
  for(const codec of ['avc1.640033','avc1.4d0033','avc1.420033']){
   const candidate={codec,width:canvas.width,height:canvas.height,framerate:30,bitrate:format.value==='landscape'?48000000:28000000,latencyMode:'quality',hardwareAcceleration:'prefer-hardware',avc:{format:'annexb'}};
   if((await VideoEncoder.isConfigSupported(candidate)).supported){config=candidate;break;}
  }
  if(!config)throw Error('No compatible H.264 master encoder');
  encoder=new VideoEncoder({output(chunk){const bytes=new Uint8Array(chunk.byteLength);chunk.copyTo(bytes);chunks.push(bytes);encoded++;},error(reason){error=reason;}});encoder.configure(config);
  for(let i=0;i<frames;i++){
   if(error)throw error;
   film.render(i/30);
   const collisions=film.checkLayout();if(collisions.length)throw Error(`Layout collision at ${(i/30).toFixed(2)}s: ${collisions.join("; ")}`);
   const frame=new VideoFrame(canvas,{timestamp:Math.round(i*1000000/30),duration:Math.round(1000000/30)});
   encoder.encode(frame,{keyFrame:i%60===0});frame.close();
   if(i%4===0){status.textContent=`Rendering premium ${format.value}: ${i+1} / ${frames} frames (${Math.floor((i+1)/frames*100)}%)`;await new Promise(resolve=>setTimeout(resolve,0));}
   if(encoder.encodeQueueSize>12)await encoder.flush();
  }
  await encoder.flush();if(error)throw error;
  if(encoded!==frames)throw Error(`Frame count mismatch: ${encoded} / ${frames}`);
  save(new Blob(chunks,{type:'video/h264'}),`tribionode-refined-${format.value}.h264`);
  status.textContent=`Premium master ready · ${canvas.width} × ${canvas.height} · ${encoded} frames · exact 30 fps`;
 }catch(reason){status.textContent='Premium render failed: '+reason.message;}
 finally{if(encoder&&encoder.state!=='closed')encoder.close();recording=false;playing=false;document.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);film.render(time);film.renderer.setAnimationLoop(frame);}
});

document.getElementById('audit').addEventListener('click',async()=>{
 const saved=time,issues=new Map();playing=false;film.renderer.setAnimationLoop(null);
 document.querySelectorAll('button,select,input').forEach(e=>e.disabled=true);
 try{
  for(let i=0;i<DURATION*30;i++){
   film.render(i/30,false);
   for(const issue of film.checkLayout())if(!issues.has(issue))issues.set(issue,(i/30).toFixed(2));
   if(i%120===0){status.textContent=`Checking spacing: ${i} / ${DURATION*30} frames`;await new Promise(resolve=>setTimeout(resolve,0));}
  }
  const report={format:format.value,frames:DURATION*30,issues:[...issues].map(([issue,time])=>({time,issue}))};
  status.textContent=issues.size?'Spacing check failed: '+JSON.stringify(report.issues):`Spacing check passed · ${report.frames} frames · no text/object or chapter overlap`;
  canvas.dataset.layoutCheck=issues.size?'failed':'passed';
  save(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),`tribionode-spacing-${format.value}.json`);
 }finally{film.render(saved);document.querySelectorAll('button,select,input').forEach(e=>e.disabled=false);film.renderer.setAnimationLoop(frame);}
});
