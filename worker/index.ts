import {normalize,questions} from '../src/questions.ts';
import {originAllowed,requestAllowed} from './request-origin.ts';
export interface Env { DB:D1Database; SURVEY_ADMIN_KEY:string; GITHUB_PAGES_URL:string; LOCAL_DEVELOPMENT?:string; }
function csvCell(v:unknown){let s=String(v??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r\n]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'no-store'}});}
async function readBody(request:Request){const reader=request.body?.getReader();if(!reader)throw Error('EMPTY');let size=0;const chunks:Uint8Array[]=[];for(;;){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>60000){await reader.cancel();throw Error('TOO_LARGE');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return JSON.parse(new TextDecoder().decode(bytes));}
async function exportCsv(env:Env){const columns=questions.flatMap(q=>[{id:q.id,title:q.id+' '+q.title},...(q.options?.some(o=>o.includes('其他'))?[{id:q.id+'_other',title:q.id+' 补充说明'}]:[])]);const encoder=new TextEncoder();const stream=new ReadableStream({async start(controller){try{controller.enqueue(encoder.encode('\uFEFF'+['提交编号','提交时间（UTC）','问卷版本',...columns.map(c=>c.title)].map(csvCell).join(',')+'\r\n'));let cursor='';for(;;){const rows=await env.DB.prepare('SELECT id,created_at,version,answers FROM responses WHERE id > ? ORDER BY id LIMIT 200').bind(cursor).all<{id:string;created_at:string;version:string;answers:string}>();for(const row of rows.results){const a=JSON.parse(row.answers);controller.enqueue(encoder.encode([row.id,row.created_at,row.version,...columns.map(c=>Array.isArray(a[c.id])?a[c.id].join('；'):a[c.id])].map(csvCell).join(',')+'\r\n'));cursor=row.id;}if(rows.results.length<200)break;}controller.close();}catch{controller.error(Error('导出失败'));}}});return new Response(stream,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="night-rider-responses.csv"','Cache-Control':'no-store'}});}
async function api(request:Request,env:Env,url:URL){
 if(url.pathname==='/api/health'&&request.method==='GET'){try{await env.DB.prepare('SELECT id FROM responses LIMIT 1').first();return json({ok:true});}catch{return json({ok:false},503);}}
 if(!requestAllowed(request,url,env))return json({error:'请求来源无效'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204});
 if(request.method!=='POST')return json({error:'方法不支持'},405);
 if(url.pathname==='/api/export'){const key=env.SURVEY_ADMIN_KEY;if(!key||request.headers.get('Authorization')!=='Bearer '+key)return json({error:'管理密钥不正确'},401);return exportCsv(env);}
 if(url.pathname!=='/api/responses')return json({error:'接口不存在'},404);
 if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return json({error:'请使用问卷页面提交'},415);
 let body;try{body=await readBody(request);}catch(e){return json({error:(e as Error).message==='TOO_LARGE'?'答卷内容过长':'答卷格式无效'},(e as Error).message==='TOO_LARGE'?413:400);}
 if(!body||typeof body!=='object'||body.website)return json({error:'提交未通过校验'},400);
 if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))return json({error:'提交编号无效'},400);
 let answers;try{answers=normalize(body.answers);}catch(e){return json({error:(e as Error).message},400);}
 await env.DB.prepare('INSERT INTO responses (id, created_at, version, answers) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO NOTHING').bind(body.id,new Date().toISOString(),'1',JSON.stringify(answers)).run();
 return json({receipt:body.id});
}
export default {async fetch(request:Request,env:Env):Promise<Response>{const url=new URL(request.url);
 if(url.protocol==='http:'&&['survey.roxy-design.com','survey-api.roxy-design.com'].includes(url.hostname)){url.protocol='https:';return Response.redirect(url.href,307);}
 if(url.pathname.startsWith('/api/')){let result:Response;try{result=await api(request,env,url);}catch{result=json({error:'暂时无法保存，请稍后重试'},503);}const headers=new Headers(result.headers),origin=request.headers.get('Origin')||'';if(originAllowed(origin,url,env)){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','POST,GET,OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type,Authorization,X-Survey-Request');headers.set('Vary','Origin');}headers.set('X-Content-Type-Options','nosniff');headers.set('Strict-Transport-Security','max-age=31536000');return new Response(result.body,{status:result.status,headers});}
 if(url.pathname==='/admin'||url.pathname==='/admin/')return Response.redirect(url.origin+'/#admin',302);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(url.pathname.includes('..')||url.pathname.includes('%'))return new Response('Invalid path',{status:400});
 const base=new URL(env.GITHUB_PAGES_URL);const upstream=new URL(base);upstream.pathname=base.pathname.replace(/\/$/,'')+(url.pathname==='/'?'/index.html':url.pathname);
 const response=await fetch(upstream,{method:request.method,redirect:'manual',headers:{Accept:request.headers.get('Accept')||'*/*'}});
 if(response.status>=300&&response.status<400)return new Response('Upstream unavailable',{status:502});
 const headers=new Headers(response.headers);headers.delete('Set-Cookie');headers.set('X-Content-Type-Options','nosniff');headers.set('Strict-Transport-Security','max-age=31536000');headers.set('Referrer-Policy','strict-origin-when-cross-origin');headers.set('X-Frame-Options','DENY');headers.set('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://survey-api.roxy-design.com; frame-ancestors 'none'; base-uri 'self'");
 if(url.pathname==='/'||url.pathname.endsWith('.html'))headers.set('Cache-Control','no-cache');return new Response(response.body,{status:response.status,headers});
}};

