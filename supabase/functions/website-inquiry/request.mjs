// Keep the abort timer alive through body consumption, not only receipt of headers.
export async function request(url, body, headers, timeout) {
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try {
    const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body),signal:controller.signal});
    if(!response.ok)throw new Error('Upstream request failed');
    return await response.json();
  } finally {clearTimeout(timer);}
}
