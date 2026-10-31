(() => {
  // Test double for the community API.
  // Scenario from ?s=... ; switch it while the page is open with window.__mockScenario = '...'.
  // Every API request is logged in window.__mockLog (url + Accept-Language) so tests can check them.
  const q = new URLSearchParams(location.search);
  const H = 3.6e6;
  const warStart = Date.parse('2024-02-08T09:00:00Z');
  const t0 = Date.now();
  const LAG = 22 * 24 * H;   // the real game clock runs ~22 days behind; startTimes below are game seconds   // scenario times are relative to page load, so a "switch" keeps them stable
  const HZ={cold:{name:'Extreme Cold',description:'Icy temperatures reduce rate of fire and delay heat buildup in weapons.'},ion:{name:'Ion Storms',description:'Ion storms intermittently disable Stratagems.'},sand:{name:'Sandstorms',description:'Dense sandstorms reduce mobility and greatly reduce visibility for both enemy and friendly units.'},heat:{name:'Intense Heat',description:'High temperatures increase stamina drain and speed up heat buildup in weapons.'}};
  const BIO={glacier:{name:'Icy Glaciers',description:'Submerged in eternal winter, this world\'s frosty peaks glimmer in the light of its too-distant star.'},desert:{name:'Desert Dunes',description:'A blazing-hot desert planet, its rocky mesas are the sole interruptions to the endless sea of dunes.'}};
  const pos = (i)=>{ const a=i*2.399963, r=0.28+((i*37)%60)/100; return {x:+(Math.cos(a)*r).toFixed(4), y:+(Math.sin(a)*r).toFixed(4)}; };
  const pl = (index,name,owner,mh,h,rps,pc,regions=[],event=null)=>({index,name,currentOwner:owner,maxHealth:mh,health:h,regenPerSecond:rps,statistics:{playerCount:pc},regions,event,sector:'Hydra',position:pos(index),waypoints:[],attacking:[],
    biome:index%2?BIO.glacier:BIO.desert, hazards:index%2?[HZ.cold,HZ.ion]:[HZ.sand,HZ.heat]});
  const lib = (i)=>({type:11,values:[1,1,i],valueTypes:[3,11,12]});
  const hashStr = (str) => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const okey = (a) => `${a.id}:${hashStr(JSON.stringify((a.tasks || []).map(tk => [tk.type, tk.values, tk.valueTypes])))}`;
  function build(S) {
    const now = t0;
    const zeaRegions=[{name:'NEW COB',health:200000,maxHealth:200000,regenPerSecond:0.5556,isAvailable:true},{name:'GENE',health:100000,maxHealth:100000,regenPerSecond:0.2778,isAvailable:true},{name:'STARPASS',health:400000,maxHealth:400000,regenPerSecond:1.1111,isAvailable:true}];
    const fury=pl(261,'Fury','Automaton',2e6,1495323,5.5555553,34800);
    const esker=pl(75,'Esker','Terminids',1e6,1e6,6.9444447,17500);
    const zea=pl(7,'Zea Rugosia','Illuminate',1.7e6,1.7e6,13.888889,2500,zeaRegions);
    const mars=pl(160,'Mars','Humans',1e6,1e6,0,4200,[],{health:120000,maxHealth:300000,endTime:new Date(now+10*H).toISOString(),faction:'Illuminate'});
    const bug2=pl(300,'Hellmire','Terminids',1e6,6e5,4,9000), bot2=pl(301,'Vog-Sojoth','Automaton',1e6,6e5,4,6000);
    bug2.waypoints=[75]; bot2.waypoints=[261]; esker.waypoints=[300]; zea.attacking=[160];
    const htf={id:9001,title:'HONOUR THE FALLEN',briefing:'Liberty Day approaches. The Helldivers are ordered to liberate <i=1>FURY, ESKER, and ZEA RUGOSIA</i>.',description:'',progress:[0,0,0],tasks:[lib(261),lib(75),lib(7)],rewards:[{type:1,amount:40}],expiration:new Date(now+67*H).toISOString()};
    const sniper={id:9002,title:'DEMOCRATIC SNIPER',briefing:'The Ministry of Truth is producing an inspirational film.',description:'',progress:[118000000,41000000,9000000,0],tasks:[
          {type:3,values:[2,300000000,0,0,0],valueTypes:[1,3,4,5,6]},
          {type:3,values:[4,65000000,0,0,0],valueTypes:[1,3,4,5,6]},
          {type:3,values:[3,50000000,0,1978117092,1],valueTypes:[1,3,4,5,6]},
          {type:13,values:[1,1,160],valueTypes:[3,11,12]}],rewards:[{type:1,amount:45}],expiration:new Date(now+68*H).toISOString()};
    let assignments=[htf,sniper], campaigns=[fury,esker,zea,mars,bug2,bot2], stations=[{planet:fury,tacticalActions:[{name:'HEAVY ORDNANCE DISTRIBUTION',status:2,statusExpire:new Date(now+9*H).toISOString()}]}];
    let raw=[{id32:9001,startTime:(now-29*H-warStart)/1000},{id32:9002,startTime:(now-28*H-warStart)/1000}];
    const lpts=(f0,f1)=>{const o=[];for(let k=36;k>=0;k--)o.push([now-k*20*60e3,+(f0+(f1-f0)*(36-k)/36).toFixed(4),0,1000]);return o;};
    let recordDefault={'intel.json':{v:2,updated:now-3*60e3,since:now-12*H,every:10,inf:100,official:true,alerts:[],effects:[]},'recent.json':{v:1,updated:now,samples:[]},
      'progress.json':{v:1,updated:now,since:now-12*H,orders:{},planets:{261:lpts(0.12,0.2523),75:lpts(0,0),7:lpts(0,0)}}};
    let players=82873, mode='ok', sectorInfo=null, dispatches=[], record=S==='default'?recordDefault:null;
    if (S==='done') {
      const f2={...fury,currentOwner:'Humans',health:2e6};
      assignments=[{...htf,id:9101,title:'LIBERATE FURY',progress:[1],tasks:[lib(261)],expiration:new Date(now+5*H).toISOString()}];
      campaigns=[esker,zea,bug2,bot2]; stations=[{planet:f2,tacticalActions:[]}];
      raw=[{id32:9101,startTime:(now-60*H-warStart)/1000}];
    } else if (S==='steady') {
      assignments=[{...sniper,id:9102,progress:[250e6,60e6,45e6],tasks:sniper.tasks.slice(0,3),expiration:new Date(now+20*H).toISOString()}];
      raw=[{id32:9102,startTime:(now-60*H-warStart)/1000}];
    } else if (S==='impossible') {
      const z1=pl(7,'Zea Rugosia','Illuminate',2e6,2e6,40,2500), z2=pl(8,'Calypso','Illuminate',2e6,2e6,40,3000);
      assignments=[{...htf,id:9103,title:'ALIEN WALL',briefing:'Breach the Illuminate wall.',progress:[0,0],tasks:[lib(7),lib(8)],expiration:new Date(now+30*H).toISOString()}];
      campaigns=[z1,z2,bug2,bot2]; stations=[];
      raw=[{id32:9103,startTime:(now-40*H-warStart)/1000}];
    } else if (S==='none') {
      assignments=[];
      const D=(h,m)=>({id:5000+h,published:new Date(now-h*H).toISOString(),type:0,message:m});
      dispatches=[D(1,'<i=3>MAJOR ORDER FAILED</i>\n\nDespite valiant efforts, the Helldivers could not complete Democratic Sniper in time.'),
        D(5,'<i=3>ARSENAL AUGMENTATION ENDED</i>\n\nFree availability of the Gas Mines Stratagem for forces on the Terminid front has now ended.'),
        D(9,'<i=3>AUTOMATON OFFENSIVE</i>\n\nThe Automatons have launched a counterattack on the Severin sector.'),
        D(20,'<i=3>VICTORY ON MERIDIA</i>\n\nMeridia has been liberated. Democracy prevails.'),
        D(30,'<i=3>STRATEGIC OPPORTUNITY MISSED</i>\n\nThe window to secure the research data has closed.'),
        D(40,'<i=3>MESSAGE FROM THE MINISTRY OF TRUTH</i>\n\nRemember to report suspicious neighbours to your local Democracy Officer.')];
      const st=now-120*H, ex=now-2*H, tasks=sniper.tasks.slice(0,3).map(tk=>({type:tk.type,values:tk.values,valueTypes:tk.valueTypes}));
      const pts=Array.from({length:60},(_,k)=>{const f=k/59; return [st+f*(ex-st), Math.round(137.4e6*f), Math.round(31.2e6*Math.pow(f,.9)), Math.min(50e6,Math.round(55e6*f))];});
      record={...recordDefault,'intel.json':{...recordDefault['intel.json'],orders:{'9777':{key:'x',start:st,title:'DEMOCRATIC SNIPER',exp:ex,seen:ex,tasks}},
        so:[{id:4001,t:st+29.5*H,msg:'<i=3>STRATEGIC OPPORTUNITY SEIZED</i>\n\nHelldivers have contained the outbreak on Nivel 43, securing essential footage for Democratic Sniper.'}],
        alerts:[{kind:'edited',order:'9777',t:st+30*H,diff:[{i:1,kind:'goal',from:300e6,to:150e6}]},{kind:'effect',on:true,t:st+50*H,eid:1,type:32,v:[],planets:[75]}]},
        'progress.json':{v:1,updated:now,since:st,orders:{'9777':{start:st,exp:ex,title:'DEMOCRATIC SNIPER',pts}},planets:{}}};
    } else if (S==='fail') {
      mode='fail';
    } else if (S==='apidown') {
      // community API down: the page falls back to the recorder's copy, read from the official API
      mode='fail'; record={...recordDefault};
    } else if (S==='slow') {
      mode='slow';
    } else if (S==='libn') {
      const a1=pl(401,'Aesir Pass','Automaton',1e6,3e5,4,8000), a2=pl(402,'Marfark','Automaton',1e6,9e5,10,3000), a3=pl(403,'Chort Bay','Automaton',1e6,6e5,6,12000);
      assignments=[{id:9104,title:'IRON CURTAIN',briefing:'Push back the Automaton line.',description:'',progress:[1,2],tasks:[{type:14,values:[3,3],valueTypes:[1,3]},{type:12,values:[3,5],valueTypes:[1,3]}],rewards:[{type:1,amount:50}],expiration:new Date(now+50*H).toISOString()}];
      campaigns=[a1,a2,a3,bug2]; stations=[{planet:a1,tacticalActions:[]}]; players=60000;
      raw=[{id32:9104,startTime:(now-20*H-warStart)/1000}];
    } else if (S==='measure') {
      assignments=[{...sniper,id:9105,progress:[5e6,1e6],tasks:[sniper.tasks[0],sniper.tasks[2]]}];
      raw=[];
    } else if (S==='win') {
      const f3={...fury,regenPerSecond:2}, e3={...esker,regenPerSecond:2,health:8e5};
      assignments=[{...htf,id:9106,progress:[0,0],tasks:[lib(261),lib(75)]}];
      campaigns=[f3,e3,bug2,bot2]; stations=[{planet:f3,tacticalActions:[]}];
    } else if (S==='last') {
      const e4={...esker,regenPerSecond:3,health:4e5,statistics:{playerCount:30000}};
      assignments=[{...htf,id:9107,title:'BUG HUNT',progress:[1,0],tasks:[lib(261),lib(75)]}];
      campaigns=[e4,bug2,bot2]; stations=[{planet:e4,tacticalActions:[]}];
    } else if (S==='ended') {
      // the API still lists Honour the Fallen an hour after its deadline, with Fury taken and the rest not
      const f6={...fury,currentOwner:'Humans'};
      assignments=[{...htf,progress:[1,0,0],expiration:new Date(now-1*H).toISOString()}];
      campaigns=[esker,zea,bug2,bot2]; stations=[];
    } else if (S==='edited') {
      // same order id as "default", but Super Earth doubled the Automaton goal
      const t2=sniper.tasks.map((tk,i)=>i===2?{...tk,values:[3,100000000,0,1978117092,1]}:tk);
      assignments=[htf,{...sniper,tasks:t2}];
    } else if (S==='regions') {
      const z=pl(7,'Zea Rugosia','Illuminate',1.7e6,1.7e6,3,30000,[
        {name:'NEW COB',health:200000,maxHealth:200000,regenPerSecond:0.5556,isAvailable:true,players:9000},
        {name:'GENE',health:60000,maxHealth:100000,regenPerSecond:0.2778,isAvailable:true,players:12000},
        {name:'STARPASS',health:400000,maxHealth:400000,regenPerSecond:1.1111,isAvailable:true,players:6000}]);
      assignments=[{...htf,id:9400,title:'SQUID HUNT',briefing:'Take back Zea Rugosia.',progress:[0],tasks:[lib(7)],expiration:new Date(now+40*H).toISOString()}];
      campaigns=[z,bug2,bot2]; stations=[];
    } else if (S==='sector') {
      const s1=pl(501,'Ingmar','Automaton',1e6,4e5,4,9000), s2=pl(502,'Draupnir','Automaton',1e6,8e5,4,6000), s3=pl(503,'Malevelon Creek','Automaton',1e6,1e5,4,5000);
      s1.sector='Severin'; s2.sector='Severin'; s3.sector='Umlaut'; bot2.sector='Umlaut';
      assignments=[{id:9500,title:'SEVERIN SWEEP',briefing:'Clear the Severin sector.',description:'',progress:[0],tasks:[{type:14,values:[3,2,2,41],valueTypes:[1,3,11,12]}],rewards:[{type:1,amount:35}],expiration:new Date(now+50*H).toISOString()}];
      campaigns=[s1,s2,s3,bot2,bug2]; stations=[];
      sectorInfo={planetInfos:[{index:501,sector:41},{index:502,sector:41},{index:503,sector:12},{index:301,sector:12},{index:300,sector:3}]};
    } else if (S==='type') {
      // one objective of type ?t=N, behind schedule (or a "net liberation" / unknown type)
      const ty=Number(q.get('t')), vt={1:[1,3],2:[1,3,5],4:[1,3],5:[1,3],6:[3,5],7:[1,3],9:[1,3],10:[3,5],15:[3],16:[3]}[ty];
      const vals={1:[2,500000],2:[2,2000000,3992382197],4:[3,400000],5:[4,300000],6:[1000000,1228947512],7:[2,250000],9:[3,40000],10:[50000000,897894480],15:[1],16:[1]}[ty];
      assignments=[{id:9300+ty,title:'TYPE '+ty+' ORDER',briefing:'Test order.',description:'',progress:[vals[vt.indexOf(3)]*0.1],tasks:[{type:ty,values:vals,valueTypes:vt}],rewards:[{type:1,amount:30}],expiration:new Date(now+40*H).toISOString()}];
      raw=[{id32:9300+ty,startTime:(now-30*H-warStart)/1000}];
    } else if (S==='intel') {
      // Esker jumped 20% in the last 45 minutes, Fury's resistance went up, Mars came under attack
      const e7={...esker,health:6e5}, f7={...fury}, m7={...mars,event:{...mars.event,id:501,startTime:new Date(now-20*60e3).toISOString()}};
      campaigns=[f7,e7,zea,m7,bug2,bot2];
      dispatches=[{id:3971,published:new Date(now-3*H).toISOString(),type:0,message:'<i=3>LIBERATION SURGE</i>\n\nSEAF forces have broken through the Terminid lines on <i=1>Esker</i>.'},
        {id:3960,published:new Date(now-90*H).toISOString(),type:0,message:'<i=3>OLD NEWS</i>\n\nToo old to show.'}];
      e7.statistics={playerCount:17500,missionsWon:120450};
      record={'intel.json':{v:2,updated:now-4*60e3,since:now-29*H,every:10,inf:100,official:true,
          alerts:[{kind:'setback',idx:7,t:now-6*H,mins:40,pct:0.12,players:2500,attack:false,name:'Zea Rugosia',won:35,worth:0.00004},
                  {kind:'effect',on:true,t:now-2*H,eid:1136,type:1,v:[[2,200],[0,0]],planets:[75]}],
          effects:[{id:1136,type:1,v:[[2,200],[0,0]],planets:[75],events:[1]},{id:1152,type:32,v:[[4,1978117092],[1,0]],planets:[261,7,90],events:[2]}]},
        'recent.json':{v:1,updated:now-4*60e3,samples:[]}};
    } else if (S==='sniper' || S==='sniperlost') {
      // like the live order on 28 Oct: started 104 h ago, 15 h left, Terminid kills far behind, recorded for 4 hours
      const lost=S==='sniperlost';
      const prog=lost?[60e6,20e6,50e6]:[100e6,26.8e6,50e6];
      const tasks=[{type:3,values:[2,0,150000000,0,1,3827587060,0,0,0,0],valueTypes:[1,2,3,4,6,5,8,9,11,12]},
        {type:3,values:[4,0,32500000,0,1,376960160,0,0,0,0],valueTypes:[1,2,3,4,6,5,8,9,11,12]},
        {type:3,values:[3,0,50000000,0,1,2197477188,0,0,0,0],valueTypes:[1,2,3,4,6,5,8,9,11,12]}];
      assignments=[{id:568917260,title:'MAJOR ORDER',briefing:'Kill the designated enemies to provide footage for the upcoming inspirational education film "Democratic Sniper."',description:'',progress:prog,tasks,rewards:[{type:1,amount:45}],expiration:new Date(now+15*H).toISOString()}];
      raw=[{id32:568917260,startTime:(now-104*H-warStart)/1000}];
      campaigns=[esker,bug2,bot2]; stations=[];
      dispatches=[{id:3972,published:new Date(now-3*H).toISOString(),type:0,message:'<i=3>STRATEGIC OPPORTUNITY SEIZED</i>\n\nHelldivers have contained the outbreak on Nivel 43, securing essential footage for Democratic Sniper.'}];
      const pts=[]; for(let k=24;k>=0;k--){ const tt=now-k*10*60e3, h=(24-k)/6; pts.push([tt, prog[0]-(4-h)*(lost?0.9e6:1.9e6)-Math.sin(k)*2e5, prog[1]-(4-h)*0.28e6, 50e6]); }
      record={'intel.json':{v:2,updated:now-3*60e3,since:now-4*H,every:10,inf:100,official:true,
          alerts:[{kind:'edited',ref:'briefing',order:'568917260',t:now-40*60e3,start:now-104*H,diff:[{i:1,kind:'goal',from:300000000,to:150000000},{i:2,kind:'goal',from:65000000,to:32500000}]}],
          effects:[{id:1207,type:32,v:[[4,3827587060],[1,0]],planets:[75,123,122],events:[1]},{id:1429,type:72,v:[[16,3478611010],[2,3000]],planets:[75,300],events:[2]}]},
        'recent.json':{v:2,updated:now,samples:[],prog:Array.from({length:76},(_,k)=>{const h=(75-k)/3; return {t:now-h*H, prog:{[okey(assignments[0])]:[prog[0]-h*1.6e6, prog[1]-h*0.3e6, 50e6]}};})},
        'progress.json':{v:1,updated:now,since:now-4*H,orders:{'568917260':{start:now-104*H,exp:now+15*H,title:'MAJOR ORDER',pts}},planets:{}}};
    } else if (S==='anyof') {
      // Option 1 or Option 2: liberate either planet
      const o1=pl(601,'Crimsica','Terminids',1e6,2.5e5,4,22000), o2=pl(602,'Estanu','Automaton',1e6,9.5e5,10,1500);
      assignments=[{id:9600,title:'A CHOICE',briefing:'Liberate Crimsica or Estanu.',description:'',flags:2,progress:[0,0],tasks:[lib(601),lib(602)],rewards:[{type:1,amount:50}],expiration:new Date(now+30*H).toISOString()}];
      campaigns=[o1,o2,bug2,bot2]; stations=[]; raw=[{id32:9600,startTime:(now-10*H-warStart)/1000}];
    } else if (S==='newmo') {
      // Honour the Fallen is gone and a new order with an unknown weapon arrives
      assignments=[sniper,{id:9200,title:'SEEDS OF DEMOCRACY',briefing:'Extract E-710 samples from bug worlds.',description:'',progress:[1200000],tasks:[{type:3,values:[2,200000000,0,555000111,1],valueTypes:[1,3,4,5,6]}],rewards:[{type:1,amount:50}],expiration:new Date(now+90*H).toISOString()}];
      raw=[...raw,{id32:9200,startTime:(now-2*H-warStart)/1000}];
    }
    if (S==='fuzz') {
      // random but well-formed game data (?seed=N): the page must never show NaN, undefined or crash
      let sd=Number(q.get('seed')||1); const R=()=>{sd|=0;sd=sd+0x6D2B79F5|0;let t=Math.imul(sd^sd>>>15,1|sd);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
      const P=(a)=>a[Math.floor(R()*a.length)];
      const OW=['Terminids','Automaton','Illuminate','Humans'], FI={Terminids:2,Automaton:3,Illuminate:4};
      const names=['Fury','Esker','Zea Rugosia','Mars','Hellmire','Vog-Sojoth','Choepessa IV','Super Long Planet Name Of Democracy Prime','X'];
      const n=2+Math.floor(R()*6), cps=[];
      for(let i=0;i<n;i++){ const own=P(OW), mh=P([1e6,2e6,4.25e6,15e6]); const regs=R()<0.3?Array.from({length:1+Math.floor(R()*4)},(_,k)=>({name:'REGION '+k,health:Math.round(R()*4e5),maxHealth:P([1e5,2e5,4e5,6e5]),regenPerSecond:P([0,0.5,2]),isAvailable:R()<0.8,players:Math.floor(R()*8000)})):[];
        const ev=own==='Humans'&&R()<0.6?{id:700+i,health:Math.round(R()*5e5),maxHealth:P([3e5,5e5,1e6]),startTime:new Date(now-P([0.2,5,20])*H).toISOString(),endTime:new Date(now+P([-0.5,0.2,6,40])*H).toISOString(),faction:P(OW.slice(0,3))}:null;
        const p0=pl(800+i,P(names),own,mh,Math.round(R()*mh),P([0,2.78,6.94,13.9,277.8,-2.78]),P([0,40,3000,25000,70000]),regs,ev); p0.waypoints=R()<0.5?[800+((i+1)%n)]:[]; cps.push(p0); }
      const idx=cps.map(p=>p.index);
      const mk=()=>{ const ty=P([1,2,3,3,3,4,5,6,7,9,10,11,11,12,13,14,15,99]); const f=P([0,2,3,4]), g=P([1,5,250000,3e7,1.5e8,3e9]);
        switch(ty){ case 3: return {type:3,values:[f,g,P([0,23741406]),P([0,3827587060,1978117092]),P([0,1])],valueTypes:[1,3,4,5,6]};
          case 2: return {type:2,values:[f,g,3992382197],valueTypes:[1,3,5]};
          case 6: case 10: return {type:ty,values:[g,P([1228947512,897894480])],valueTypes:[3,5]};
          case 11: case 13: return {type:ty,values:[1,1,P(idx)],valueTypes:[3,11,12]};
          case 14: return {type:14,values:[f,P([1,2,3])],valueTypes:[1,3]};
          case 12: return {type:12,values:[f,P([1,3,8])],valueTypes:[1,3]};
          case 15: return {type:15,values:[1],valueTypes:[3]};
          case 99: return {type:99,values:[g],valueTypes:[3]};
          default: return {type:ty,values:[f,g],valueTypes:[1,3]}; } };
      const na=P([1,1,2,3]); assignments=[]; raw=[];
      for(let k=0;k<na;k++){ const tasks=Array.from({length:1+Math.floor(R()*5)},mk); const id=9900+k;
        const prog=tasks.map(tk=>{ const g=tk.valueTypes.indexOf(3)>=0?tk.values[tk.valueTypes.indexOf(3)]:1; return P([0,Math.round(g*R()),g,Math.round(g*1.2)]); });
        assignments.push({id,title:P(['MAJOR ORDER','','INTERROGATION ENHANCEMENT','A VERY LONG ORDER TITLE THAT GOES ON AND ON ABOUT DEMOCRACY AND LIBERTY','Ünïcödé <i=1>Tag</i> & "quotes"']),
          briefing:P(['','Acquire <i=1>60,000,000</i> Automaton samples and kill 35,000,000 Radicals.','Hold the line.\n\nSecond paragraph with <b>bold</b>.']),description:P(['','Extra text.']),
          flags:P([0,1,2,3]),progress:prog,tasks,rewards:P([[{type:1,amount:P([0,35,90])}],[],undefined]),expiration:new Date(now+P([-2,0.1,3,40,200])*H).toISOString()});
        if(R()<0.8) raw.push({id32:id,startTime:(now-P([0.5,4,30,100])*H-warStart)/1000}); }
      campaigns=cps; stations=R()<0.6?[{planet:P(cps),tacticalActions:R()<0.5?[{name:'HEAVY ORDNANCE DISTRIBUTION',status:2,statusExpire:new Date(now+3*H).toISOString()}]:[]}]:[];
      players=P([500,30000,82873,150000]);
      const DM=['<i=3>MAJOR ORDER WON</i>\n\nThe Helldivers have done it.','<i=3>NEW STRATEGIC OPPORTUNITY</i>\n\nSecure the data on <i=1>Fury</i>.','<i=3>STRATEGIC OPPORTUNITY SEIZED</i>\n\nGoals have been reduced.','Untitled dispatch with no headline at all, just text.','<i=3></i>\n\nEmpty headline.','<i=3>ARSENAL AUGMENTATION</i>\n\nFree Gas Mines.'];
      dispatches=Array.from({length:Math.floor(R()*5)},(_,k)=>({id:6000+k,published:new Date(now-P([0.2,3,30])*H).toISOString(),type:0,message:P(DM)}));
      const aid=String(assignments[0].id);
      record={'intel.json':{v:2,updated:now-3*60e3,since:now-P([2,30])*H,every:10,inf:100,official:true,impN24:P([null,1080]),K:P([null,0.03]),
          alerts:[{kind:'edited',order:aid,t:now-2*H,diff:P([[{i:1,kind:'goal',from:3e8,to:1.5e8}],[{i:9,kind:'goal',from:1,to:2}],[{i:1,kind:'changed'}],null])},
            {kind:'edited',ref:'briefing',order:aid,t:now-H,start:now-30*H,diff:[{i:2,kind:'goal',from:35e6,to:6e7}]},
            {kind:P(['jump','setback']),idx:P(idx),t:now-H,mins:40,pct:P([0.09,0.3]),players:2000,attack:false,name:'X'},
            {kind:'effect',on:true,t:now-2*H,eid:1,type:P([1,32,72,999]),v:[[2,200],[0,0]],planets:[P(idx),-1]}],
          effects:[{id:1,type:P([1,32,72,999]),v:[[2,200],[0,0]],planets:[P(idx)],events:[1]}],so:[]},
        'recent.json':{v:2,updated:now,samples:[],prog:[]},
        'progress.json':{v:1,updated:now,since:now-30*H,orders:{[aid]:{start:now-30*H,exp:now+40*H,title:'X',pts:Array.from({length:30},(_,k)=>[now-(30-k)*H,...assignments[0].progress.map(v=>Math.round((v||0)*k/30))])}},planets:{}}};
    }
    if (S==='apidown') record['live.json']={v:1,t:now-12*60e3,src:'official',
      war:{started:new Date(warStart - LAG).toISOString(),now:new Date(now - warStart).toISOString(),impactMultiplier:0.0191*56000/players,statistics:{playerCount:players}},
      assignments, campaigns:campaigns.map(p=>({planet:p})), stations:[], raw, extra:[]};
    return { mode, campaigns, fury, record, data: {
      '/api/v1/war':{started:new Date(warStart - LAG).toISOString(),now:new Date(now - warStart).toISOString(),impactMultiplier:0.0191*56000/players,statistics:{playerCount:players}},
      '/api/v1/assignments':assignments,
      '/api/v1/campaigns':campaigns.map(p=>({planet:p})),
      '/api/v2/space-stations':stations,
      '/raw/api/v2/Assignment/War/801':raw,
      '/raw/api/WarSeason/801/WarInfo':sectorInfo,
      '/api/v1/dispatches':dispatches,
    } };
  }
  window.__mockScenario = q.get('s') || 'default';
  window.__mockRealRate = q.get('rate') === 'real';
  window.__mockLog = [];
  window.__mockNames = {'enemy_ids.json':{},'item_names.json':{'1978117092':{name:'M-1000 Maxigun'}},'lists.py':'STRATAGEM_ID_DICT = {\n 123: "EAT-17",\n}'};
  window.fetch = async (url, opts={}) => {
    const u = new URL(url);
    const file = u.pathname.split('/').pop();
    const sc = build(window.__mockScenario);
    if (u.hostname.includes('helldivers2.dev')) {
      const h = opts.headers || {};
      window.__mockLog.push({ at: Date.now(), path: u.pathname, culture: u.searchParams.get('culture'), lang: h['Accept-Language'] || null });
      if (sc.mode==='fail') throw new TypeError('Failed to fetch');
      if (sc.mode==='slow') await new Promise((res, rej) => { const t=setTimeout(res, 25000); if (opts.signal) opts.signal.addEventListener('abort', () => { clearTimeout(t); const e=new Error('aborted'); e.name='AbortError'; rej(e); }); });
    } else if (u.hostname === 'raw.githubusercontent.com' && u.pathname.includes('/ministry-of-victory/')) {
      window.__mockLog.push({ rec: file });
      if (file === 'archive.json' && window.__mockArchive) return new Response(JSON.stringify(window.__mockArchive), { status: 200, headers: { 'content-type': 'application/json' } });
      const r = sc.record && sc.record[file];
      return r ? new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } }) : new Response('not found', { status: 404 });
    } else {
      window.__mockLog.push({ names: file });
    }
    let body = sc.data[u.pathname] ?? window.__mockNames[file] ?? null;
    if (u.pathname.startsWith('/api/v1/planets/')) { const i=Number(file); body = sc.campaigns.find(p=>p.index===i) || (i===261?{...sc.fury,currentOwner:'Humans'}:null); }
    if (body == null) return new Response('not found',{status:404});
    return new Response(typeof body==='string'?body:JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
  };
  try { localStorage.clear(); if (q.get('motion')) localStorage.setItem('mocheck.settings', JSON.stringify({motion:q.get('motion')})); } catch {}
  if (window.__mockScenario === 'intel') try {
    // 45 minutes of history this browser "saw" before the jump
    const M=60e3, imp=0.0191*56000/82873, samples=[];
    for (let k=45;k>=1;k--) samples.push({t:t0-k*M,N:82873,imp,dss:261,hod:false,planets:{75:{h:8e5,p:17500,w:120450-(k*3)},261:{h:1495323,p:34800},160:{h:1e6,p:4200}},prog:{}});
    const since=t0-50*M, seen=t0-1*M;
    const pmeta={75:{m:1e6,e:0,o:'Terminids',g:0,since,seen,r:[[since,6.9444447]]},261:{m:2e6,e:0,o:'Automaton',g:0,since,seen,r:[[since,3]]},160:{m:1e6,e:0,o:'Humans',g:0,since,seen,r:[[since,0]]}};
    localStorage.setItem('mocheck.samples', JSON.stringify(samples));
    localStorage.setItem('mocheck.pmeta', JSON.stringify(pmeta));
  } catch {}
})();
