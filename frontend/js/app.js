(function(){
  const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
  const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  /* ---------- sample data ---------- */
  const SLOTS=['7:30 AM','8:00 AM','1:00 PM','4:30 PM'];
  const ROUTES=[
    {id:'A',name:'Ashulia to Campus',bus:'DIU-03',cap:50,trip:35,path:'M40 300 C120 280 160 200 250 220 S400 280 470 200 S560 170 590 180',
     stops:[['Ashulia Bus Stand',0],['Zirabo',.28],['Baipail',.55],['Nabinagar',.8],['DIU Campus',1]],times:['6:45','7:30','8:00','13:00','16:30'],
     fc:[42,58,24,46],util:78,base:18},
    {id:'B',name:'Mirpur to Campus',bus:'DIU-07',cap:40,trip:45,path:'M40 70 C130 60 200 130 280 120 S420 60 480 130 S560 175 590 180',
     stops:[['Mirpur 10',0],['Mirpur 1',.22],['Gabtoli',.5],['Savar',.78],['DIU Campus',1]],times:['6:30','7:30','8:00','13:00','16:30'],
     fc:[44,52,20,41],util:91,base:30},
    {id:'C',name:'Uttara to Campus',bus:'DIU-11',cap:50,trip:50,path:'M60 180 C140 150 220 190 300 170 S430 220 500 190 S570 182 590 180',
     stops:[['Uttara Sector 7',0],['Abdullahpur',.25],['Ashulia Road',.55],['Birulia',.82],['DIU Campus',1]],times:['6:30','7:30','8:00','13:00','16:30'],
     fc:[30,36,18,33],util:54,base:12},
    {id:'D',name:'Dhanmondi to Campus',bus:'DIU-15',cap:35,trip:55,path:'M200 335 C260 300 300 260 360 270 S480 250 520 215 S575 190 590 180',
     stops:[['Dhanmondi 27',0],['Asad Gate',.2],['Gabtoli',.45],['Savar',.75],['DIU Campus',1]],times:['6:45','8:00','13:00','16:30'],
     fc:[12,15,9,14],util:32,base:8}
  ];
  const SPEEDUP=30; // 1 real second = 30 simulated seconds
  const S={
    sel:'A', stop:{}, active:{A:true,B:true,C:true,D:false}, prog:{A:.42,B:.15,C:.66,D:0}, delay:{A:0,B:0,C:0,D:0},
    cancelled:{}, boards:{A:0,B:0,C:0,D:0}, gps:true, exam:false, slot:1, rating:0,
    decisions:{},
    notices:[
      {route:'ALL',text:'Welcome to DIU Bus Buddy. Pick a route to see live bus information.',kind:'ok',t:'Today'},
      {route:'B',text:'Route B is usually full at 8:00 AM. Try the 7:30 AM bus if you can.',kind:'delay',t:'Today'}
    ],
    complaints:[
      {id:1,route:'B',type:'Complaint: too crowded',text:'The 8:00 AM bus had people standing in the aisle from Gabtoli.',status:'open',sample:true},
      {id:2,route:'A',type:'Complaint: bus was late',text:'Bus arrived 12 minutes late at Zirabo.',status:'open',sample:true},
      {id:3,route:'C',type:'Feedback',text:'Driver was very helpful on the rainy morning.',status:'done',sample:true}
    ]
  };
  ROUTES.forEach(r=>S.stop[r.id]=2);
  const R=id=>ROUTES.find(r=>r.id===id);

  /* ---------- helpers ---------- */
  let tt;function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>t.hidden=true,2600)}
  function pax(r){return Math.min(r.cap+6,Math.round(r.base+(r.cap*.62)*S.prog[r.id]+S.boards[r.id]))}
  function occCls(p){return p>=100?'bad':p>=85?'warn':'good'}
  function occLabel(p){return p>=100?'Full':p>=85?'Nearly full':p>=35?'Seats available':'Plenty of seats'}
  function pred(r,i){return Math.round(r.fc[i]*(S.exam?1.25:1))}
  function status(p){return p>100?['bad','Over capacity']:p>=85?['warn','High']:p<35?['sun','Low use']:['good','OK']}

  /* ---------- routing / tabs ---------- */
  const ACCOUNTS=[
    {id:'student01',pw:'student123',name:'Tasnim',label:'Student',views:['student']},
    {id:'driver07',pw:'driver123',name:'Mr. Karim',label:'Driver',views:['driver'],route:'B'},
    {id:'admin',pw:'admin123',name:'Transport office',label:'Admin',views:['admin','student','driver']}
  ];
  const AUTH={user:null};
  let USERS=[];try{USERS=JSON.parse(localStorage.getItem('diu-users')||'[]')}catch(_){USERS=[]}
  const toAcc=u=>({id:u.mobile,name:u.first+' '+u.last,label:'Student',views:['student']});
  const findAcc=id=>{const u=USERS.find(x=>x.mobile===id);return ACCOUNTS.find(a=>a.id===id)||(u?toAcc(u):null)};
  try{const k=sessionStorage.getItem('diu-user');if(k)AUTH.user=findAcc(k)}catch(_){}
  function show(v){
    const u=AUTH.user;
    $('#loginView').hidden=!!u;$('#hero').hidden=!!u;$('#tabs').hidden=!u;$('#userChip').hidden=!u;
    if(!u){$$('.view').forEach(e=>e.classList.remove('on'));return}
    $('#userName').textContent=u.name+' · '+u.label;
    $$('.tab').forEach(t=>t.hidden=!u.views.includes(t.dataset.view));
    if(!u.views.includes(v)){v=u.views[0];if(location.hash.slice(1)!==v){location.hash=v;return}}
    if(u.route&&!S.routeSet){S.sel=u.route;S.routeSet=true}
    $$('.view').forEach(e=>e.classList.toggle('on',e.id==='view-'+v));
    $$('.tab').forEach(t=>t.setAttribute('aria-selected',t.dataset.view===v));
    if(v==='driver')renderDriver(); if(v==='admin')renderAdmin(); if(v==='student')renderStudent();
  }
  $$('.tab').forEach(t=>t.addEventListener('click',()=>{location.hash=t.dataset.view}));
  window.addEventListener('hashchange',()=>show(location.hash.slice(1)));

  /* ---------- theme ---------- */
  $('#themeBtn').addEventListener('click',()=>{
    const d=document.documentElement;const dark=d.dataset.theme?d.dataset.theme==='dark':matchMedia('(prefers-color-scheme:dark)').matches;
    d.dataset.theme=dark?'light':'dark';
  });

  /* ---------- student ---------- */
  function renderChips(){
    $('#routeChips').innerHTML=ROUTES.map(r=>`<button class="chip" data-r="${r.id}" aria-pressed="${r.id===S.sel}">Route ${r.id}<small>${esc(r.name.replace(' to Campus',''))}</small></button>`).join('');
  }
  $('#routeChips').addEventListener('click',e=>{const b=e.target.closest('.chip');if(!b)return;S.sel=b.dataset.r;renderStudent()});
  $('#stopSel').addEventListener('change',e=>{S.stop[S.sel]=+e.target.value;renderLive()});

  function drawMap(){
    const r=R(S.sel),svg=$('#map');
    svg.innerHTML=`<g fill="none" stroke-linecap="round">
      <path d="M0 250 C140 230 260 330 420 300 S600 330 640 310" stroke="var(--map-road)" stroke-width="10"/>
      <path d="M120 0 C160 80 120 200 180 360" stroke="var(--map-road)" stroke-width="8"/>
      <path id="rp" d="${r.path}" stroke="var(--brand)" stroke-width="6" stroke-dasharray="1 0"/></g>
      <g id="stopsG"></g>
      <g id="campus"><circle cx="590" cy="180" r="16" fill="var(--daffodil)" stroke="var(--ink)" stroke-width="2"/><text x="590" y="150" text-anchor="middle">DIU</text></g>
      <g id="bus"><circle r="15" fill="var(--ink)" opacity=".18"/><rect x="-11" y="-8" width="22" height="16" rx="4" fill="var(--daffodil)" stroke="var(--ink)" stroke-width="1.5"/><path d="M-11 -1H11" stroke="var(--ink)" stroke-width="1.2"/></g>`;
    const p=$('#rp'),L=p.getTotalLength();
    $('#stopsG').innerHTML=r.stops.slice(0,-1).map((s,i)=>{const pt=p.getPointAtLength(L*s[1]);const sel=i===S.stop[r.id];
      return `<circle cx="${pt.x}" cy="${pt.y}" r="${sel?9:6}" fill="${sel?'var(--brand)':'var(--surface)'}" stroke="var(--brand)" stroke-width="3"/><text x="${pt.x}" y="${pt.y+(i%2?24:-14)}" text-anchor="${pt.x<90?'start':'middle'}">${esc(s[0])}</text>`}).join('');
    $('#mapTitle').textContent=`Route ${r.id} · ${r.name} · Bus ${r.bus}`;
  }
  function placeBus(){
    const r=R(S.sel),p=$('#rp');if(!p)return;const L=p.getTotalLength(),pt=p.getPointAtLength(L*S.prog[r.id]);
    $('#bus').setAttribute('transform',`translate(${pt.x} ${pt.y})`);
  }
  function renderLive(){
    const r=R(S.sel),i=S.stop[r.id],st=r.stops[i];
    // state pill
    const bs=$('#busState');
    if(S.cancelled[r.id]){bs.className='pill bad';bs.textContent='Trip cancelled'}
    else if(!S.active[r.id]){bs.className='pill';bs.textContent='Not on a trip'}
    else if(S.delay[r.id]>0){bs.className='pill warn';bs.textContent=`Delayed ${S.delay[r.id]} min`}
    else{bs.className='pill good';bs.textContent='On time'}
    // ETA
    let big='–',unit='',note='';
    if(S.cancelled[r.id]){big='Off';note='This trip is cancelled. Check notices for the next bus.'}
    else if(!S.active[r.id]){big='Soon';note=`Bus ${r.bus} has not started yet. See the departure times below.`}
    else{
      const left=(st[1]-S.prog[r.id]);
      if(left<=0){big='Left';note=`The bus already passed ${st[0]}. Next departure: ${nextDep(r)||'tomorrow'}.`}
      else{const m=Math.max(1,Math.round(left*r.trip+S.delay[r.id]));big=m;unit=m===1?'minute away':'minutes away';note=`Estimated arrival at ${st[0]}${S.delay[r.id]?` including a ${S.delay[r.id]} minute delay`:''}.`}
    }
    $('#etaBig').textContent=big;$('#etaUnit').textContent=unit;$('#etaNote').textContent=note;
    // occupancy
    const n=pax(r),p=Math.round(n/r.cap*100);
    const bar=$('#occBar');bar.style.width=Math.min(100,p)+'%';bar.className=occCls(p)==='good'?'':occCls(p);
    $('#occPill').className='pill '+occCls(p);$('#occPill').textContent=occLabel(p);
    $('#occText').textContent=`${n} of ${r.cap} seats taken (${p}%)`;
    placeBus();
    $('#busState').parentElement.querySelector('h2');
  }
  function nowMin(){const d=new Date();return d.getHours()*60+d.getMinutes()}
  function toMin(t){const [h,m]=t.split(':').map(Number);return h*60+m}
  function fmt(t){const [h,m]=t.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' AM':' PM')}
  function nextDep(r){const n=nowMin(),t=r.times.find(x=>toMin(x)>=n);return t?fmt(t):null}
  function renderTimes(){
    const r=R(S.sel),n=nowMin(),nx=r.times.find(x=>toMin(x)>=n);
    $('#times').innerHTML=r.times.map(t=>`<span class="time ${t===nx?'next':toMin(t)<n?'past':''}">${fmt(t)}</span>`).join('');
    $('#depNote').textContent=nx?`Next bus at ${fmt(nx)}`:'No more buses today';
  }
  function renderNotices(){
    const list=S.notices.filter(n=>n.route==='ALL'||n.route===S.sel);
    $('#notices').innerHTML=list.length?list.map(n=>`<li class="note ${n.kind}"><b>${n.route==='ALL'?'All routes':'Route '+n.route}</b><span>${esc(n.text)}</span><span class="muted small">${esc(n.t)}</span></li>`).join(''):'<li class="muted">No notices for this route.</li>';
  }
  function renderStudent(){
    renderChips();
    $('#stopSel').innerHTML=R(S.sel).stops.slice(0,-1).map((s,i)=>`<option value="${i}" ${i===S.stop[S.sel]?'selected':''}>${esc(s[0])}</option>`).join('');
    drawMap();renderLive();renderTimes();renderNotices();
  }
  $('#boardBtn').addEventListener('click',()=>{const r=R(S.sel);if(pax(r)>=r.cap+6)return;S.boards[r.id]++;renderLive();toast('Boarding recorded. Thanks for helping count seats.')});

  // feedback
  function renderStars(){$('#stars').innerHTML=[1,2,3,4,5].map(i=>`<button type="button" class="star ${i<=S.rating?'on':''}" data-s="${i}" role="radio" aria-checked="${i===S.rating}" aria-label="${i} star${i>1?'s':''}">★</button>`).join('')}
  $('#stars').addEventListener('click',e=>{const b=e.target.closest('.star');if(!b)return;S.rating=+b.dataset.s;renderStars()});
  $('#fbForm').addEventListener('submit',e=>{
    e.preventDefault();const txt=$('#fbText').value.trim();
    if(!txt){toast('Write a short message first.');$('#fbText').focus();return}
    S.complaints.unshift({id:Date.now(),route:S.sel,type:$('#fbType').value,text:(S.rating?`[${S.rating}★] `:'')+txt,status:'open'});
    $('#fbText').value='';S.rating=0;renderStars();toast('Sent. The transport office can see it now.');
  });

  /* ---------- driver ---------- */
  function renderDriver(){
    const sel=$('#drvRoute');sel.innerHTML=ROUTES.map(r=>`<option value="${r.id}" ${r.id===S.sel?'selected':''}>Route ${r.id}: ${esc(r.name)}</option>`).join('');
    const r=R(S.sel);
    $('#drvBus').textContent=r.bus;$('#drvPax').textContent=`${pax(r)} / ${r.cap}`;
    $('#drvTrip').textContent=S.cancelled[r.id]?'Cancelled':S.active[r.id]?'Running':'Ready';
    $('#tripBtn').textContent=S.active[r.id]?'End trip':'Start trip';
    $('#gpsBtn').textContent='GPS sharing: '+(S.gps?'on':'off');
    const next=r.stops.findIndex(s=>s[1]>S.prog[r.id]);
    $('#drvStops').innerHTML=r.stops.map((s,i)=>`<li ${i<next||next<0&&S.active[r.id]?'class="muted" style="text-decoration:line-through"':''}>${esc(s[0])}</li>`).join('');
  }
  $('#drvRoute').addEventListener('change',e=>{S.sel=e.target.value;renderDriver()});
  $('#tripBtn').addEventListener('click',()=>{
    const r=R(S.sel);
    if(S.active[r.id]){S.active[r.id]=false;S.prog[r.id]=0;S.boards[r.id]=0;toast('Trip ended.')}
    else{S.active[r.id]=true;S.cancelled[r.id]=false;S.prog[r.id]=0;toast('Trip started. Students can see your bus.')}
    renderDriver();
  });
  $('#gpsBtn').addEventListener('click',()=>{S.gps=!S.gps;renderDriver();toast(S.gps?'Location is shared for this trip only.':'GPS sharing paused. Students see the last known spot.')});
  $$('[data-status]').forEach(b=>b.addEventListener('click',()=>{
    const r=R(S.sel),k=b.dataset.status,now=new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'});
    if(k==='ontime'){S.delay[r.id]=0;S.cancelled[r.id]=false;S.notices.unshift({route:r.id,text:`Route ${r.id} is running on time.`,kind:'ok',t:now})}
    if(k==='delay10'||k==='delay20'){const m=k==='delay10'?10:20;S.delay[r.id]=m;S.cancelled[r.id]=false;S.notices.unshift({route:r.id,text:`Route ${r.id} (${r.bus}) is delayed by about ${m} minutes.`,kind:'delay',t:now})}
    if(k==='cancel'){S.cancelled[r.id]=true;S.active[r.id]=false;S.notices.unshift({route:r.id,text:`This Route ${r.id} trip is cancelled. Please use the next scheduled bus.`,kind:'cancel',t:now})}
    renderDriver();toast('Status sent to students on Route '+r.id+'.');
  }));
  $('#sosForm').addEventListener('submit',e=>{
    e.preventDefault();const r=R(S.sel),txt=$('#sosText').value.trim()||'No details added.';
    S.complaints.unshift({id:Date.now(),route:r.id,type:'Driver report: '+$('#sosType').value,text:txt,status:'open'});
    $('#sosText').value='';toast('Transport manager alerted. Stay safe.');
  });

  /* ---------- admin ---------- */
  function renderAdmin(){
    const run=ROUTES.filter(r=>S.active[r.id]),tot=run.reduce((a,r)=>a+pax(r),0),avg=run.length?Math.round(run.reduce((a,r)=>a+pax(r)/r.cap*100,0)/run.length):0,open=S.complaints.filter(c=>c.status==='open').length;
    $('#tiles').innerHTML=`<div class="tile"><span class="muted small">Buses on the road</span><b class="num">${run.length} / ${ROUTES.length}</b></div>
      <div class="tile"><span class="muted small">Passengers now</span><b class="num">${tot}</b></div>
      <div class="tile"><span class="muted small">Average occupancy</span><b class="num">${avg}%</b></div>
      <div class="tile"><span class="muted small">Open complaints</span><b class="num">${open}</b></div>`;
    $('#slotSel').innerHTML=SLOTS.map((s,i)=>`<option value="${i}" ${i===S.slot?'selected':''}>${s}</option>`).join('');
    $('#examTgl').checked=S.exam;
    $('#fcBody').innerHTML=ROUTES.map(r=>{const p=pred(r,S.slot),o=Math.round(p/r.cap*100),s=status(o);
      return `<tr><td><b>Route ${r.id}</b><br><span class="muted small">${esc(r.name.replace(' to Campus',''))}</span></td><td class="num">${r.cap}</td><td class="num">${p}</td><td class="num">${o}%</td><td><span class="pill ${s[0]}">${s[1]}</span></td></tr>`}).join('');
    renderRecs();
    $('#util').innerHTML=ROUTES.map(r=>`<div class="barrow"><span>Route ${r.id}</span><div class="meter"><i class="${occCls(r.util)==='good'?'':occCls(r.util)}" style="width:${r.util}%"></i></div><span class="num">${r.util}%</span></div>`).join('');
    $('#nRoute').innerHTML='<option value="ALL">All routes</option>'+ROUTES.map(r=>`<option value="${r.id}">Route ${r.id}</option>`).join('');
    renderComplaints();
  }
  function recs(){
    const out=[];
    ROUTES.forEach(r=>{
      const p=pred(r,S.slot),o=Math.round(p/r.cap*100),key=`${r.id}|${S.slot}|${S.exam}`;
      let text=null,why='';
      if(o>100){const extra=Math.ceil(p/r.cap)-1;text=`Add ${extra} extra bus${extra>1?'es':''} to Route ${r.id} at ${SLOTS[S.slot]}.`;why=`High demand expected: about ${p} passengers for ${r.cap} seats (${o}%).`}
      else if(o>=85){text=`Move the Route ${r.id} ${SLOTS[S.slot]} departure 10 minutes earlier, or use a larger bus.`;why=`Expected ${p} of ${r.cap} seats (${o}%), close to full.`}
      else if(o<35){text=`Consider merging Route ${r.id} with a nearby route at ${SLOTS[S.slot]}.`;why=`Only about ${p} passengers for ${r.cap} seats (${o}%).`}
      if(text)out.push({key,text,why,r,o});
    });
    return out;
  }
  function renderRecs(){
    const list=recs();
    $('#recs').innerHTML=list.length?list.map(x=>{const d=S.decisions[x.key];
      return `<div class="rec ${d||''}"><div class="row"><b>${esc(x.text)}</b><span class="pill sun">AI suggestion</span></div><span class="muted small">${esc(x.why)} Estimate only.</span>
      <div class="row" style="justify-content:flex-start">${d?`<span class="pill ${d==='accepted'?'good':'bad'}">${d==='accepted'?'Accepted':'Rejected'}</span><button class="btn ghost sm" data-undo="${x.key}">Undo</button>`:`<button class="btn sm" data-acc="${x.key}">Accept</button><button class="btn ghost sm" data-rej="${x.key}">Reject</button>`}</div></div>`}).join(''):'<p class="muted">No changes suggested for this time. Demand fits the buses.</p>';
  }
  $('#recs').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.acc){S.decisions[b.dataset.acc]='accepted';toast('Accepted. Add it to the transport plan.')}
    else if(b.dataset.rej){S.decisions[b.dataset.rej]='rejected';toast('Rejected. No change made.')}
    else if(b.dataset.undo){delete S.decisions[b.dataset.undo]}
    renderRecs();
  });
  $('#slotSel').addEventListener('change',e=>{S.slot=+e.target.value;renderAdmin()});
  $('#examTgl').addEventListener('change',e=>{S.exam=e.target.checked;renderAdmin()});
  function renderComplaints(){
    const open=S.complaints.filter(c=>c.status==='open').length;$('#openCount').textContent=open+' open';
    $('#complaints').innerHTML=S.complaints.map(c=>`<li class="note"><div class="row"><b>Route ${c.route} · ${esc(c.type)}</b><span class="pill ${c.status==='open'?'warn':'good'}">${c.status==='open'?'Open':'Resolved'}</span></div><span>${esc(c.text)}</span>${c.sample?'<span class="muted small">Sample entry</span>':''}${c.status==='open'?`<div><button class="btn ghost sm" data-res="${c.id}">Mark resolved</button></div>`:''}</li>`).join('');
  }
  $('#complaints').addEventListener('click',e=>{const b=e.target.closest('[data-res]');if(!b)return;const c=S.complaints.find(x=>x.id==b.dataset.res);if(c)c.status='done';renderAdmin()});
  $('#noticeForm').addEventListener('submit',e=>{
    e.preventDefault();const t=$('#nText').value.trim();if(!t){toast('Write the notice first.');$('#nText').focus();return}
    S.notices.unshift({route:$('#nRoute').value,text:t,kind:'delay',t:new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})});
    $('#nText').value='';toast('Notice published. Students can see it now.');
  });
  $('#repBtn').addEventListener('click',()=>{
    const L=[`Transport report · ${new Date().toLocaleDateString()}`,'(Sample data)',''];
    L.push(`Forecast for ${SLOTS[S.slot]}${S.exam?' (exam week)':''}:`);
    ROUTES.forEach(r=>{const p=pred(r,S.slot);L.push(`- Route ${r.id}: ${p} predicted / ${r.cap} seats = ${Math.round(p/r.cap*100)}%`)});
    L.push('','Suggestions and decisions:');
    const rs=recs();L.push(...(rs.length?rs.map(x=>`- ${x.text} [${S.decisions[x.key]||'pending'}]`):['- None']));
    L.push('','Weekly average occupancy:',...ROUTES.map(r=>`- Route ${r.id}: ${r.util}%`));
    const top=[...ROUTES].sort((a,b)=>b.util-a.util);L.push('',`Most used: Route ${top[0].id}. Least used: Route ${top[top.length-1].id}.`);
    L.push(`Open complaints: ${S.complaints.filter(c=>c.status==='open').length}`);
    const el=$('#report');el.textContent=L.join('\n');el.classList.remove('muted');$('#copyRep').hidden=false;
  });
  $('#copyRep').addEventListener('click',async()=>{
    const el=$('#report');
    try{await navigator.clipboard.writeText(el.textContent);toast('Report copied.')}
    catch(_){const r=document.createRange();r.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(r);toast('Press copy to finish.')}
  });

  /* ---------- live simulation ---------- */
  let last=performance.now();
  function tick(now){
    const dt=(now-last)/1000;last=now;
    ROUTES.forEach(r=>{
      if(S.active[r.id]&&S.gps){S.prog[r.id]+=dt*SPEEDUP/(r.trip*60);if(S.prog[r.id]>=1){S.prog[r.id]=0;S.boards[r.id]=0}}
    });
    placeBus();
    requestAnimationFrame(tick);
  }
  setInterval(()=>{
    const v=location.hash.slice(1)||'student';
    const fa=document.activeElement;if(fa&&['SELECT'].includes(fa.tagName)&&v!=='student')return;
    if(v==='student'){renderLive();renderTimes()} else if(v==='driver'){renderDriver()} else if(v==='admin'){const a=document.activeElement;if(!a||!['SELECT','TEXTAREA','INPUT'].includes(a.tagName))renderAdmin()}
  },2000);

  function login(a){
    AUTH.user=a;S.routeSet=false;
    try{sessionStorage.setItem('diu-user',a.id)}catch(_){}
    location.hash=a.views[0];show(a.views[0]);toast('Welcome, '+a.name+'.');
  }
  function normMobile(s){let d=String(s).replace(/[\s-]/g,'');if(d.startsWith('+880'))d='0'+d.slice(4);else if(d.startsWith('880'))d='0'+d.slice(3);return /^01[3-9]\d{8}$/.test(d)?d:''}
  async function hashPw(pw,salt){const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt+':'+pw));return [...new Uint8Array(d)].map(x=>x.toString(16).padStart(2,'0')).join('')}
  function setMode(m){
    const lg=m==='login';
    $('#loginForm').hidden=!lg;$('#demoBox').hidden=!lg;$('#signupForm').hidden=lg;
    $('#modeLogin').setAttribute('aria-selected',lg);$('#modeSignup').setAttribute('aria-selected',!lg);
    $('#lgErr').hidden=true;$('#suErr').hidden=true;
  }
  $('#modeLogin').addEventListener('click',()=>setMode('login'));
  $('#modeSignup').addEventListener('click',()=>setMode('signup'));
  $('#loginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const raw=$('#lgId').value.trim(),id=normMobile(raw)||raw.toLowerCase(),pw=$('#lgPw').value,err=$('#lgErr');
    let a=ACCOUNTS.find(x=>x.id===id&&x.pw===pw)||null;
    if(!a){const u=USERS.find(x=>x.mobile===id);if(u){try{if(await hashPw(pw,u.mobile)===u.hash)a=toAcc(u)}catch(_){}}}
    if(!a){err.textContent='That mobile number, ID or password is not right. Check them and try again.';err.hidden=false;return}
    err.hidden=true;$('#lgPw').value='';login(a);
  });
  $('#signupForm').addEventListener('submit',async e=>{
    e.preventDefault();
    const first=$('#suFirst').value.trim(),last=$('#suLast').value.trim(),mobile=normMobile($('#suMobile').value),pw=$('#suPw').value,pw2=$('#suPw2').value,err=$('#suErr');
    const fail=(m,f)=>{err.textContent=m;err.hidden=false;if(f)$(f).focus()};
    if(!first){return fail('Enter your first name.','#suFirst')}
    if(!last){return fail('Enter your last name.','#suLast')}
    if(!mobile){return fail('Enter a valid Bangladesh mobile number, like 01712345678.','#suMobile')}
    if(USERS.some(u=>u.mobile===mobile)){return fail('An account with this mobile number already exists. Log in instead.','#suMobile')}
    if(pw.length<8){return fail('Use a password with at least 8 characters.','#suPw')}
    if(pw!==pw2){return fail('The two passwords do not match.','#suPw2')}
    let hash;try{hash=await hashPw(pw,mobile)}catch(_){return fail('This browser cannot create accounts securely. Try another browser.')}
    const u={first,last,mobile,hash};USERS.push(u);
    try{localStorage.setItem('diu-users',JSON.stringify(USERS))}catch(_){}
    err.hidden=true;['#suFirst','#suLast','#suMobile','#suPw','#suPw2'].forEach(s=>$(s).value='');
    login(toAcc(u));
  });
  $('#demoAcc').addEventListener('click',e=>{
    const b=e.target.closest('[data-acc]');if(!b)return;
    const a=ACCOUNTS.find(x=>x.id===b.dataset.acc);$('#lgId').value=a.id;$('#lgPw').value=a.pw;$('#lgErr').hidden=true;$('#lgPw').focus();
  });
  $('#logoutBtn').addEventListener('click',()=>{
    AUTH.user=null;try{sessionStorage.removeItem('diu-user')}catch(_){}
    location.hash='';show('');toast('You are logged out.');
  });

  renderStars();show(location.hash.slice(1));requestAnimationFrame(tick);
})();
