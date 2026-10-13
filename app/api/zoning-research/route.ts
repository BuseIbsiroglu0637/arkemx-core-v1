import { getArkemAccountSession } from '../../chatgpt-auth';
import { checkZoningSources } from '../../lib/zoning-source-access';
const headers = { 'Cache-Control': 'no-store' };
export async function POST(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return Response.json({error:'Geçersiz istek kaynağı.'}, {status:403,headers});
  if (!(await getArkemAccountSession()).user) return Response.json({error:'Kaynak araştırması için oturum açın.'}, {status:401,headers});
  if (!request.headers.get('content-type')?.includes('application/json')) return Response.json({error:'Geçersiz istek.'}, {status:415,headers});
  let province: string, district: string;
  try {
    const body = await request.text(); if (new TextEncoder().encode(body).length > 500) throw Error();
    const data = JSON.parse(body);
    if (!['Kastamonu','Sakarya'].includes(data.province) || typeof data.district !== 'string' || data.district.length > 80) throw Error();
    province = data.province; district = data.district;
  } catch { return Response.json({error:'Kastamonu veya Sakarya seçin; ilçe bilgisi en fazla 80 karakter olabilir.'}, {status:400,headers}); }
  const sources = await checkZoningSources(province, district, fetch, request.signal);
  return Response.json({schema:'ARKEM-ZONING-ACCESS/1.0',province,district,sources}, {headers});
}
