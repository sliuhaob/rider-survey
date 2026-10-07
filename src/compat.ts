// Older mobile webviews have getRandomValues but no randomUUID.
export function submissionId(): string {
 const bytes = new Uint8Array(16);
 crypto.getRandomValues(bytes);
 bytes[6] = (bytes[6] & 15) | 64;
 bytes[8] = (bytes[8] & 63) | 128;
 const hex = Array.from(bytes, byte => ('0' + byte.toString(16)).slice(-2));
 return hex.slice(0,4).join('')+'-'+hex.slice(4,6).join('')+'-'+hex.slice(6,8).join('')+'-'+hex.slice(8,10).join('')+'-'+hex.slice(10).join('');
}

// XHR provides a timeout for the whole response, including on older webviews
// without fetch cancellation or AbortController. Never retry with a new ID.
export function submitAnswers(url: string, payload: unknown, ms = 45000): Promise<string> {
 return new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.timeout = ms;
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-Survey-Request', '1');
  xhr.onerror = () => reject(new Error('网络请求未完成，请切换 Wi-Fi 或移动网络后重试。'));
  xhr.ontimeout = () => reject(new Error('等待服务器回复超时，请稍后重试。'));
  xhr.onabort = () => reject(new Error('提交请求被中断，请重试。'));
  xhr.onload = () => {
   let data: {error?: string; receipt?: string};
   try { data = JSON.parse(xhr.responseText); }
   catch { reject(new Error('服务器未返回有效确认（HTTP '+xhr.status+'），请稍后重试。')); return; }
   if (xhr.status < 200 || xhr.status >= 300) {
    reject(new Error((typeof data?.error === 'string' ? data.error : '服务器暂时无法保存')+'（HTTP '+xhr.status+'）。')); return;
   }
   const id = (payload as {id?: string}).id;
   if (!id || data?.receipt !== id) {
    reject(new Error('服务器未返回匹配的提交编号，请重试确认。')); return;
   }
   resolve(id);
  };
  xhr.send(JSON.stringify(payload));
 });
}
