// RNF-01: tiempo entre la selección del horario y la confirmación de la reserva, móvil con 4G.
const { chromium } = require('playwright-core');
const API='http://localhost:4001', WEB='http://localhost:5173', H={Origin:WEB};
const out=process.argv[2], REPS=+(process.argv[3]||3), THROTTLE=process.argv[4]!=='off';
const now=Date.now();
function dateAR(plusDays){ const d=new Date(now-3*3600e3+plusDays*864e5); while(d.getUTCDay()===0) d.setUTCDate(d.getUTCDate()+1); return d.toISOString().slice(0,10) }
const DATE=dateAR(+(process.env.DAYS||3));
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const results=[];
  for(let rep=0;rep<REPS;rep++){
    const ctx=await browser.newContext({viewport:{width:412,height:915},isMobile:true,hasTouch:true,deviceScaleFactor:1});
    await ctx.route(/wa\.me|whatsapp\.com/,r=>r.abort());
    const email=`rnf01.${now}.${rep}@test.local`, password='Rnf01Prueba123!';
    await ctx.request.post(API+'/api/auth/register',{headers:H,data:{name:'Prueba',lastName:'Rendimiento',email,password,phone:'3764111222',termsAccepted:true}});
    await ctx.request.post(API+'/api/auth/login',{headers:H,data:{email,password}});
    const page=await ctx.newPage();
    const cdp=await ctx.newCDPSession(page);
    if(THROTTLE){
      // Chrome "Slow 4G" = mismo perfil que Lighthouse: 1,6 Mbps bajada, 750 kbps subida, 150 ms de latencia, CPU 4x más lenta
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:1.6*1024*1024/8,uploadThroughput:750*1024/8});
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    }
    let postMs=null;
    page.on('response',async r=>{ if(r.request().method()==='POST'&&/\/api\/client\/appointments$/.test(r.url())){ const t=r.request().timing(); postMs=Math.round(t.responseEnd) } });
    try{
      await page.goto(WEB+'/client/book',{waitUntil:'networkidle',timeout:90000});
      await page.getByText('Manicura semipermanente').first().click();
      await page.getByRole('button',{name:'Siguiente'}).click();
      await page.getByText('Loren (demo)').first().click();
      await page.getByRole('button',{name:'Siguiente'}).click();
      await page.locator('input[type=date]').fill(DATE);
      const slots=page.getByRole('button',{name:/^\d{2}:\d{2}$/});
      await slots.first().waitFor({timeout:30000});
      const slot=slots.first();
      const label=await slot.innerText();
      // A: selección del horario -> resumen de la reserva visible
      let t0=Date.now();
      await slot.click();
      await page.getByRole('button',{name:'Siguiente'}).click();
      await page.getByRole('button',{name:'Confirmar reserva'}).waitFor({timeout:30000});
      const A=Date.now()-t0;
      // B: confirmar -> paso de pago visible
      t0=Date.now();
      await page.getByRole('button',{name:'Confirmar reserva'}).click();
      await page.getByRole('button',{name:/Coordinar el pago por WhatsApp/}).waitFor({timeout:30000});
      const B=Date.now()-t0;
      // C: elegir pago por WhatsApp (crea la reserva) -> reserva confirmada en pantalla
      await page.getByRole('checkbox').first().check();
      t0=Date.now();
      await page.getByRole('button',{name:/Coordinar el pago por WhatsApp/}).click();
      await page.getByText(/Antes de terminar/i).waitFor({timeout:30000});
      const C=Date.now()-t0;
      results.push({rep:rep+1,slot:label,A,B,C,total:A+B+C,postMs});
    }catch(e){
      await page.screenshot({path:`${out}/fail-${rep}.png`});
      results.push({rep:rep+1,error:String(e).split('\n')[0].slice(0,160),text:(await page.innerText('body')).replace(/\s+/g,' ').slice(0,300)});
    }
    await ctx.close();
  }
  console.log(JSON.stringify({fecha:DATE,throttle:THROTTLE,results},null,1));
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
