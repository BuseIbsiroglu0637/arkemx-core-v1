import { getArkemAccountSession } from '../../chatgpt-auth';
import { queryKastamonuZoning, ZoningQueryError } from '../../lib/kastamonu-zoning';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request) {
  if(request.headers.get('origin')!==new URL(request.url).origin) return Response.json({error:'Geçersiz istek kaynağı.'},{status:403,headers});
  if(!(await getArkemAccountSession()).user) return Response.json({error:'İmar sorgusu için oturum açın.'},{status:401,headers});
  if(!request.headers.get('content-type')?.includes('application/json')) return Response.json({error:'Geçersiz istek.'},{status:415,headers});
  let input:unknown;
  try {const body=await request.text();if(new TextEncoder().encode(body).length>2000)throw Error();input=JSON.parse(body);}
  catch {return Response.json({error:'Parsel kimliği okunamadı.'},{status:400,headers});}
  try {return Response.json(await queryKastamonuZoning(input,fetch,request.signal),{headers});}
  catch(error) {return Response.json({code:error instanceof ZoningQueryError?error.code:'unavailable',error:error instanceof ZoningQueryError?error.message:'İmar bağlantısı tamamlanamadı.'},{status:error instanceof ZoningQueryError && error.code==='invalid-input'?400:502,headers});}
}
